-- Recov · 0039 · Multi-plantel (3 de 4): las funciones públicas escriben en club_members
-- club_members pasa a ser la fuente de verdad. Los cambios del plantel principal
-- (profiles.club_id) se reflejan en profiles para que la app actual siga igual
-- hasta la migración 4. Todo parámetro nuevo (p_club_id) es opcional: si viene
-- vacío se usa el plantel principal de la cuenta.

-- 1. Restricciones
alter table public.players drop constraint players_user_id_key;
alter table public.players add constraint players_user_id_club_id_key unique (user_id, club_id);

-- Los delegados apuntan a una membresía del mismo plantel. Se conserva el
-- "on delete set null" de las FK anteriores: si se borra la membresía (por
-- ejemplo, al borrar la cuenta) el club queda sin delegado en vez de fallar.
alter table public.clubs drop constraint clubs_kine_delegate_fkey;
alter table public.clubs drop constraint clubs_nomina_delegate_fkey;
alter table public.clubs add constraint clubs_kine_delegate_fkey
  foreign key (kine_delegate_id, id) references public.club_members (user_id, club_id)
  on delete set null (kine_delegate_id);
alter table public.clubs add constraint clubs_nomina_delegate_fkey
  foreign key (nomina_delegate_id, id) references public.club_members (user_id, club_id)
  on delete set null (nomina_delegate_id);

alter table private.member_emails drop constraint member_emails_pkey;
alter table private.member_emails add primary key (profile_id, club_id);

-- 2. Se invierte la sincronización: club_members es la fuente de verdad y se refleja
-- en profiles solo para el plantel principal de la cuenta
drop trigger profiles_sync_member on public.profiles;
drop function private.sync_profile_to_member();

create function private.mirror_member_to_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles
     set roles = new.roles, status = new.status, requested_role = new.requested_role
   where id = new.user_id and club_id = new.club_id;
  return new;
end
$$;
revoke all on function private.mirror_member_to_profile() from public;

create trigger club_members_mirror_profile
  after insert or update of roles, status, requested_role on public.club_members
  for each row execute function private.mirror_member_to_profile();

-- 3. Plantel por defecto: el principal de la cuenta
create function private.resolve_club(p_club uuid)
returns uuid language sql stable security definer set search_path = ''
as $$ select coalesce(p_club, (select club_id from public.profiles where id = (select auth.uid()))) $$;
revoke all on function private.resolve_club(uuid) from public;

-- 4. Funciones públicas
drop function public.review_member(uuid, text, public.user_role[]);
drop function public.set_staff_roles(uuid, public.user_role[]);
drop function public.set_kine_delegate(uuid);
drop function public.set_nomina_delegate(uuid);
drop function public.set_my_avatar(text);
drop function public.update_my_profile(text, text, text, text, integer, numeric);

create function public.review_member(
  p_profile_id uuid, p_decision text,
  p_roles public.user_role[] default null, p_club_id uuid default null)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_club   uuid := private.resolve_club(p_club_id);
  v_target public.club_members%rowtype;
  v_roles  public.user_role[];
  v_status public.member_status;
begin
  if v_club is null or not private.is_direction(v_club) then raise exception 'No tienes permiso para esta acción'; end if;
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
    update public.club_members set status = 'confirmado', roles = v_roles
     where user_id = p_profile_id and club_id = v_club;
  else
    update public.club_members set status = 'rechazado', roles = '{}'
     where user_id = p_profile_id and club_id = v_club;
  end if;
end $function$;

create function public.set_staff_roles(
  p_profile_id uuid, p_roles public.user_role[], p_club_id uuid default null)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_club   uuid := private.resolve_club(p_club_id);
  v_target public.club_members%rowtype;
begin
  if v_club is null or not private.is_direction(v_club) then raise exception 'No tienes permiso para esta acción'; end if;
  if p_profile_id = (select auth.uid()) then raise exception 'No puedes modificar tu propio perfil'; end if;

  select * into v_target from public.club_members where user_id = p_profile_id and club_id = v_club;
  if not found then raise exception 'Perfil no encontrado'; end if;
  if v_target.status <> 'confirmado' then raise exception 'Solo se pueden cambiar los roles de miembros confirmados'; end if;
  if exists (select 1 from public.players where user_id = p_profile_id and club_id = v_club) then
    raise exception 'Los jugadores no tienen rol de staff';
  end if;
  if p_roles is null or not (p_roles <@ private.staff_roles()) then raise exception 'Roles de staff inválidos'; end if;

  if cardinality(p_roles) = 0 then
    update public.club_members set roles = '{}', status = 'rechazado'
     where user_id = p_profile_id and club_id = v_club;
    update public.clubs set kine_delegate_id = null where id = v_club and kine_delegate_id = p_profile_id;
    update public.clubs set nomina_delegate_id = null where id = v_club and nomina_delegate_id = p_profile_id;
  else
    update public.club_members set roles = p_roles where user_id = p_profile_id and club_id = v_club;
  end if;
end $function$;

create function public.set_kine_delegate(p_profile_id uuid, p_club_id uuid default null)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_club   uuid := private.resolve_club(p_club_id);
  v_target public.club_members%rowtype;
