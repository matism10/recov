-- Recov · 0021 · Logo del club
-- Ejecutar DESPUÉS de 0020.
--
-- La dirección (head coach y manager) sube el logo de su club desde Configuración.
--   Ruta en Storage: club-logos/{club_id}/{archivo}
--   Quién lo ve:     cualquiera, también sin sesión (se muestra en el link de registro
--                    /c/[slug]); el bucket es público y solo guarda logos.
--   Quién lo sube:   solo la dirección confirmada, en la carpeta de su propio club.

-- ---------------------------------------------------------------------
-- Clubes: ruta del logo
-- ---------------------------------------------------------------------
alter table public.clubs add column logo_path text;
alter table public.clubs add constraint clubs_logo_path_format
  check (logo_path like id::text || '/%');

-- ---------------------------------------------------------------------
-- Storage: bucket público, imágenes chicas
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-logos', 'club-logos', true, 1048576,   -- 1 MB
        array['image/png', 'image/jpeg', 'image/webp']);

-- La lectura es pública (bucket public). Escritura: solo la dirección, en su club.
create policy club_logos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'club-logos'
    and (storage.foldername(name))[1] = private.current_club_id()::text
    and private.is_direction()
  );

create policy club_logos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'club-logos'
    and (storage.foldername(name))[1] = private.current_club_id()::text
    and private.is_direction()
  )
  with check (
    bucket_id = 'club-logos'
    and (storage.foldername(name))[1] = private.current_club_id()::text
    and private.is_direction()
  );

create policy club_logos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'club-logos'
    and (storage.foldername(name))[1] = private.current_club_id()::text
    and private.is_direction()
  );

-- ---------------------------------------------------------------------
-- La dirección fija (o quita, con NULL) el logo de su club
-- ---------------------------------------------------------------------
create or replace function public.set_club_logo(p_path text)
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
      raise exception 'Ruta de logo inválida';
    end if;
    if not exists (select 1 from storage.objects where bucket_id = 'club-logos' and name = p_path) then
      raise exception 'El logo no se subió correctamente';
    end if;
  end if;

  update public.clubs set logo_path = p_path where id = v_club;
end $$;

revoke all on function public.set_club_logo(text) from public, anon, authenticated;
grant execute on function public.set_club_logo(text) to authenticated;

-- ---------------------------------------------------------------------
-- Logo para el link de registro (sin sesión): solo la ruta, nada más del club
-- ---------------------------------------------------------------------
create or replace function public.club_logo_path(p_slug text)
returns text
language sql stable security definer set search_path = ''
as $$
  select c.logo_path from public.clubs c where c.slug = lower(trim(p_slug))
$$;

revoke all on function public.club_logo_path(text) from public, anon, authenticated;
grant execute on function public.club_logo_path(text) to anon, authenticated;
