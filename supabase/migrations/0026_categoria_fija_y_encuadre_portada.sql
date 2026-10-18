-- Recov · 0026 · Categoría fija y encuadre de la portada
-- Ejecutar DESPUÉS de 0025.
--
-- Categoría: la definimos nosotros al crear la cuenta del club (por SQL), no la
--            dirección. set_club_category queda sin permisos para nadie (no se
--            borra); clubs.category y su CHECK siguen igual.
-- Encuadre:  la dirección mueve la portada dentro del encabezado. Se guarda como
--            object-position en porcentaje (0–100, horizontal y vertical); por
--            defecto, centrada. Al subir una portada nueva vuelve al centro.
-- No hay escritura directa: clubs no tiene política de UPDATE.

revoke all on function public.set_club_category(text) from public, anon, authenticated;

alter table public.clubs
  add column cover_position_x smallint not null default 50,
  add column cover_position_y smallint not null default 50;
alter table public.clubs add constraint clubs_cover_position_range
  check (cover_position_x between 0 and 100 and cover_position_y between 0 and 100);

-- ---------------------------------------------------------------------
-- set_club_cover: igual que en 0025, y una portada nueva vuelve al centro
-- ---------------------------------------------------------------------
create or replace function public.set_club_cover(p_path text)
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

  update public.clubs
     set cover_path = p_path, cover_position_x = 50, cover_position_y = 50
   where id = v_club;
end $$;

revoke all on function public.set_club_cover(text) from public, anon, authenticated;
grant execute on function public.set_club_cover(text) to authenticated;

-- ---------------------------------------------------------------------
-- La dirección encuadra la portada de su club
-- ---------------------------------------------------------------------
create function public.set_club_cover_position(p_x integer, p_y integer)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_club uuid := private.current_club_id();
begin
  if (select auth.uid()) is null or v_club is null or not private.is_direction() then
    raise exception 'No tienes permiso para esta acción';
  end if;

  if p_x is null or p_y is null or p_x not between 0 and 100 or p_y not between 0 and 100 then
    raise exception 'Posición de portada inválida';
  end if;

  if not exists (select 1 from public.clubs where id = v_club and cover_path is not null) then
    raise exception 'El club no tiene portada';
  end if;

  update public.clubs
     set cover_position_x = p_x, cover_position_y = p_y
   where id = v_club;
end $$;

revoke all on function public.set_club_cover_position(integer, integer) from public, anon, authenticated;
grant execute on function public.set_club_cover_position(integer, integer) to authenticated;
