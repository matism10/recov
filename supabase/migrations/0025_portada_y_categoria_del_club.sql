-- Recov · 0025 · Portada y categoría del club
-- Ejecutar DESPUÉS de 0024.
--
-- La dirección (head coach y manager) sube la portada del club y escribe su
-- categoría desde Configuración; se muestran en el encabezado (ClubHeader).
--   Portada en Storage: club-covers/{club_id}/{archivo}. Bucket PRIVADO: son fotos
--                       con personas reconocibles; solo los miembros confirmados del
--                       club pueden leerlas (URL firmada).
--   Categoría:          texto libre de 2 a 40 caracteres (p. ej. "Adulta"), o NULL.
-- No hay escritura directa: clubs no tiene política de UPDATE.

-- ---------------------------------------------------------------------
-- Clubes: ruta de la portada y categoría
-- ---------------------------------------------------------------------
alter table public.clubs add column cover_path text;
alter table public.clubs add constraint clubs_cover_path_format
  check (cover_path like id::text || '/%');

alter table public.clubs add column category text;
alter table public.clubs add constraint clubs_category_length
  check (category is null or char_length(category) between 2 and 40);

-- ---------------------------------------------------------------------
-- Storage: bucket privado, imágenes de hasta 5 MB
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-covers', 'club-covers', false, 5242880,   -- 5 MB
        array['image/jpeg', 'image/png', 'image/webp']);

-- Lectura: miembros confirmados del club, solo en la carpeta de su club.
create policy club_covers_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'club-covers'
    and (storage.foldername(name))[1] = private.current_club_id()::text
  );

-- Escritura: solo la dirección, en la carpeta de su club.
create policy club_covers_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'club-covers'
    and (storage.foldername(name))[1] = private.current_club_id()::text
    and private.is_direction()
  );

create policy club_covers_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'club-covers'
    and (storage.foldername(name))[1] = private.current_club_id()::text
    and private.is_direction()
  )
  with check (
    bucket_id = 'club-covers'
    and (storage.foldername(name))[1] = private.current_club_id()::text
    and private.is_direction()
  );

create policy club_covers_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'club-covers'
    and (storage.foldername(name))[1] = private.current_club_id()::text
    and private.is_direction()
  );

-- ---------------------------------------------------------------------
-- La dirección fija (o quita, con NULL) la portada de su club
-- ---------------------------------------------------------------------
create function public.set_club_cover(p_path text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_club uuid := private.current_club_id();
begin
  if (select auth.uid()) is null or v_club is null or not private.is_direction() then
    raise exception 'No tienes permiso para esta acción';
  end if;

  if p_path is not null then
    if p_path not like v_club::text || '/%' then
      raise exception 'Ruta de portada inválida';
    end if;
    if not exists (select 1 from storage.objects where bucket_id = 'club-covers' and name = p_path) then
      raise exception 'La portada no se subió correctamente';
    end if;
  end if;

  update public.clubs set cover_path = p_path where id = v_club;
end $$;

revoke all on function public.set_club_cover(text) from public, anon, authenticated;
grant execute on function public.set_club_cover(text) to authenticated;

-- ---------------------------------------------------------------------
-- La dirección fija (o quita, con NULL o texto vacío) la categoría de su club
-- ---------------------------------------------------------------------
create function public.set_club_category(p_category text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_club uuid := private.current_club_id();
  v_category text := nullif(trim(p_category), '');
begin
  if (select auth.uid()) is null or v_club is null or not private.is_direction() then
    raise exception 'No tienes permiso para esta acción';
  end if;

  if v_category is not null and char_length(v_category) not between 2 and 40 then
    raise exception 'La categoría debe tener entre 2 y 40 caracteres';
  end if;

  update public.clubs set category = v_category where id = v_club;
end $$;

revoke all on function public.set_club_category(text) from public, anon, authenticated;
grant execute on function public.set_club_category(text) to authenticated;
