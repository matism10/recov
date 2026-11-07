-- Recov · Notificaciones (2b): lesiones y disponibilidad (6 a 11, 21 y 22).
-- Cada función se copia de su definición actual en la base (misma firma) y solo se le
-- agrega el aviso. Al jugador: lo de su propia lesión. Al staff con lesiones_revisar:
-- lesión nueva para revisar (21) y documento subido (22); se descartan solas al revisarla.

-- Datos de la lesión para el staff (nombre del jugador y tipo).
create function private.injury_notice_payload(p_injury_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('injury_id', i.id, 'player_id', p.id, 'player_name', p.full_name,
                            'injury_type', i.type, 'body_zone', i.body_zone, 'laterality', i.laterality,
                            'documents', (select count(*) from public.documents d where d.injury_id = i.id))
    from public.injuries i join public.players p on p.id = i.player_id
   where i.id = p_injury_id
$$;
revoke all on function private.injury_notice_payload(uuid) from public;

-- Fase en curso (id y nombre) de una lesión.
create function private.injury_current_phase(p_injury_id uuid)
returns table(id uuid, name text) language sql stable security definer set search_path = '' as $$
  select ph.id, ph.name from public.injury_phases ph
   where ph.injury_id = p_injury_id and ph.archived_at is null and ph.status = 'en_curso'
   order by ph.position limit 1
$$;
revoke all on function private.injury_current_phase(uuid) from public;

-- Aviso de cambio de fase al jugador si la fase en curso cambió.
create function private.notify_phase_change(p_injury_id uuid, p_prev_id uuid, p_prev_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_inj public.injuries%rowtype; v_id uuid; v_name text;
begin
  select * into v_inj from public.injuries where id = p_injury_id;
  select ph.id, ph.name into v_id, v_name from private.injury_current_phase(p_injury_id) ph;
  if v_id is null or v_id is not distinct from p_prev_id then return; end if;
  perform private.notify_players(
    v_inj.club_id, array[v_inj.player_id], 'fase_cambio',
    jsonb_build_object('injury_id', v_inj.id, 'injury_type', v_inj.type,
                       'phase_name', v_name, 'prev_phase_name', p_prev_name),
    'injury:' || v_inj.id || ':fase');
end $$;
revoke all on function private.notify_phase_change(uuid, uuid, text) from public;

-- 6, 7 y 9 · Lesión confirmada, descartada o alta. Descarta las de "por revisar" (21, 22)
-- y "sube tu diagnóstico" (11).
CREATE OR REPLACE FUNCTION public.review_injury(p_injury_id uuid, p_decision text, p_severity injury_severity DEFAULT NULL::injury_severity, p_expected_return_on date DEFAULT NULL::date, p_availability availability_status DEFAULT NULL::availability_status)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid  uuid := (select auth.uid());
  cid  uuid := private.current_club_id();
  inj  public.injuries%rowtype;
  v_expected date;
begin
  if uid is null or cid is null or not private.can_manage_injuries() then
    raise exception 'No tienes permiso para esta acción';
  end if;
  if p_decision is null or p_decision not in ('confirmar', 'descartar', 'cerrar') then
    raise exception 'Decisión inválida';
  end if;

  select * into inj from public.injuries where id = p_injury_id and club_id = cid;
  if not found then raise exception 'Lesión no encontrada'; end if;

  if p_decision = 'confirmar' then
    if inj.status not in ('en_evaluacion', 'activa') then
      raise exception 'Esta lesión ya está cerrada o descartada';
    end if;
    if p_severity is null then raise exception 'Indica la gravedad'; end if;

    v_expected := coalesce(p_expected_return_on, inj.expected_return_on);
    if v_expected is null then raise exception 'Indica la fecha estimada de alta'; end if;
    if v_expected < inj.started_on then raise exception 'La fecha de alta no puede ser anterior a la lesión'; end if;

    update public.injuries
       set status = 'activa', severity = p_severity, expected_return_on = v_expected,
           reviewed_by = uid, reviewed_at = now()
     where id = p_injury_id;

    update public.players set availability = coalesce(p_availability, 'lesionado')
     where id = inj.player_id and club_id = cid;

  elsif p_decision = 'descartar' then
    if inj.status not in ('en_evaluacion', 'activa') then
      raise exception 'Esta lesión ya está cerrada o descartada';
    end if;

    update public.injuries
       set status = 'descartada', closed_on = current_date, reviewed_by = uid, reviewed_at = now()
     where id = p_injury_id;

    perform private.release_player_if_clear(inj.player_id, cid);

  else -- cerrar
    if inj.status <> 'activa' then
      raise exception 'Solo se puede dar de alta una lesión activa';
    end if;

    update public.injuries
       set status = 'cerrada', closed_on = current_date, reviewed_by = uid, reviewed_at = now()
     where id = p_injury_id;

    perform private.release_player_if_clear(inj.player_id, cid);
  end if;

  perform private.dismiss_notification_keys(cid, array[
    'injury:' || p_injury_id || ':nueva', 'injury:' || p_injury_id || ':doc',
    'injury:' || p_injury_id || ':marcado']);
  perform private.notify_players(
    cid, array[inj.player_id],
    case p_decision when 'confirmar' then 'lesion_confirmada'
                    when 'descartar' then 'lesion_descartada' else 'alta' end,
    jsonb_build_object('injury_id', inj.id, 'injury_type', inj.type, 'severity', p_severity,
                       'expected_return_on', v_expected),
    'injury:' || p_injury_id || ':revision');
end $function$;

-- 8 · Cambio de fase (edición de fases)
CREATE OR REPLACE FUNCTION public.set_injury_phases(p_injury_id uuid, p_phases jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  cid     uuid := private.current_club_id();
  inj     public.injuries%rowtype;
  f       jsonb;
  pos     int := 0;
  v_id    uuid;
  kept    uuid[] := '{}';
  v_name  text;
  v_status public.phase_status;
  v_start date;
  v_end   date;
  in_progress int := 0;
  seen_pending boolean := false;
  v_prev_id   uuid;
  v_prev_name text;
begin
  if (select auth.uid()) is null or cid is null or not private.can_manage_injuries() then
    raise exception 'No tienes permiso para esta acción';
  end if;

  select * into inj from public.injuries where id = p_injury_id and club_id = cid;
  if not found then raise exception 'Lesión no encontrada'; end if;
  if inj.status <> 'activa' then raise exception 'Solo se pueden definir fases de una lesión activa'; end if;

  if p_phases is null or jsonb_typeof(p_phases) <> 'array'
     or jsonb_array_length(p_phases) < 1 or jsonb_array_length(p_phases) > 8 then
    raise exception 'Define entre 1 y 8 fases';
  end if;

  -- Validación completa antes de tocar nada.
  for f in select * from jsonb_array_elements(p_phases) loop
    v_name := trim(coalesce(f->>'name', ''));
    if char_length(v_name) < 2 or char_length(v_name) > 60 then
      raise exception 'Cada fase necesita un nombre (2 a 60 caracteres)';
    end if;
    begin
      v_id     := nullif(f->>'id', '')::uuid;
      v_status := coalesce(f->>'status', 'pendiente')::public.phase_status;
      v_start  := nullif(f->>'started_on', '')::date;
      v_end    := nullif(f->>'ended_on', '')::date;
    exception when others then
      raise exception 'Datos de fase inválidos';
    end;
    if v_id is not null then
      if v_id = any (kept) or not exists (
        select 1 from public.injury_phases
         where id = v_id and injury_id = p_injury_id and club_id = cid and archived_at is null
      ) then
        raise exception 'Fase no encontrada';
      end if;
      kept := kept || v_id;
    end if;
    if v_start is not null and v_start < inj.started_on then
      raise exception 'Una fase no puede empezar antes de la lesión';
    end if;
    if v_start is not null and v_end is not null and v_end < v_start then
      raise exception 'Una fase no puede terminar antes de empezar';
    end if;
    if v_status = 'en_curso' then in_progress := in_progress + 1; end if;
    if v_status = 'completada' and seen_pending then
      raise exception 'Las fases completadas deben ir antes que las pendientes';
    end if;
    if v_status <> 'completada' then seen_pending := true; end if;
  end loop;
  if in_progress > 1 then raise exception 'Solo puede haber una fase en curso'; end if;

  select ph.id, ph.name into v_prev_id, v_prev_name from private.injury_current_phase(p_injury_id) ph;

  -- Las fases que no vienen en la lista se marcan como quitadas.
  update public.injury_phases set archived_at = now()
   where injury_id = p_injury_id and club_id = cid and archived_at is null
     and not (id = any (kept));

  for f in select * from jsonb_array_elements(p_phases) loop
    pos := pos + 1;
    v_id := nullif(f->>'id', '')::uuid;
    if v_id is not null then
      update public.injury_phases
         set name = trim(f->>'name'), position = pos,
             status = coalesce(f->>'status', 'pendiente')::public.phase_status,
             started_on = nullif(f->>'started_on', '')::date,
             ended_on = nullif(f->>'ended_on', '')::date
       where id = v_id;
    else
      insert into public.injury_phases (club_id, injury_id, name, position, status, started_on, ended_on)
      values (cid, p_injury_id, trim(f->>'name'), pos,
              coalesce(f->>'status', 'pendiente')::public.phase_status,
              nullif(f->>'started_on', '')::date, nullif(f->>'ended_on', '')::date);
    end if;
  end loop;

  perform private.sync_reintegro(p_injury_id, cid);
  perform private.notify_phase_change(p_injury_id, v_prev_id, v_prev_name);
end $function$;

-- 8 · Cambio de fase ("Avanzar a la siguiente fase")
CREATE OR REPLACE FUNCTION public.advance_injury_phase(p_injury_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  cid  uuid := private.current_club_id();
  inj  public.injuries%rowtype;
  next_id uuid;
  v_prev_id   uuid;
  v_prev_name text;
begin
  if (select auth.uid()) is null or cid is null or not private.can_manage_injuries() then
    raise exception 'No tienes permiso para esta acción';
  end if;

  select * into inj from public.injuries where id = p_injury_id and club_id = cid;
  if not found then raise exception 'Lesión no encontrada'; end if;
  if inj.status <> 'activa' then raise exception 'La lesión no está activa'; end if;

  select id into next_id from public.injury_phases
   where injury_id = p_injury_id and club_id = cid and archived_at is null and status = 'pendiente'
   order by position limit 1;

  if next_id is null and not exists (
    select 1 from public.injury_phases
     where injury_id = p_injury_id and club_id = cid and archived_at is null and status = 'en_curso'
  ) then
    raise exception 'No quedan fases por avanzar';
  end if;

  select ph.id, ph.name into v_prev_id, v_prev_name from private.injury_current_phase(p_injury_id) ph;

  update public.injury_phases
     set status = 'completada', ended_on = current_date
   where injury_id = p_injury_id and club_id = cid and archived_at is null and status = 'en_curso';

  if next_id is not null then
    update public.injury_phases
       set status = 'en_curso', started_on = current_date
     where id = next_id;
  end if;

  perform private.sync_reintegro(p_injury_id, cid);
  perform private.notify_phase_change(p_injury_id, v_prev_id, v_prev_name);
end $function$;

-- 10 · Cambio de disponibilidad a mano
CREATE OR REPLACE FUNCTION public.set_player_availability(p_player_id uuid, p_availability availability_status)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_club uuid := private.current_club_id();
  v_prev public.availability_status;
begin
  if not private.can_set_availability() then raise exception 'No tienes permiso para esta acción'; end if;
  if p_availability is null then raise exception 'Estado de disponibilidad inválido'; end if;

  select availability into v_prev from public.players
   where id = p_player_id and club_id = v_club and status = 'confirmado';

  update public.players
     set availability = p_availability
   where id = p_player_id
     and club_id = private.current_club_id()
     and status = 'confirmado';
  if not found then raise exception 'Jugador no encontrado'; end if;

  if v_prev is distinct from p_availability then
    perform private.notify_players(
      v_club, array[p_player_id], 'disponibilidad',
      jsonb_build_object('from', v_prev, 'to', p_availability), 'availability');
  end if;
end $function$;

-- 11 · Marcado lesionado en terreno ("sube tu diagnóstico")
CREATE OR REPLACE FUNCTION public.mark_player_injured(p_player_id uuid, p_occurred_during text, p_note text, p_availability availability_status DEFAULT 'en_revision'::availability_status, p_occurred_on date DEFAULT CURRENT_DATE)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := (select auth.uid());
  cid uuid := private.current_club_id();
  iid uuid;
begin
  if uid is null or cid is null or not private.has_perm('lesionado_marcar') then
    raise exception 'No tienes permiso para esta acción';
  end if;

  p_note := trim(coalesce(p_note, ''));
  if char_length(p_note) < 2 or char_length(p_note) > 120 then
    raise exception 'Describe brevemente qué pasó (2 a 120 caracteres)';
  end if;
  if p_occurred_during is null or p_occurred_during not in ('entrenamiento', 'competencia', 'externo') then
    raise exception 'Indica si fue en entrenamiento, en competencia o externo al club';
  end if;
  if p_availability is null then
    raise exception 'Disponibilidad inválida';
  end if;
  if p_occurred_on is null or p_occurred_on > current_date or p_occurred_on < current_date - 30 then
    raise exception 'Fecha inválida';
  end if;

  if not exists (
    select 1 from public.players where id = p_player_id and club_id = cid and status = 'confirmado'
  ) then
    raise exception 'Jugador no encontrado';
  end if;

  if exists (
    select 1 from public.injuries
     where player_id = p_player_id and club_id = cid and status = 'en_evaluacion'
  ) then
    raise exception 'Este jugador ya está en evaluación';
  end if;

  insert into public.injuries (club_id, player_id, type, severity, status, started_on, created_by,
                               reported_by_player, occurred_during)
  values (cid, p_player_id, p_note, null, 'en_evaluacion', p_occurred_on, uid, false, p_occurred_during)
  returning id into iid;

  update public.players set availability = p_availability where id = p_player_id and club_id = cid;

  perform private.notify_players(
    cid, array[p_player_id], 'marcado_lesionado',
    jsonb_build_object('injury_id', iid, 'occurred_during', p_occurred_during, 'occurred_on', p_occurred_on),
    'injury:' || iid || ':marcado');

  return iid;
end $function$;

-- 21 · Lesión nueva para revisar (reportada por el jugador)
CREATE OR REPLACE FUNCTION public.report_injury(p_body_zone body_zone, p_laterality injury_laterality, p_injury_date date, p_duration_value integer, p_duration_unit text, p_description text, p_files jsonb, p_occurred_during text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid   uuid := (select auth.uid());
  cid   uuid := private.current_club_id();
  pid   uuid := private.current_player_id();
  total int;
  iid   uuid;
  files jsonb;
  f     jsonb;
begin
  if uid is null or cid is null or pid is null or not private.has_role('jugador') then
    raise exception 'No autorizado';
  end if;

  if p_body_zone is null or p_laterality is null then
    raise exception 'Indica la zona del cuerpo y el lado';
  end if;
  if p_occurred_during is null or p_occurred_during not in ('entrenamiento', 'competencia', 'externo') then
    raise exception 'Indica si la lesión fue en entrenamiento, en competencia o externa al club';
  end if;
  if p_description is not null and char_length(p_description) > 1000 then
    raise exception 'La descripción es demasiado larga';
  end if;
  if p_injury_date is null or p_injury_date > current_date or p_injury_date < current_date - 365 then
    raise exception 'Fecha de lesión inválida';
  end if;

  if p_duration_unit = 'semanas' and p_duration_value between 1 and 104 then
    total := p_duration_value * 7;
  elsif p_duration_unit = 'meses' and p_duration_value between 1 and 24 then
    total := p_duration_value * 30;
  else
    raise exception 'Duración inválida';
  end if;

  if (select count(*) from public.injuries
       where player_id = pid and club_id = cid and reported_by_player and status = 'activa') >= 3 then
    raise exception 'Ya tienes lesiones activas reportadas; espera a que el kinesiólogo las revise';
  end if;

  -- Validar los archivos antes de escribir nada.
  files := private.check_player_files(cid, pid, p_files, 5);

  insert into public.injuries (
    club_id, player_id, type, body_zone, laterality, severity, status, description, started_on,
    created_by, reported_by_player, doctor_estimate_value, doctor_estimate_unit, expected_return_on,
    occurred_during
  ) values (
    cid, pid, private.injury_zone_type(p_body_zone, p_laterality), p_body_zone, p_laterality,
    null, 'activa', nullif(trim(coalesce(p_description, '')), ''), p_injury_date,
    uid, true, p_duration_value, p_duration_unit, p_injury_date + total,
    p_occurred_during
  ) returning id into iid;

  for f in select * from jsonb_array_elements(files) loop
    insert into public.documents (club_id, player_id, injury_id, storage_path, file_name, status, uploaded_by)
    values (cid, pid, iid, f->>'path', trim(f->>'name'), 'borrador', uid);
  end loop;

  perform private.notify_perm(cid, 'lesiones_revisar', 'lesion_por_revisar',
                              private.injury_notice_payload(iid), 'injury:' || iid || ':nueva');

  return iid;
end $function$;

-- 21 · Lesión nueva para revisar (diagnóstico completado tras "Marcar lesionado").
-- También descarta "sube tu diagnóstico" (11).
CREATE OR REPLACE FUNCTION public.complete_injury_report(p_injury_id uuid, p_body_zone body_zone, p_laterality injury_laterality, p_duration_value integer, p_duration_unit text, p_description text, p_files jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid   uuid := (select auth.uid());
  cid   uuid := private.current_club_id();
  pid   uuid := private.current_player_id();
  inj   public.injuries%rowtype;
  total int;
  files jsonb;
  f     jsonb;
begin
  if uid is null or cid is null or pid is null or not private.has_role('jugador') then
    raise exception 'No autorizado';
  end if;

  select * into inj from public.injuries
   where id = p_injury_id and club_id = cid and player_id = pid
   for update;
  if not found or inj.status <> 'en_evaluacion' then
    raise exception 'No hay una lesión en evaluación para completar';
  end if;

  if p_body_zone is null or p_laterality is null then
    raise exception 'Indica la zona del cuerpo y el lado';
  end if;
  if p_description is not null and char_length(p_description) > 1000 then
    raise exception 'La descripción es demasiado larga';
  end if;

  if p_duration_unit = 'semanas' and p_duration_value between 1 and 104 then
    total := p_duration_value * 7;
  elsif p_duration_unit = 'meses' and p_duration_value between 1 and 24 then
    total := p_duration_value * 30;
  else
    raise exception 'Duración inválida';
  end if;

  files := private.check_player_files(cid, pid, p_files, 5);

  update public.injuries
     set type                  = private.injury_zone_type(p_body_zone, p_laterality),
         body_zone             = p_body_zone,
         laterality            = p_laterality,
         description           = coalesce(nullif(trim(coalesce(p_description, '')), ''), description),
         status                = 'activa',
         reported_by_player    = true,
         doctor_estimate_value = p_duration_value,
         doctor_estimate_unit  = p_duration_unit,
         expected_return_on    = started_on + total,
         reviewed_by           = null,
         reviewed_at           = null
   where id = p_injury_id;

  for f in select * from jsonb_array_elements(files) loop
    insert into public.documents (club_id, player_id, injury_id, storage_path, file_name, status, uploaded_by)
    values (cid, pid, p_injury_id, f->>'path', trim(f->>'name'), 'borrador', uid);
  end loop;

  perform private.dismiss_notification_keys(cid, array['injury:' || p_injury_id || ':marcado']);
  perform private.notify_perm(cid, 'lesiones_revisar', 'lesion_por_revisar',
                              private.injury_notice_payload(p_injury_id),
                              'injury:' || p_injury_id || ':nueva');
end $function$;

-- 22 · Documento subido o reemplazado
CREATE OR REPLACE FUNCTION public.add_own_injury_document(p_injury_id uuid, p_path text, p_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := (select auth.uid());
  cid uuid := private.current_club_id();
  pid uuid := private.current_player_id();
  inj public.injuries%rowtype;
  did uuid;
begin
  if uid is null or cid is null or pid is null or not private.has_role('jugador') then
    raise exception 'No autorizado';
  end if;

  select * into inj from public.injuries
   where id = p_injury_id and club_id = cid and player_id = pid
   for update;
  if not found then
    raise exception 'Lesión no encontrada';
  end if;
  if inj.reviewed_at is not null or inj.status <> 'activa' then
    raise exception 'El kinesiólogo ya revisó esta lesión: ya no puedes cambiar sus documentos';
  end if;

  if (select count(*) from public.documents where injury_id = p_injury_id) >= 5 then
    raise exception 'Puedes adjuntar hasta 5 documentos';
  end if;

  perform private.check_player_files(cid, pid, jsonb_build_array(jsonb_build_object('path', p_path, 'name', p_name)), 1);

  insert into public.documents (club_id, player_id, injury_id, storage_path, file_name, status, uploaded_by)
  values (cid, pid, p_injury_id, p_path, trim(p_name), 'borrador', uid)
  returning id into did;

  perform private.notify_perm(cid, 'lesiones_revisar', 'documento_subido',
                              private.injury_notice_payload(p_injury_id)
                                || jsonb_build_object('file_name', trim(p_name)),
                              'injury:' || p_injury_id || ':doc');

  return did;
end $function$;
