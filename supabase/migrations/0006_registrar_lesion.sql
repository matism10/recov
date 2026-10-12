-- Recov · 0006 · El jugador registra su lesión
-- Ejecutar DESPUÉS de 0005 (en una consulta aparte). No cambia enums.
--
-- Flujo: el jugador reporta una lesión con su documentación y la duración que le dio el médico.
-- El sistema calcula la fecha estimada de alta. La línea de tiempo es el avance en % entre la fecha
-- de la lesión y esa fecha (se calcula en la app, no se guarda). Las fases por etapas quedan para después.
-- El kinesiólogo (o su delegado) revisa y puede mover la fecha. El jugador ve solo su propia lesión.
-- Todo el alta pasa por la función report_injury: el jugador no escribe directo en las tablas.

-- ---------------------------------------------------------------------
-- Lesiones: campos del reporte
-- ---------------------------------------------------------------------
alter table public.injuries alter column severity drop not null;  -- la define el kinesiólogo al revisar

alter table public.injuries
  add column reported_by_player    boolean not null default false,
  add column doctor_estimate_value int,
  add column doctor_estimate_unit  text,
  add column expected_return_on    date,   -- fecha estimada de alta; el kinesiólogo puede moverla
  add column reviewed_by           uuid references public.profiles (id),
  add column reviewed_at           timestamptz,
  add constraint injuries_doctor_estimate_chk check (
    (doctor_estimate_value is null and doctor_estimate_unit is null)
    or (doctor_estimate_value > 0 and doctor_estimate_unit in ('semanas', 'meses'))
  );

-- La ruta del documento debe estar en la carpeta del propio jugador: {club_id}/{player_id}/...
alter table public.documents
  add constraint documents_path_chk
  check (storage_path like club_id::text || '/' || player_id::text || '/%') not valid;

-- ---------------------------------------------------------------------
-- Storage: tamaño y tipos permitidos
-- ---------------------------------------------------------------------
update storage.buckets
   set file_size_limit    = 10485760,   -- 10 MB
       allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']
 where id = 'medical-docs';

-- ---------------------------------------------------------------------
-- Políticas: el jugador ve solo su lesión; ya no inserta documentos directo
-- ---------------------------------------------------------------------
drop policy documents_player_insert on public.documents;

create policy injuries_player_select on public.injuries
  for select to authenticated
  using (
    club_id = private.current_club_id()
    and private.has_role('jugador')
    and player_id = private.current_player_id()
  );

-- ---------------------------------------------------------------------
-- report_injury: crea la lesión y sus documentos en una sola operación
-- p_files: [{"path": "{club_id}/{player_id}/{archivo}", "name": "informe.pdf"}, ...]  (1 a 5)
-- Devuelve el id de la lesión.
-- ---------------------------------------------------------------------
create or replace function public.report_injury(
  p_type           text,
  p_injury_date    date,
  p_duration_value int,
  p_duration_unit  text,
  p_description    text,
  p_files          jsonb
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
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
    created_by, reported_by_player, doctor_estimate_value, doctor_estimate_unit, expected_return_on
  ) values (
    cid, pid, p_type, null, 'activa', nullif(trim(coalesce(p_description, '')), ''), p_injury_date,
    uid, true, p_duration_value, p_duration_unit, p_injury_date + total
  ) returning id into iid;

  for f in select * from jsonb_array_elements(p_files) loop
    insert into public.documents (club_id, player_id, injury_id, storage_path, file_name, status, uploaded_by)
    values (cid, pid, iid, f->>'path', trim(f->>'name'), 'borrador', uid);
  end loop;

  return iid;
end $$;

revoke all on function public.report_injury(text, date, int, text, text, jsonb) from public, anon;
grant execute on function public.report_injury(text, date, int, text, text, jsonb) to authenticated;
