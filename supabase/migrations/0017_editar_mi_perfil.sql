-- Recov · 0017 · El usuario edita su propio perfil
-- Ejecutar DESPUÉS de 0016 (en una consulta aparte). No cambia enums ni políticas.
--
-- update_my_profile: cada usuario confirmado actualiza solo sus propios datos.
--   * Todos: nombre y apellido (profiles.full_name).
--   * Jugador: además first_name, last_name, full_name, posición principal y secundaria,
--     altura y peso en su fila de players. La posición la valida además el trigger de 0016
--     contra el catálogo del deporte del club.
-- La foto sigue por set_my_avatar (0007) y la contraseña por Supabase Auth.

create or replace function public.update_my_profile(
  p_first_name         text,
  p_last_name          text,
  p_position           text default null,
  p_secondary_position text default null,
  p_height_cm          int default null,
  p_weight_kg          numeric default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_first text := trim(coalesce(p_first_name, ''));
  v_last  text := trim(coalesce(p_last_name, ''));
  v_pos   text := nullif(trim(coalesce(p_position, '')), '');
  v_sec   text := nullif(trim(coalesce(p_secondary_position, '')), '');
begin
  if v_uid is null or private.current_club_id() is null then
    raise exception 'No tienes permiso para esta acción';
  end if;

  if v_first = '' or v_last = '' or length(v_first) > 100 or length(v_last) > 100 then
    raise exception 'Nombre y apellido son obligatorios (máximo 100 caracteres)';
  end if;

  update public.profiles
     set full_name = v_first || ' ' || v_last
   where id = v_uid;

  if exists (select 1 from public.players where user_id = v_uid) then
    if v_pos is null then raise exception 'La posición principal es obligatoria'; end if;
    if v_sec is not null and v_sec = v_pos then
      raise exception 'La posición secundaria debe ser distinta de la principal';
    end if;
    if p_height_cm is not null and (p_height_cm < 100 or p_height_cm > 250) then
      raise exception 'La altura debe estar entre 100 y 250 cm';
    end if;
    if p_weight_kg is not null and (p_weight_kg < 30 or p_weight_kg > 250) then
      raise exception 'El peso debe estar entre 30 y 250 kg';
    end if;

    update public.players
       set first_name         = v_first,
           last_name          = v_last,
           full_name          = v_first || ' ' || v_last,
           position           = v_pos,
           secondary_position = v_sec,
           height_cm          = p_height_cm,
           weight_kg          = p_weight_kg
     where user_id = v_uid;
  end if;
end $$;

revoke all on function public.update_my_profile(text, text, text, text, int, numeric) from public, anon, authenticated;
grant execute on function public.update_my_profile(text, text, text, text, int, numeric) to authenticated;
