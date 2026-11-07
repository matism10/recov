-- Recov · Notificaciones (2d): cuenta, registros, Sevens, posición y funciones asignadas
-- (14, 15, 16, 17, 20 y 23). Cada función se copia de su definición actual en la base
-- (misma firma) y solo se le agrega el aviso. La salida del staff no se avisa.

-- 14 · Registro aprobado (el rechazado no llega al Resumen). Descarta "registro nuevo" (20)
-- para toda la dirección al decidir.
CREATE OR REPLACE FUNCTION public.review_member(p_profile_id uuid, p_decision text, p_roles user_role[] DEFAULT NULL::user_role[], p_club_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_club   uuid := private.resolve_club(p_club_id);
  v_target public.club_members%rowtype;
  v_roles  public.user_role[];
  v_status public.member_status;
begin
  if v_club is null or not private.has_perm(v_club, 'registros_aprobar') then raise exception 'No tienes permiso para esta acción'; end if;
  if p_profile_id = (select auth.uid()) then raise exception 'No puedes modificar tu propio perfil'; end if;
  if p_decision not in ('confirmar', 'rechazar') then raise exception 'Decisión inválida'; end if;

  select * into v_target from public.club_members where user_id = p_profile_id and club_id = v_club;
  if not found then raise exception 'Perfil no encontrado'; end if;
  if v_target.status <> 'pendiente' then raise exception 'Este perfil ya fue revisado'; end if;

  v_status := case when p_decision = 'confirmar' then 'confirmado' else 'rechazado' end::public.member_status;

  if exists (select 1 from public.players where user_id = p_profile_id and club_id = v_club) then
    update public.players set status = v_status where user_id = p_profile_id and club_id = v_club;
    update public.club_members set status = v_status where user_id = p_profile_id and club_id = v_club;
  elsif p_decision = 'confirmar' then
    v_roles := coalesce(p_roles,
                        case when v_target.requested_role is null then null
                             else array[v_target.requested_role] end);
    if v_roles is null or cardinality(v_roles) = 0 or not (v_roles <@ private.staff_roles()) then
      raise exception 'Roles de staff inválidos';
    end if;
    if 'head_coach' = any (v_roles) and not private.has_role(v_club, 'head_coach') then
      raise exception 'Solo un head coach puede aprobar a alguien como head coach';
    end if;
    update public.club_members set status = 'confirmado', roles = v_roles
     where user_id = p_profile_id and club_id = v_club;
  else
    update public.club_members set status = 'rechazado', roles = '{}'
     where user_id = p_profile_id and club_id = v_club;
  end if;

  perform private.dismiss_notification_keys(v_club, array['registro:' || p_profile_id]);
  if p_decision = 'confirmar' then
    perform private.notify(
      v_club, p_profile_id, 'registro_aprobado',
      jsonb_build_object('roles', (select to_jsonb(m.roles) from public.club_members m
                                    where m.user_id = p_profile_id and m.club_id = v_club)));
  end if;
end $function$;

-- 15 · Cambio de roles de quien sigue en el staff (la salida no se avisa)
CREATE OR REPLACE FUNCTION public.set_staff_roles(p_profile_id uuid, p_roles user_role[], p_club_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_club   uuid := private.resolve_club(p_club_id);
  v_me     uuid := (select auth.uid());
  v_target public.club_members%rowtype;
  v_was_hc boolean;
  v_is_hc  boolean;
begin
  if v_club is null or not private.has_perm(v_club, 'staff_gestionar') then
    raise exception 'No tienes permiso para esta acción';
  end if;
  if p_profile_id = v_me then raise exception 'No puedes modificar tu propio perfil'; end if;

  select * into v_target from public.club_members where user_id = p_profile_id and club_id = v_club;
  if not found then raise exception 'Perfil no encontrado'; end if;
  if v_target.status <> 'confirmado' then raise exception 'Solo se pueden cambiar los roles de miembros confirmados'; end if;
  if exists (select 1 from public.players where user_id = p_profile_id and club_id = v_club) then
    raise exception 'Los jugadores no tienen rol de staff';
  end if;
  if p_roles is null or not (p_roles <@ private.staff_roles()) then raise exception 'Roles de staff inválidos'; end if;

  v_was_hc := 'head_coach' = any (v_target.roles);
  v_is_hc  := 'head_coach' = any (p_roles);

  if v_target.is_principal then
    raise exception 'No se puede modificar al head coach principal';
  end if;
  if v_was_hc <> v_is_hc and not private.has_role(v_club, 'head_coach') then
    raise exception 'Solo un head coach puede nombrar o quitar a un head coach';
  end if;
  if v_was_hc and not exists (select 1 from public.club_members
                               where club_id = v_club and user_id = v_me and is_principal) then
    raise exception 'Solo el head coach principal puede modificar a otro head coach';
  end if;
  if v_was_hc and not v_is_hc and not exists (
       select 1 from public.club_members
        where club_id = v_club and user_id <> p_profile_id and status = 'confirmado'
          and 'head_coach' = any (roles)) then
    raise exception 'El club debe tener al menos un head coach';
  end if;

  if cardinality(p_roles) = 0 then
    update public.club_members set roles = '{}', status = 'rechazado'
     where user_id = p_profile_id and club_id = v_club;
    update public.clubs set kine_delegate_id = null where id = v_club and kine_delegate_id = p_profile_id;
    update public.clubs set nomina_delegate_id = null where id = v_club and nomina_delegate_id = p_profile_id;
    update public.member_permissions set archived_at = now()
     where club_id = v_club and user_id = p_profile_id and archived_at is null;
  else
    update public.club_members set roles = p_roles where user_id = p_profile_id and club_id = v_club;

    if not (v_target.roles @> p_roles and p_roles @> v_target.roles) then
      perform private.notify(
        v_club, p_profile_id, 'roles_cambio',
        jsonb_build_object('roles', to_jsonb(p_roles), 'prev_roles', to_jsonb(v_target.roles)),
        'roles');
    end if;
  end if;
end $function$;

-- 20 · Registro nuevo pendiente (a quien aprueba registros o gestiona el staff)
CREATE OR REPLACE FUNCTION public.register_member(p_club_slug text, p_kind text, p_first_name text, p_last_name text, p_position text DEFAULT NULL::text, p_secondary_position text DEFAULT NULL::text, p_height_cm integer DEFAULT NULL::integer, p_weight_kg numeric DEFAULT NULL::numeric, p_requested_role user_role DEFAULT NULL::user_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid         uuid := (select auth.uid());
  v_club_id     uuid;
  v_sport       text;
  v_first       text := trim(coalesce(p_first_name, ''));
  v_last        text := trim(coalesce(p_last_name, ''));
  v_has_profile boolean;
  v_payload     jsonb;
begin
  if v_uid is null then raise exception 'Debes iniciar sesión'; end if;

  select id, sport into v_club_id, v_sport from public.clubs where slug = lower(trim(p_club_slug));
  if v_club_id is null then raise exception 'Club no encontrado'; end if;

  if exists (select 1 from public.club_members where user_id = v_uid and club_id = v_club_id) then
    raise exception 'Ya tienes una solicitud o una cuenta en este plantel';
  end if;

  if v_first = '' or v_last = '' or length(v_first) > 100 or length(v_last) > 100 then
    raise exception 'Nombre y apellido son obligatorios (máximo 100 caracteres)';
  end if;

  v_has_profile := exists (select 1 from public.profiles where id = v_uid);

  if p_kind = 'jugador' then
    if p_position is null
       or not exists (select 1 from public.positions where sport = v_sport and name = p_position) then
      raise exception 'Posición principal inválida';
    end if;
    if p_secondary_position is not null
       and (p_secondary_position = p_position
            or not exists (select 1 from public.positions where sport = v_sport and name = p_secondary_position)) then
      raise exception 'Posición secundaria inválida';
    end if;

    if not v_has_profile then
      insert into public.profiles (id, full_name) values (v_uid, v_first || ' ' || v_last);
    end if;

    insert into public.club_members (user_id, club_id, roles, status)
    values (v_uid, v_club_id, '{jugador}', 'pendiente');

    insert into public.players (club_id, full_name, first_name, last_name, position,
                                secondary_position, height_cm, weight_kg, user_id, status)
    values (v_club_id, v_first || ' ' || v_last, v_first, v_last, p_position,
            p_secondary_position, p_height_cm, p_weight_kg, v_uid, 'pendiente');

  elsif p_kind = 'staff' then
    if p_requested_role is null
       or p_requested_role not in ('kinesiologo', 'entrenador', 'nutricionista', 'preparador_fisico') then
      raise exception 'Puesto inválido';
    end if;

    if not v_has_profile then
      insert into public.profiles (id, full_name) values (v_uid, v_first || ' ' || v_last);
    end if;

    insert into public.club_members (user_id, club_id, roles, status, requested_role)
    values (v_uid, v_club_id, '{}', 'pendiente', p_requested_role);

  else
    raise exception 'Tipo de registro inválido';
  end if;

  v_payload := jsonb_build_object('user_id', v_uid, 'name', v_first || ' ' || v_last,
                                  'kind', p_kind, 'requested_role', p_requested_role);
  -- Misma clave: quien tiene los dos permisos recibe una sola.
  perform private.notify_perm(v_club_id, 'registros_aprobar', 'registro_pendiente', v_payload, 'registro:' || v_uid);
  perform private.notify_perm(v_club_id, 'staff_gestionar', 'registro_pendiente', v_payload, 'registro:' || v_uid);
end $function$;

-- 16 · Agregado al Grupo Sevens (solo a los recién agregados; solo rugby tiene Sevens)
CREATE OR REPLACE FUNCTION public.set_sevens_group(p_member_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_club uuid := private.current_club_id();
  v_ids  uuid[];
  v_before uuid[];
begin
  if v_club is null or not private.has_perm(v_club, 'sevens_grupo') then
    raise exception 'No tienes permiso para esta acción' using errcode = '42501';
  end if;
  if not exists (select 1 from public.clubs where id = v_club and has_sevens) then
    raise exception 'El club no tiene Sevens activado';
  end if;

  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(coalesce(p_member_ids, '{}')) x;
  if exists (
    select 1 from unnest(v_ids) as x(id)
     where not exists (
       select 1 from public.club_members m
        where m.user_id = x.id and m.club_id = v_club and m.status = 'confirmado'))
  then
    raise exception 'Solo se pueden agregar miembros confirmados del club';
  end if;

  select coalesce(array_agg(g.member_id), '{}') into v_before
    from public.sevens_group g where g.club_id = v_club and g.archived_at is null;

  update public.sevens_group g
     set archived_at = now()
   where g.club_id = v_club and g.archived_at is null and not (g.member_id = any (v_ids));

  insert into public.sevens_group (club_id, member_id)
  select v_club, x from unnest(v_ids) x
  on conflict (club_id, member_id) do update
    set archived_at = null, added_at = now()
    where public.sevens_group.archived_at is not null;

  perform private.notify(v_club, x.id, 'sevens_agregado', '{}'::jsonb, 'sevens')
     from unnest(v_ids) as x(id)
    where not (x.id = any (v_before));
end $function$;

-- 16 · Agregado al Grupo Sevens (staff, desde /staff)
CREATE OR REPLACE FUNCTION public.set_staff_sevens(p_member_id uuid, p_enabled boolean, p_club_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_club uuid := private.resolve_club(p_club_id);
  v_was  boolean;
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

  v_was := exists (select 1 from public.sevens_group
                    where club_id = v_club and member_id = p_member_id and archived_at is null);

  if p_enabled then
    insert into public.sevens_group (club_id, member_id) values (v_club, p_member_id)
    on conflict (club_id, member_id) do update
      set archived_at = null, added_at = now()
      where public.sevens_group.archived_at is not null;
    if not v_was then
      perform private.notify(v_club, p_member_id, 'sevens_agregado', '{}'::jsonb, 'sevens');
    end if;
  else
    update public.sevens_group set archived_at = now()
     where club_id = v_club and member_id = p_member_id and archived_at is null;
  end if;
end $function$;

-- 17 · "Tu posición cambió a X": cuerpo del enganche que llama set_player_positions.
CREATE OR REPLACE FUNCTION private.on_player_position_changed(p_player_id uuid, p_old_position text, p_new_position text, p_old_secondary text, p_new_secondary text, p_old_sevens text, p_new_sevens text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_club uuid;
begin
  select club_id into v_club from public.players where id = p_player_id;
  if v_club is null then return; end if;
  perform private.notify_players(
    v_club, array[p_player_id], 'posicion_cambio',
    jsonb_build_object('position', p_new_position, 'prev_position', p_old_position,
                       'secondary', p_new_secondary, 'prev_secondary', p_old_secondary,
                       'sevens_position', p_new_sevens, 'prev_sevens_position', p_old_sevens),
    'posicion');
end $function$;

-- 23 · Función asignada: delegado de kinesiólogo
CREATE OR REPLACE FUNCTION public.set_kine_delegate(p_profile_id uuid, p_club_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_club   uuid := private.resolve_club(p_club_id);
  v_target public.club_members%rowtype;
  v_prev   uuid;
begin
  if v_club is null or not private.has_perm(v_club, 'staff_gestionar') then raise exception 'No tienes permiso para esta acción'; end if;

  if p_profile_id is null then
    update public.clubs set kine_delegate_id = null where id = v_club;
    return;
  end if;

  select * into v_target from public.club_members
   where user_id = p_profile_id and club_id = v_club and status = 'confirmado';
  if not found or not (v_target.roles && private.staff_roles()) then
    raise exception 'La persona debe ser parte del staff confirmado';
  end if;

  select kine_delegate_id into v_prev from public.clubs where id = v_club;
  update public.clubs set kine_delegate_id = p_profile_id where id = v_club;

  if v_prev is distinct from p_profile_id then
    perform private.notify(v_club, p_profile_id, 'funcion_asignada',
                           jsonb_build_object('funcion', 'kine'), 'funcion:kine');
  end if;
end $function$;

-- 23 · Función asignada: delegado de nóminas
CREATE OR REPLACE FUNCTION public.set_nomina_delegate(p_profile_id uuid, p_club_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_club   uuid := private.resolve_club(p_club_id);
  v_target public.club_members%rowtype;
  v_prev   uuid;
begin
  if v_club is null or not private.has_perm(v_club, 'staff_gestionar') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_profile_id is null then
    update public.clubs set nomina_delegate_id = null where id = v_club;
    return;
  end if;

  select * into v_target from public.club_members
   where user_id = p_profile_id and club_id = v_club and status = 'confirmado';
  if not found or not (v_target.roles && private.staff_roles()) then
    raise exception 'La persona debe ser parte del staff confirmado';
  end if;

  select nomina_delegate_id into v_prev from public.clubs where id = v_club;
  update public.clubs set nomina_delegate_id = p_profile_id where id = v_club;

  if v_prev is distinct from p_profile_id then
    perform private.notify(v_club, p_profile_id, 'funcion_asignada',
                           jsonb_build_object('funcion', 'nominas'), 'funcion:nominas');
  end if;
end $function$;
