-- Registro de lesión v2 · el jugador reporta por zona del cuerpo y el documento
-- médico es opcional.
--
-- - private.injury_zone_type(zona, lado): texto de injuries.type ("Isquiotibial
--   derecho"). injuries.type sigue NOT NULL.
-- - private.check_player_files: valida de 0 a p_max archivos en la carpeta del
--   jugador y que existan en Storage (mismas reglas que report_injury, 0018).
-- - report_injury y complete_injury_report: versiones nuevas (otros argumentos)
--   con p_body_zone y p_laterality y 0 a 5 documentos. Las versiones anteriores
--   (tipo libre, 1 a 5 documentos) se mantienen mientras la app publicada las usa;
--   se les quitan los permisos en una migración posterior al deploy.
-- - add_own_injury_document: el jugador agrega un documento a su lesión activa sin
--   revisar (para "Reemplazar" o subir uno después). Máximo 5 por lesión.
-- No se toca ninguna política RLS: el jugador sigue sin escritura directa en documents.

create function private.injury_zone_type(p_zone public.body_zone, p_side public.injury_laterality)
returns text
language sql
immutable
set search_path = ''
as $$
  with z(label, feminine) as (
    select case p_zone
             when 'cabeza_cuello' then 'Cabeza y cuello'
             when 'hombro'        then 'Hombro'
             when 'biceps'        then 'Bíceps'
             when 'triceps'       then 'Tríceps'
             when 'codo'          then 'Codo'
             when 'antebrazo'     then 'Antebrazo'
             when 'mano'          then 'Mano'
             when 'pecho'         then 'Pecho'
             when 'espalda_alta'  then 'Espalda alta'
             when 'lumbar'        then 'Zona lumbar'
             when 'abdomen'       then 'Abdomen'
             when 'cadera_ingle'  then 'Cadera e ingle'
             when 'gluteo'        then 'Glúteo'
             when 'cuadriceps'    then 'Cuádriceps'
             when 'isquiotibial'  then 'Isquiotibial'
             when 'rodilla'       then 'Rodilla'
             when 'tibia'         then 'Tibia'
             when 'gemelo'        then 'Gemelo'
             when 'tobillo_pie'   then 'Tobillo y pie'
           end,
           p_zone in ('mano', 'espalda_alta', 'lumbar', 'cadera_ingle', 'rodilla', 'tibia')
  )
  select case p_side
           when 'derecha'   then label || case when feminine then ' derecha' else ' derecho' end
           when 'izquierda' then label || case when feminine then ' izquierda' else ' izquierdo' end
           when 'bilateral' then label || ' bilateral'
           else label
         end
    from z
$$;

-- Devuelve el arreglo de archivos validado ([] si viene nulo).
create function private.check_player_files(p_cid uuid, p_pid uuid, p_files jsonb, p_max int)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  f     jsonb;
  fpath text;
  fname text;
begin
  if p_files is null then
    return '[]'::jsonb;
  end if;
  if jsonb_typeof(p_files) <> 'array' or jsonb_array_length(p_files) > p_max then
    raise exception 'Puedes adjuntar hasta % documentos', p_max;
  end if;

  for f in select * from jsonb_array_elements(p_files) loop
    fpath := f->>'path';
    fname := trim(coalesce(f->>'name', ''));
    if fpath is null or fname = '' or char_length(fname) > 200 then
      raise exception 'Documento inválido';
    end if;
    if fpath not like p_cid::text || '/' || p_pid::text || '/%' then
      raise exception 'Ruta de documento no permitida';
    end if;
    if not exists (select 1 from storage.objects where bucket_id = 'medical-docs' and name = fpath) then
      raise exception 'El archivo % no existe en el almacenamiento', fname;
    end if;
  end loop;

  return p_files;
end $$;

revoke all on function private.check_player_files(uuid, uuid, jsonb, int) from public, anon, authenticated;

-- Registrar lesión (jugador), por zona y con documentos opcionales.
create function public.report_injury(
  p_body_zone        public.body_zone,
  p_laterality       public.injury_laterality,
  p_injury_date      date,
  p_duration_value   integer,
  p_duration_unit    text,
  p_description      text,
  p_files            jsonb,
  p_occurred_during  text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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

  return iid;
end $$;

revoke all on function public.report_injury(public.body_zone, public.injury_laterality, date, integer, text, text, jsonb, text) from public, anon;
grant execute on function public.report_injury(public.body_zone, public.injury_laterality, date, integer, text, text, jsonb, text) to authenticated;

-- Completar una lesión en evaluación (la marcó el kine), por zona y con documentos opcionales.
create function public.complete_injury_report(
  p_injury_id      uuid,
  p_body_zone      public.body_zone,
  p_laterality     public.injury_laterality,
  p_duration_value integer,
  p_duration_unit  text,
  p_description    text,
  p_files          jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
end $$;

revoke all on function public.complete_injury_report(uuid, public.body_zone, public.injury_laterality, integer, text, text, jsonb) from public, anon;
grant execute on function public.complete_injury_report(uuid, public.body_zone, public.injury_laterality, integer, text, text, jsonb) to authenticated;

-- Agregar un documento a una lesión propia activa y sin revisar.
create function public.add_own_injury_document(p_injury_id uuid, p_path text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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

  return did;
end $$;

revoke all on function public.add_own_injury_document(uuid, text, text) from public, anon;
grant execute on function public.add_own_injury_document(uuid, text, text) to authenticated;
