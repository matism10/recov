-- Recov · 0007 · Foto de perfil (opcional)
-- Ejecutar DESPUÉS de 0006.
--
-- Cualquier persona (jugador o staff) puede agregar una foto al registrarse.
--   Ruta en Storage: avatars/{club_id}/{profile_id}/{archivo}
--   Quién la ve:     quien puede ver ese perfil (misma regla que profiles_select:
--                    el propio usuario, los confirmados del club y, para pendientes, la dirección).
--   Quién la sube:   solo el dueño, en su propia carpeta, aunque esté pendiente
--                    (el registro ocurre antes de la confirmación).

-- ---------------------------------------------------------------------
-- Perfiles: ruta de la foto
-- ---------------------------------------------------------------------
alter table public.profiles add column avatar_path text;
alter table public.profiles add constraint profiles_avatar_path_format
  check (avatar_path like club_id::text || '/' || id::text || '/%');

-- ---------------------------------------------------------------------
-- Storage: bucket privado, imágenes chicas
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152,   -- 2 MB
        array['image/jpeg', 'image/png', 'image/webp']);

-- Lectura: la foto se ve si el perfil se ve. La subconsulta corre con el RLS de profiles.
create policy avatars_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and exists (
      select 1 from public.profiles p
       where p.id::text      = (storage.foldername(name))[2]
         and p.club_id::text = (storage.foldername(name))[1])
  );

create policy avatars_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = private.member_club_id()::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy avatars_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = private.member_club_id()::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = private.member_club_id()::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy avatars_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = private.member_club_id()::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------
-- El usuario fija (o quita, con NULL) su propia foto
-- ---------------------------------------------------------------------
create or replace function public.set_my_avatar(p_path text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_club uuid := private.member_club_id();
begin
  if v_uid is null or v_club is null then raise exception 'Debes estar registrado en un club'; end if;

  if p_path is not null then
    if p_path not like v_club::text || '/' || v_uid::text || '/%' then
      raise exception 'Ruta de foto inválida';
    end if;
    if not exists (select 1 from storage.objects where bucket_id = 'avatars' and name = p_path) then
      raise exception 'La foto no se subió correctamente';
    end if;
  end if;

  update public.profiles set avatar_path = p_path where id = v_uid;
end $$;

revoke all on function public.set_my_avatar(text) from public, anon, authenticated;
grant execute on function public.set_my_avatar(text) to authenticated;
