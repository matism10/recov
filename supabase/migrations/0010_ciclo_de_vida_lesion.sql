-- Recov · 0010 · Ciclo de vida de la lesión
-- Ejecutar DESPUÉS de 0009 (en una consulta aparte).
--
-- Una sola lesión que pasa por estados:
--   en_evaluacion  --(el jugador sube su diagnóstico)-->  activa  --(kine confirma)-->  activa revisada
--        |                                                   |
--        +--(kine/head coach descarta)--> descartada         +--(alta)--> cerrada
--
-- * mark_player_injured:     kinesiólogo (o delegado) o head coach marcan a un jugador lesionado, sin diagnóstico.
-- * complete_injury_report:  el jugador agrega su diagnóstico (documentos + duración que le dio el médico).
-- * review_injury:           kinesiólogo (o delegado) o head coach confirman, descartan o cierran, y la
--                            disponibilidad del jugador se actualiza en la misma transacción.
-- Todo por funciones con permisos explícitos; no se agregan políticas de escritura.

-- ---------------------------------------------------------------------
-- Columna: dónde ocurrió
-- ---------------------------------------------------------------------
alter table public.injuries
  add column occurred_during text,
  add constraint injuries_occurred_during_chk
    check (occurred_during is null or occurred_during in ('entrenamiento', 'competencia'));

-- ---------------------------------------------------------------------
-- Quién puede marcar, revisar y cerrar lesiones: kinesiólogo o delegado, y head coach
-- ---------------------------------------------------------------------
create or replace function private.can_manage_injuries()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_kine_powers() or private.has_role('head_coach') $$;

revoke all on function private.can_manage_injuries() from public, anon;
grant execute on function private.can_manage_injuries() to authenticated;

-- Disponibilidad tras cerrar o descartar: vuelve a "disponible" si el jugador no tiene otra lesión abierta.
create or replace function private.release_player_if_clear(p_player_id uuid, p_club_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.injuries
     where player_id = p_player_id and club_id = p_club_id
       and status in ('activa', 'en_evaluacion')
  ) then
    update public.players set availability = 'disponible'
     where id = p_player_id and club_id = p_club_id;
  end if;
end $$;

