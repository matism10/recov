-- Recov · Arreglo: la migración legal (20261109120000) reemplazó register_member de 9 argumentos y
-- quitó el aviso "registro_pendiente" (20261107184000) a la dirección. Misma función, con los dos
-- private.notify_perm de vuelta al final. Sin cambios de firma ni de permisos.
create or replace function public.register_member(p_club_slug text, p_kind text, p_first_name text, p_last_name text, p_position text DEFAULT NULL::text, p_secondary_position text DEFAULT NULL::text, p_height_cm integer DEFAULT NULL::integer, p_weight_kg numeric DEFAULT NULL::numeric, p_requested_role public.user_role DEFAULT NULL::public.user_role)
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

  if not exists (select 1 from public.profiles where id = v_uid and terms_accepted_at is not null) then
    raise exception 'Debes aceptar los términos de uso y la política de privacidad';
  end if;

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
