-- Recov · Permisos del staff, fase 2b: cambio de posición y "Participa en Sevens".
-- - set_player_positions: quien tiene posicion_cambiar (por defecto el head coach) cambia
--   la posición principal y secundaria de un jugador y, en rugby con Sevens, la de Sevens
--   si el jugador está en el grupo. Los triggers de siempre validan las posiciones
--   (players_validate_position para el 15 y validate_sevens_position para el 7).
-- - private.on_player_position_changed: enganche para la notificación "Tu posición cambió
--   a X" (fase 3). Por ahora no hace nada.
-- - set_staff_sevens: agrega o quita a una persona del staff del grupo Sevens (archiva; al
--   volver conserva su posición). Permiso sevens_grupo (no delegable: head coach y manager).

-- ---------------------------------------------------------------------------
-- 1. Enganche para la notificación (fase 3)
-- ---------------------------------------------------------------------------
create function private.on_player_position_changed(
  p_player_id uuid,
  p_old_position text, p_new_position text,
  p_old_secondary text, p_new_secondary text,
  p_old_sevens text, p_new_sevens text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Fase 3: avisar al jugador (si tiene cuenta) "Tu posición cambió a X".
  return;
end $$;
revoke all on function private.on_player_position_changed(uuid, text, text, text, text, text, text) from public;

-- ---------------------------------------------------------------------------
-- 2. Cambio de posición desde la ficha
-- ---------------------------------------------------------------------------
-- p_sevens_position null = no tocar la posición de Sevens.
create function public.set_player_positions(
  p_player_id uuid,
  p_position text,
  p_secondary text default null,
  p_sevens_position text default null,
  p_sevens_secondary text default null,
  p_club_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_club   uuid := private.resolve_club(p_club_id);
  v_player public.players%rowtype;
  v_group  public.sevens_group%rowtype;
  v_pos    text := nullif(btrim(p_position), '');
  v_sec    text := nullif(btrim(p_secondary), '');
  v_7      text := nullif(btrim(p_sevens_position), '');
  v_7sec   text := nullif(btrim(p_sevens_secondary), '');
begin
  if v_club is null or not private.has_perm(v_club, 'posicion_cambiar') then
    raise exception 'No tienes permiso para esta acción' using errcode = '42501';
  end if;

  select * into v_player from public.players
   where id = p_player_id and club_id = v_club and status = 'confirmado';
  if not found then raise exception 'Jugador no encontrado'; end if;

  if v_pos is null then raise exception 'Elige la posición principal'; end if;
  if v_sec is not null and v_sec = v_pos then
    raise exception 'La posición secundaria debe ser distinta de la principal';
  end if;

  if v_7 is not null or v_7sec is not null then
    if v_player.user_id is not null
       and exists (select 1 from public.clubs where id = v_club and has_sevens) then
      select * into v_group from public.sevens_group
       where club_id = v_club and member_id = v_player.user_id and archived_at is null;
    end if;
    if v_group.id is null then raise exception 'El jugador no está en el grupo Sevens'; end if;
    if v_7 is null then raise exception 'Elige la posición principal en Sevens'; end if;
    if v_7sec is not null and v_7sec = v_7 then
      raise exception 'La posición secundaria de Sevens debe ser distinta de la principal';
    end if;
  end if;

  -- El trigger players_validate_position valida el deporte y el formato 15.
  update public.players set position = v_pos, secondary_position = v_sec where id = v_player.id;
  -- El trigger de sevens_group valida el formato 7.
  if v_group.id is not null then
    update public.sevens_group set position = v_7, secondary_position = v_7sec where id = v_group.id;
  end if;

  if v_pos is distinct from v_player.position or v_sec is distinct from v_player.secondary_position
     or (v_group.id is not null and v_7 is distinct from v_group.position) then
    perform private.on_player_position_changed(
      v_player.id, v_player.position, v_pos, v_player.secondary_position, v_sec,
      v_group.position, case when v_group.id is null then v_group.position else v_7 end);
  end if;
end $$;
revoke all on function public.set_player_positions(uuid, text, text, text, text, uuid) from public, anon;
grant execute on function public.set_player_positions(uuid, text, text, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. "Participa en Sevens" para el staff (/staff/[id])
-- ---------------------------------------------------------------------------
create function public.set_staff_sevens(p_member_id uuid, p_enabled boolean, p_club_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_club uuid := private.resolve_club(p_club_id);
begin
  if v_club is null or not private.has_perm(v_club, 'sevens_grupo') then
    raise exception 'No tienes permiso para esta acción' using errcode = '42501';
  end if;
  if p_enabled is null then raise exception 'Indica si participa en Sevens'; end if;
  if not exists (select 1 from public.clubs where id = v_club and has_sevens) then
    raise exception 'El club no tiene Sevens activado';
  end if;
  if not exists (select 1 from public.club_members
                  where user_id = p_member_id and club_id = v_club and status = 'confirmado'
                    and roles && private.staff_roles()) then
    raise exception 'La persona debe ser parte del staff confirmado';
  end if;

  if p_enabled then
    insert into public.sevens_group (club_id, member_id) values (v_club, p_member_id)
    on conflict (club_id, member_id) do update
      set archived_at = null, added_at = now()
      where public.sevens_group.archived_at is not null;
  else
    update public.sevens_group set archived_at = now()
     where club_id = v_club and member_id = p_member_id and archived_at is null;
  end if;
end $$;
revoke all on function public.set_staff_sevens(uuid, boolean, uuid) from public, anon;
grant execute on function public.set_staff_sevens(uuid, boolean, uuid) to authenticated;