revoke all on function private.release_player_if_clear(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- mark_player_injured
-- ---------------------------------------------------------------------
create or replace function public.mark_player_injured(
  p_player_id        uuid,
  p_occurred_during  text,
  p_note             text,
  p_availability     public.availability_status default 'en_recuperacion',
  p_occurred_on      date default current_date
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cid uuid := private.current_club_id();
  iid uuid;
begin
  if uid is null or cid is null or not private.can_manage_injuries() then
    raise exception 'No tienes permiso para esta acción';
  end if;

  p_note := trim(coalesce(p_note, ''));
  if char_length(p_note) < 2 or char_length(p_note) > 120 then
    raise exception 'Describe brevemente qué pasó (2 a 120 caracteres)';
  end if;
  if p_occurred_during is null or p_occurred_during not in ('entrenamiento', 'competencia') then
    raise exception 'Indica si fue en entrenamiento o competencia';
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

  return iid;
end $$;

-- ---------------------------------------------------------------------
-- complete_injury_report: el jugador agrega su diagnóstico a una lesión en evaluación
-- p_files: [{"path": "{club_id}/{player_id}/{archivo}", "name": "informe.pdf"}, ...]  (1 a 5)
-- ---------------------------------------------------------------------
create or replace function public.complete_injury_report(
  p_injury_id      uuid,
  p_type           text,
  p_duration_value int,
  p_duration_unit  text,
  p_description    text,
  p_files          jsonb
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid   uuid := (select auth.uid());
  cid   uuid := private.current_club_id();
  pid   uuid := private.current_player_id();
  inj   public.injuries%rowtype;
  total int;
  f     jsonb;
  fpath text;
  fname text;
begin
  if uid is null or cid is null or pid is null or not private.has_role('jugador') then
    raise exception 'No autorizado';
  end if;

  select * into inj from public.injuries
   where id = p_injury_id and club_id = cid and player_id = pid;
  if not found or inj.status <> 'en_evaluacion' then
    raise exception 'No hay una lesión en evaluación para completar';
  end if;

  p_type := trim(coalesce(p_type, ''));
  if char_length(p_type) < 2 or char_length(p_type) > 120 then
    raise exception 'Describe el tipo de lesión (2 a 120 caracteres)';
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

  if p_files is null or jsonb_typeof(p_files) <> 'array'
     or jsonb_array_length(p_files) < 1 or jsonb_array_length(p_files) > 5 then
    raise exception 'Adjunta entre 1 y 5 documentos';
  end if;

  for f in select * from jsonb_array_elements(p_files) loop
    fpath := f->>'path';
    fname := trim(coalesce(f->>'name', ''));
    if fpath is null or fname = '' or char_length(fname) > 200 then
      raise exception 'Documento inválido';
    end if;
    if fpath not like cid::text || '/' || pid::text || '/%' then
      raise exception 'Ruta de documento no permitida';
    end if;
    if not exists (select 1 from storage.objects where bucket_id = 'medical-docs' and name = fpath) then
      raise exception 'El archivo % no existe en el almacenamiento', fname;
    end if;
  end loop;

  update public.injuries
     set type                 = p_type,
         description          = coalesce(nullif(trim(coalesce(p_description, '')), ''), description),
         status               = 'activa',
         reported_by_player   = true,
         doctor_estimate_value = p_duration_value,
         doctor_estimate_unit  = p_duration_unit,
         expected_return_on   = started_on + total,
         reviewed_by          = null,
         reviewed_at          = null
   where id = p_injury_id;

  for f in select * from jsonb_array_elements(p_files) loop
    insert into public.documents (club_id, player_id, injury_id, storage_path, file_name, status, uploaded_by)
    values (cid, pid, p_injury_id, f->>'path', trim(f->>'name'), 'borrador', uid);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- review_injury: confirmar, descartar o cerrar (alta)
--   confirmar: exige gravedad; fecha de alta (la actual o la que se indique); disponibilidad (la que se indique,
--              o la sugerida por gravedad: leve -> en_recuperacion, moderada/grave -> de_baja)
--   descartar: la lesión no era tal; el jugador vuelve a "disponible" si no tiene otra abierta
--   cerrar:    alta médica de una lesión activa; igual que descartar para la disponibilidad
-- ---------------------------------------------------------------------
create or replace function public.review_injury(
  p_injury_id          uuid,
  p_decision           text,
  p_severity           public.injury_severity default null,
  p_expected_return_on date default null,
  p_availability       public.availability_status default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid  uuid := (select auth.uid());
  cid  uuid := private.current_club_id();
  inj  public.injuries%rowtype;
  v_expected date;
  v_avail    public.availability_status;
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

    v_avail := coalesce(
      p_availability,
      case p_severity when 'leve' then 'en_recuperacion' else 'de_baja' end::public.availability_status
    );

    update public.injuries
       set status = 'activa', severity = p_severity, expected_return_on = v_expected,
           reviewed_by = uid, reviewed_at = now()
     where id = p_injury_id;

    update public.players set availability = v_avail
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
end $$;

-- ---------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------
revoke all on function public.mark_player_injured(uuid, text, text, public.availability_status, date) from public, anon;
revoke all on function public.complete_injury_report(uuid, text, int, text, text, jsonb)              from public, anon;
revoke all on function public.review_injury(uuid, text, public.injury_severity, date, public.availability_status) from public, anon;

grant execute on function public.mark_player_injured(uuid, text, text, public.availability_status, date) to authenticated;
grant execute on function public.complete_injury_report(uuid, text, int, text, text, jsonb)              to authenticated;
grant execute on function public.review_injury(uuid, text, public.injury_severity, date, public.availability_status) to authenticated;
