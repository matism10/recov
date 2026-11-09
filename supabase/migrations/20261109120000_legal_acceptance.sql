-- Aceptación de términos y declaración de autorización de apoderados.
-- Sin escritura directa: profiles y clubs solo tienen políticas SELECT; las columnas
-- nuevas se escriben únicamente por estas funciones (SECURITY DEFINER).

alter table public.profiles
  add column terms_accepted_at timestamptz,
  add column terms_version text;

alter table public.clubs
  add column guardian_declared_at timestamptz,
  add column guardian_declared_by uuid references auth.users (id);

-- Acepta los términos con la fila propia. La versión es la de src/lib/legal/content.ts.
create or replace function public.accept_terms(p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'Debes iniciar sesión'; end if;
  if p_version is null or p_version !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Versión inválida' using errcode = '22023';
  end if;
  update public.profiles
     set terms_accepted_at = now(), terms_version = p_version
   where id = v_uid;
  if not found then raise exception 'Perfil no encontrado'; end if;
end;
$$;
revoke all on function public.accept_terms(text) from public, anon;
grant execute on function public.accept_terms(text) to authenticated;

-- Declaración del plantel activo (head coach y manager: staff_gestionar). Idempotente:
-- si ya estaba declarada, no cambia la fecha ni quién la hizo.
create or replace function public.declare_guardian_authorization()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_club uuid := private.active_club_id();
begin
  if v_uid is null then raise exception 'Debes iniciar sesión'; end if;
  if v_club is null or not private.has_perm(v_club, 'staff_gestionar') then
    raise exception 'No tienes permiso para declarar por el plantel' using errcode = '42501';
  end if;
  update public.clubs
     set guardian_declared_at = now(), guardian_declared_by = v_uid
   where id = v_club and guardian_declared_at is null;
end;
$$;
revoke all on function public.declare_guardian_authorization() from public, anon;
grant execute on function public.declare_guardian_authorization() to authenticated;

-- register_member (9 argumentos, sin cambiar la firma): ahora exige que la cuenta ya
-- haya aceptado los términos. Es el camino de "Únete a este plantel" (cuenta existente).
create or replace function public.register_member(
  p_club_slug text, p_kind text, p_first_name text, p_last_name text,
  p_position text default null, p_secondary_position text default null,
  p_height_cm integer default null, p_weight_kg numeric default null,
  p_requested_role public.user_role default null)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_uid         uuid := (select auth.uid());
  v_club_id     uuid;
  v_sport       text;
  v_first       text := trim(coalesce(p_first_name, ''));
  v_last        text := trim(coalesce(p_last_name, ''));
  v_has_profile boolean;
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
end $function$;

-- register_member (10 argumentos): registro nuevo con la aceptación en la misma
-- transacción. Crea el perfil con la aceptación y llama a la función de arriba; si esa
-- falla, todo se revierte.
create function public.register_member(
  p_club_slug text, p_kind text, p_first_name text, p_last_name text,
  p_position text, p_secondary_position text,
  p_height_cm integer, p_weight_kg numeric,
  p_requested_role public.user_role,
  p_terms_version text)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_uid   uuid := (select auth.uid());
  v_first text := trim(coalesce(p_first_name, ''));
  v_last  text := trim(coalesce(p_last_name, ''));
begin
  if v_uid is null then raise exception 'Debes iniciar sesión'; end if;
  if p_terms_version is null or p_terms_version !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Debes aceptar los términos de uso y la política de privacidad';
  end if;
  if v_first = '' or v_last = '' or length(v_first) > 100 or length(v_last) > 100 then
    raise exception 'Nombre y apellido son obligatorios (máximo 100 caracteres)';
  end if;

  insert into public.profiles (id, full_name, terms_accepted_at, terms_version)
  values (v_uid, v_first || ' ' || v_last, now(), p_terms_version)
  on conflict (id) do update
    set terms_accepted_at = excluded.terms_accepted_at, terms_version = excluded.terms_version;

  perform public.register_member(p_club_slug, p_kind, p_first_name, p_last_name,
    p_position, p_secondary_position, p_height_cm, p_weight_kg, p_requested_role);
end $function$;

revoke all on function public.register_member(text, text, text, text, text, text, integer, numeric, public.user_role, text) from public, anon;
grant execute on function public.register_member(text, text, text, text, text, text, integer, numeric, public.user_role, text) to authenticated;
