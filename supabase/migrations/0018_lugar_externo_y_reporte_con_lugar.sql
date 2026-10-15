-- 0018: el lugar de la lesión admite 'externo' y el jugador debe indicarlo al reportar.
-- 1) CHECK con 'externo' (más permisivo; las filas existentes siguen válidas).
-- 2) mark_player_injured: misma firma y cuerpo, acepta 'externo'.
-- 3) report_injury: se elimina la firma de 6 args y se crea la de 7 (p_occurred_during obligatorio).

alter table public.injuries drop constraint injuries_occurred_during_chk;
alter table public.injuries add constraint injuries_occurred_during_chk
  check (occurred_during is null
         or occurred_during in ('entrenamiento', 'competencia', 'externo'));

-- 2) mark_player_injured
create or replace function public.mark_player_injured(
  p_player_id uuid,
  p_occurred_during text,
  p_note text,
  p_availability public.availability_status default 'en_revision',
  p_occurred_on date default current_date
) returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
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

  return iid;
end $function$;

-- 3) report_injury: fuera la firma vieja, dentro la nueva
drop function public.report_injury(text, date, int, text, text, jsonb);

create function public.report_injury(
  p_type text,
  p_injury_date date,
  p_duration_value integer,
  p_duration_unit text,
  p_description text,
  p_files jsonb,
  p_occurred_during text
) returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid     uuid := (select auth.uid());
  cid     uuid := private.current_club_id();
  pid     uuid := private.current_player_id();
  total   int;
  iid     uuid;
  f       jsonb;
  fpath   text;
  fname   text;
begin
  if uid is null or cid is null or pid is null or not private.has_role('jugador') then
    raise exception 'No autorizado';
  end if;

  p_type := trim(coalesce(p_type, ''));
  if char_length(p_type) < 2 or char_length(p_type) > 120 then
    raise exception 'Describe el tipo de lesión (2 a 120 caracteres)';
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

  if p_files is null or jsonb_typeof(p_files) <> 'array'
     or jsonb_array_length(p_files) < 1 or jsonb_array_length(p_files) > 5 then
    raise exception 'Adjunta entre 1 y 5 documentos';
  end if;

  if (select count(*) from public.injuries
       where player_id = pid and club_id = cid and reported_by_player and status = 'activa') >= 3 then
    raise exception 'Ya tienes lesiones activas reportadas; espera a que el kinesiólogo las revise';
  end if;

  -- validar todos los archivos antes de escribir nada
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

  insert into public.injuries (
    club_id, player_id, type, severity, status, description, started_on,
    created_by, reported_by_player, doctor_estimate_value, doctor_estimate_unit, expected_return_on,
    occurred_during
  ) values (
    cid, pid, p_type, null, 'activa', nullif(trim(coalesce(p_description, '')), ''), p_injury_date,
    uid, true, p_duration_value, p_duration_unit, p_injury_date + total,
    p_occurred_during
  ) returning id into iid;

  for f in select * from jsonb_array_elements(p_files) loop
    insert into public.documents (club_id, player_id, injury_id, storage_path, file_name, status, uploaded_by)
    values (cid, pid, iid, f->>'path', trim(f->>'name'), 'borrador', uid);
  end loop;

  return iid;
end $function$;

revoke all on function public.report_injury(text, date, int, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.report_injury(text, date, int, text, text, jsonb, text) to authenticated;

revoke all on function public.mark_player_injured(uuid, text, text, public.availability_status, date) from public, anon, authenticated;
grant execute on function public.mark_player_injured(uuid, text, text, public.availability_status, date) to authenticated;