begin
  if v_club is null or not private.is_direction(v_club) then raise exception 'No tienes permiso para esta acción'; end if;

  if p_profile_id is null then
    update public.clubs set kine_delegate_id = null where id = v_club;
    return;
  end if;

  select * into v_target from public.club_members
   where user_id = p_profile_id and club_id = v_club and status = 'confirmado';
  if not found or not (v_target.roles && private.staff_roles()) then
    raise exception 'La persona debe ser parte del staff confirmado';
  end if;

  update public.clubs set kine_delegate_id = p_profile_id where id = v_club;
end $function$;

create function public.set_nomina_delegate(p_profile_id uuid, p_club_id uuid default null)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_club   uuid := private.resolve_club(p_club_id);
  v_target public.club_members%rowtype;
begin
  if v_club is null or not private.is_direction(v_club) then
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

  update public.clubs set nomina_delegate_id = p_profile_id where id = v_club;
end $function$;

create function public.set_my_avatar(p_path text, p_club_id uuid default null)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_uid  uuid := (select auth.uid());
  v_club uuid := private.resolve_club(p_club_id);
begin
  if v_uid is null or v_club is null or not private.is_member(v_club) then
    raise exception 'Debes estar registrado en un club';
  end if;

  if p_path is not null then
    if p_path not like v_club::text || '/' || v_uid::text || '/%' then
      raise exception 'Ruta de foto inválida';
    end if;
    if not exists (select 1 from storage.objects where bucket_id = 'avatars' and name = p_path) then
      raise exception 'La foto no se subió correctamente';
    end if;
  end if;

  update public.profiles set avatar_path = p_path where id = v_uid;
end $function$;

create function public.update_my_profile(
  p_first_name text, p_last_name text,
  p_position text default null, p_secondary_position text default null,
  p_height_cm integer default null, p_weight_kg numeric default null,
  p_club_id uuid default null)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_uid   uuid := (select auth.uid());
  v_club  uuid := private.resolve_club(p_club_id);
  v_first text := trim(coalesce(p_first_name, ''));
  v_last  text := trim(coalesce(p_last_name, ''));
  v_pos   text := nullif(trim(coalesce(p_position, '')), '');
  v_sec   text := nullif(trim(coalesce(p_secondary_position, '')), '');
begin
  if v_uid is null or v_club is null or not private.is_confirmed_member(v_club) then
    raise exception 'No tienes permiso para esta acción';
  end if;

  if v_first = '' or v_last = '' or length(v_first) > 100 or length(v_last) > 100 then
    raise exception 'Nombre y apellido son obligatorios (máximo 100 caracteres)';
  end if;

  update public.profiles set full_name = v_first || ' ' || v_last where id = v_uid;

  update public.players
     set first_name = v_first, last_name = v_last, full_name = v_first || ' ' || v_last
   where user_id = v_uid;

  if exists (select 1 from public.players where user_id = v_uid and club_id = v_club) then
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
       set position = v_pos, secondary_position = v_sec,
           height_cm = p_height_cm, weight_kg = p_weight_kg
     where user_id = v_uid and club_id = v_club;
  end if;
end $function$;

-- Permisos: los mismos que tenían las firmas anteriores (authenticated y service_role).
-- En public, los privilegios por defecto darían EXECUTE también a anon: se quitan.
revoke all on function public.review_member(uuid, text, public.user_role[], uuid) from public, anon;
revoke all on function public.set_staff_roles(uuid, public.user_role[], uuid) from public, anon;
revoke all on function public.set_kine_delegate(uuid, uuid) from public, anon;
revoke all on function public.set_nomina_delegate(uuid, uuid) from public, anon;
revoke all on function public.set_my_avatar(text, uuid) from public, anon;
revoke all on function public.update_my_profile(text, text, text, text, integer, numeric, uuid) from public, anon;

grant execute on function public.review_member(uuid, text, public.user_role[], uuid) to authenticated, service_role;
grant execute on function public.set_staff_roles(uuid, public.user_role[], uuid) to authenticated, service_role;
grant execute on function public.set_kine_delegate(uuid, uuid) to authenticated, service_role;
grant execute on function public.set_nomina_delegate(uuid, uuid) to authenticated, service_role;
grant execute on function public.set_my_avatar(text, uuid) to authenticated, service_role;
grant execute on function public.update_my_profile(text, text, text, text, integer, numeric, uuid) to authenticated, service_role;

-- register_member: misma firma (conserva sus permisos). Una cuenta existente puede unirse a otro plantel.
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
      insert into public.profiles (id, club_id, roles, full_name, status)
      values (v_uid, v_club_id, '{jugador}', v_first || ' ' || v_last, 'pendiente');
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
      insert into public.profiles (id, club_id, roles, full_name, status, requested_role)
      values (v_uid, v_club_id, '{}', v_first || ' ' || v_last, 'pendiente', p_requested_role);
    end if;

    insert into public.club_members (user_id, club_id, roles, status, requested_role)
    values (v_uid, v_club_id, '{}', 'pendiente', p_requested_role);

  else
    raise exception 'Tipo de registro inválido';
  end if;
end $function$;
