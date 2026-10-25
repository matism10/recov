-- Recov · 0043 · Multi-plantel (fase "contract"): profiles queda como identidad pura
-- de la cuenta (id, full_name, avatar_path, email_verified_at, created_at). El plantel,
-- los roles, el estado y el puesto pedido viven solo en club_members.

-- Guarda: no continuar si algún perfil no tiene su membresía idéntica en club_members
do $$
begin
  if exists (
    select 1 from public.profiles p
     where not exists (
       select 1 from public.club_members m
        where m.user_id = p.id and m.club_id = p.club_id
          and m.roles = p.roles and m.status = p.status
          and m.requested_role is not distinct from p.requested_role)
  ) then
    raise exception 'Hay perfiles sin su membresía idéntica en club_members: no se eliminan las columnas';
  end if;
end $$;

-- Respaldo temporal de las columnas que se eliminan (se borra en una migración posterior)
create table private.profiles_legacy_backup as
  select id, club_id, roles, status, requested_role from public.profiles;
revoke all on table private.profiles_legacy_backup from public, anon, authenticated;

-- Plantel por defecto (sin header x-club-id): la membresía confirmada más antigua; si no hay confirmada, la más antigua
create or replace function private.active_club_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  with h as (
    select nullif(nullif(current_setting('request.headers', true), '')::json ->> 'x-club-id', '') as v
  )
  select case
    when h.v is null then (
      select m.club_id from public.club_members m
       where m.user_id = (select auth.uid())
       order by (m.status = 'confirmado') desc, m.created_at, m.club_id
       limit 1)
    else (select m.club_id from public.club_members m
           where m.user_id = (select auth.uid()) and m.club_id = private.safe_uuid(h.v))
  end
  from h
$$;

-- register_member: el perfil solo guarda la identidad; todo lo del plantel va a club_members
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

-- create_email_verification: el club del token sale de la membresía más antigua
create or replace function public.create_email_verification(p_profile_id uuid)
returns text language plpgsql security definer set search_path = ''
as $function$
declare
  v_verified timestamptz;
  v_club     uuid;
  v_token    text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  select email_verified_at into v_verified from public.profiles where id = p_profile_id;
  if not found then raise exception 'Perfil no encontrado'; end if;
  if v_verified is not null then return null; end if;

  select club_id into v_club from public.club_members
   where user_id = p_profile_id order by created_at, club_id limit 1;
  if v_club is null then raise exception 'Perfil sin plantel'; end if;

  insert into private.email_verification_tokens (profile_id, club_id, token_hash, expires_at)
  values (p_profile_id, v_club, encode(extensions.digest(v_token, 'sha256'), 'hex'), now() + interval '7 days')
  on conflict (profile_id) do update
    set club_id = excluded.club_id, token_hash = excluded.token_hash,
        expires_at = excluded.expires_at, used_at = null, created_at = now();
  return v_token;
end $function$;

-- Se elimina el espejo
drop trigger club_members_mirror_profile on public.club_members;
drop function private.mirror_member_to_profile();

-- profiles queda como identidad. Sin CASCADE: si algo todavía depende de las columnas, la migración falla y no cambia nada
alter table public.profiles
  drop column club_id,
  drop column roles,
  drop column status,
  drop column requested_role;
