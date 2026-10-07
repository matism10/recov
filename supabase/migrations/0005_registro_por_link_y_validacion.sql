-- Recov · 0005 · Registro por link del club, validación y nuevos permisos
-- Ejecutar DESPUÉS de 0004, en una consulta aparte.
--
-- Modelo:
--   Dirección  = head_coach y manager (mismas funciones): gestionan el staff y validan registros.
--   Staff      = head_coach, manager, entrenador, kinesiologo, nutricionista, preparador_fisico.
--   Jugador    = sube su documentación y ve la disponibilidad del plantel.
--   Todo usuario nuevo queda "pendiente" hasta que la dirección lo confirma; mientras tanto no ve datos del club.
--   El head coach puede delegar las funciones del kinesiólogo en otra persona del staff.

-- ---------------------------------------------------------------------
-- Estados y deportes
-- ---------------------------------------------------------------------
create type public.member_status as enum ('pendiente', 'confirmado', 'rechazado');

create table public.sports (
  slug text primary key,
  name text not null
);

create table public.positions (
  id    uuid primary key default gen_random_uuid(),
  sport text not null references public.sports (slug) on delete cascade,
  name  text not null,
  sort  int  not null,
  unique (sport, name)
);

insert into public.sports (slug, name) values ('rugby', 'Rugby'), ('hockey', 'Hockey');

insert into public.positions (sport, name, sort) values
  ('rugby', 'Pilar', 1), ('rugby', 'Hooker', 2), ('rugby', 'Segunda línea', 3),
  ('rugby', 'Ala', 4), ('rugby', 'Octavo', 5), ('rugby', 'Medio scrum', 6),
  ('rugby', 'Apertura', 7), ('rugby', 'Centro', 8), ('rugby', 'Wing', 9), ('rugby', 'Fullback', 10),
  ('hockey', 'Arquero', 1), ('hockey', 'Defensa', 2),
  ('hockey', 'Mediocampista', 3), ('hockey', 'Delantero', 4);

alter table public.sports    enable row level security;
alter table public.positions enable row level security;
create policy sports_read    on public.sports    for select to anon, authenticated using (true);
create policy positions_read on public.positions for select to anon, authenticated using (true);
revoke all on public.sports, public.positions from anon, authenticated;
grant select on public.sports, public.positions to anon, authenticated;

-- ---------------------------------------------------------------------
-- Clubes: deporte obligatorio, link único y delegación de kinesiólogo
-- ---------------------------------------------------------------------
update public.clubs set sport = 'rugby'
 where sport is null or sport not in (select slug from public.sports);
alter table public.clubs alter column sport set not null;
alter table public.clubs add constraint clubs_sport_fkey
  foreign key (sport) references public.sports (slug);

alter table public.clubs add column slug text;
update public.clubs
   set slug = coalesce(nullif(trim(both '-' from lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))), ''), 'club');
alter table public.clubs alter column slug set not null;
alter table public.clubs add constraint clubs_slug_key unique (slug);
alter table public.clubs add constraint clubs_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

alter table public.clubs add column kine_delegate_id uuid;

-- ---------------------------------------------------------------------
-- Perfiles: estado de validación y puesto solicitado
-- ---------------------------------------------------------------------
alter table public.profiles add column status public.member_status not null default 'pendiente';
alter table public.profiles add column requested_role public.user_role;
update public.profiles set status = 'confirmado';   -- los perfiles existentes quedan confirmados
alter table public.profiles add constraint profiles_id_club_key unique (id, club_id);

-- el delegado debe ser un perfil del mismo club
alter table public.clubs add constraint clubs_kine_delegate_fkey
  foreign key (kine_delegate_id, id) references public.profiles (id, club_id)
  on delete set null (kine_delegate_id);

-- ---------------------------------------------------------------------
-- Jugadores: datos del registro y estado
-- ---------------------------------------------------------------------
alter table public.players
  add column first_name         text,
  add column last_name          text,
  add column secondary_position text,
  add column height_cm          int check (height_cm between 100 and 250),
  add column weight_kg          numeric(5,1) check (weight_kg between 30 and 250),
  add column status             public.member_status not null default 'pendiente';
alter table public.players add constraint players_secondary_differs
  check (secondary_position is null or secondary_position <> position);
update public.players set status = 'confirmado';    -- los jugadores existentes quedan confirmados

-- ---------------------------------------------------------------------
-- Helpers de permisos (schema privado)
-- ---------------------------------------------------------------------
-- Club al que pertenece el usuario, sin importar su estado (para la pantalla "en revisión").
create or replace function private.member_club_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select club_id from public.profiles where id = (select auth.uid()) $$;

-- Club solo si el usuario está CONFIRMADO: un usuario pendiente no ve datos del club.
create or replace function private.current_club_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select club_id from public.profiles where id = (select auth.uid()) and status = 'confirmado' $$;

create or replace function private.has_role(r public.user_role)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select r = any (roles) from public.profiles
      where id = (select auth.uid()) and status = 'confirmado'),
    false)
$$;

create or replace function private.staff_roles()
returns public.user_role[] language sql immutable set search_path = ''
as $$ select array['head_coach','manager','entrenador','kinesiologo','nutricionista','preparador_fisico']::public.user_role[] $$;

create or replace function private.is_direction()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_role('head_coach') or private.has_role('manager') $$;

create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
     where id = (select auth.uid()) and status = 'confirmado' and roles && private.staff_roles())
$$;

-- Funciones de kinesiólogo: el rol kinesiologo o la persona en quien el head coach las delegó.
create or replace function private.has_kine_powers()
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.has_role('kinesiologo')
      or exists (
        select 1 from public.clubs c
          join public.profiles p on p.id = c.kine_delegate_id and p.club_id = c.id
         where p.id = (select auth.uid()) and p.status = 'confirmado')
$$;

-- Quién puede ver los documentos médicos. Un solo lugar para cambiar esta decisión.
create or replace function private.can_view_documents()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_kine_powers() $$;

revoke all on function private.member_club_id()      from public, anon;
revoke all on function private.staff_roles()         from public, anon;
revoke all on function private.is_direction()        from public, anon;
revoke all on function private.is_staff()            from public, anon;
revoke all on function private.has_kine_powers()     from public, anon;
revoke all on function private.can_view_documents()  from public, anon;
grant execute on function private.member_club_id()     to authenticated;
grant execute on function private.staff_roles()        to authenticated;
grant execute on function private.is_direction()       to authenticated;
grant execute on function private.is_staff()           to authenticated;
grant execute on function private.has_kine_powers()    to authenticated;
grant execute on function private.can_view_documents() to authenticated;

-- ---------------------------------------------------------------------
-- Políticas: se reescriben las que dependían de "admin"
-- ---------------------------------------------------------------------
drop policy clubs_select          on public.clubs;
drop policy profiles_select       on public.profiles;
drop policy profiles_update_admin on public.profiles;
drop policy players_select        on public.players;
drop policy players_insert        on public.players;
drop policy players_update        on public.players;
drop policy players_delete        on public.players;
drop policy injuries_select       on public.injuries;
drop policy injuries_write        on public.injuries;
drop policy phases_select         on public.injury_phases;
drop policy phases_write          on public.injury_phases;
drop policy documents_all         on public.documents;
drop policy medical_docs_kine     on storage.objects;

-- clubs: el usuario ve su propio club aunque esté pendiente (para mostrar el nombre)
create policy clubs_select on public.clubs
  for select to authenticated
  using (id = private.member_club_id());

-- profiles: cada uno ve el suyo; los confirmados ven a los confirmados; la dirección ve también los pendientes.
-- No hay políticas de escritura: los cambios van por las funciones de abajo.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (club_id = private.current_club_id()
        and (status = 'confirmado' or private.is_direction()))
  );

-- players: el plantel confirmado lo ve todo el club; los pendientes, solo la dirección.
create policy players_select on public.players
  for select to authenticated
  using (
    club_id = private.current_club_id()
    and (status = 'confirmado' or private.is_direction())
  );

-- players: el kinesiólogo (o su delegado) actualiza la disponibilidad, pero no puede cambiar el estado de validación.
create policy players_update on public.players
  for update to authenticated
  using      (club_id = private.current_club_id() and status = 'confirmado' and private.has_kine_powers())
  with check (club_id = private.current_club_id() and status = 'confirmado' and private.has_kine_powers());

-- lesiones y fases: las ve todo el staff; las escribe el kinesiólogo (o su delegado)
create policy injuries_select on public.injuries
  for select to authenticated
  using (club_id = private.current_club_id() and private.is_staff());

create policy injuries_write on public.injuries
  for all to authenticated
  using      (club_id = private.current_club_id() and private.has_kine_powers())
  with check (club_id = private.current_club_id() and private.has_kine_powers());

create policy phases_select on public.injury_phases
  for select to authenticated
  using (club_id = private.current_club_id() and private.is_staff());

create policy phases_write on public.injury_phases
  for all to authenticated
  using      (club_id = private.current_club_id() and private.has_kine_powers())
  with check (club_id = private.current_club_id() and private.has_kine_powers());

-- documentos médicos: solo quien tiene funciones de kinesiólogo (y el jugador, por sus propias políticas)
create policy documents_all on public.documents
  for all to authenticated
  using      (club_id = private.current_club_id() and private.can_view_documents())
  with check (club_id = private.current_club_id() and private.can_view_documents());

create policy medical_docs_kine on storage.objects
  for all to authenticated
  using (
    bucket_id = 'medical-docs'
    and (storage.foldername(name))[1] = private.current_club_id()::text
    and private.can_view_documents()
  )
  with check (
    bucket_id = 'medical-docs'
    and (storage.foldername(name))[1] = private.current_club_id()::text
    and private.can_view_documents()
  );

-- ---------------------------------------------------------------------
-- Funciones que usa la aplicación
-- ---------------------------------------------------------------------

-- Información pública del club para la página del link (sin sesión).
create or replace function public.club_public_info(p_slug text)
returns table (name text, sport text)
language sql stable security definer set search_path = ''
as $$
  select c.name, c.sport from public.clubs c where c.slug = lower(trim(p_slug))
$$;

-- Registro desde el link del club. Se llama con la sesión recién creada del usuario.
create or replace function public.register_member(
  p_club_slug          text,
  p_kind               text,                 -- 'jugador' | 'staff'
  p_first_name         text,
  p_last_name          text,
  p_position           text default null,    -- jugador: obligatoria
  p_secondary_position text default null,    -- jugador: opcional
  p_height_cm          int  default null,
  p_weight_kg          numeric default null,
  p_requested_role     public.user_role default null   -- staff: kinesiologo | entrenador | nutricionista | preparador_fisico
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_club_id uuid;
  v_sport   text;
  v_first   text := trim(coalesce(p_first_name, ''));
  v_last    text := trim(coalesce(p_last_name, ''));
begin
  if v_uid is null then raise exception 'Debes iniciar sesión'; end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'Esta cuenta ya está registrada en un club';
  end if;

  select id, sport into v_club_id, v_sport from public.clubs where slug = lower(trim(p_club_slug));
  if v_club_id is null then raise exception 'Club no encontrado'; end if;

  if v_first = '' or v_last = '' or length(v_first) > 100 or length(v_last) > 100 then
    raise exception 'Nombre y apellido son obligatorios (máximo 100 caracteres)';
  end if;

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

    insert into public.profiles (id, club_id, roles, full_name, status)
    values (v_uid, v_club_id, '{jugador}', v_first || ' ' || v_last, 'pendiente');

    insert into public.players (club_id, full_name, first_name, last_name, position,
                                secondary_position, height_cm, weight_kg, user_id, status)
    values (v_club_id, v_first || ' ' || v_last, v_first, v_last, p_position,
            p_secondary_position, p_height_cm, p_weight_kg, v_uid, 'pendiente');

  elsif p_kind = 'staff' then
    if p_requested_role is null
       or p_requested_role not in ('kinesiologo', 'entrenador', 'nutricionista', 'preparador_fisico') then
      raise exception 'Puesto inválido';
    end if;

    insert into public.profiles (id, club_id, roles, full_name, status, requested_role)
    values (v_uid, v_club_id, '{}', v_first || ' ' || v_last, 'pendiente', p_requested_role);

  else
    raise exception 'Tipo de registro inválido';
  end if;
end $$;

-- La dirección confirma o rechaza un registro pendiente.
create or replace function public.review_member(
  p_profile_id uuid,
  p_decision   text,                         -- 'confirmar' | 'rechazar'
  p_roles      public.user_role[] default null   -- staff: roles a asignar (por defecto, el puesto solicitado)
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_club   uuid := private.current_club_id();
  v_target public.profiles%rowtype;
  v_roles  public.user_role[];
  v_status public.member_status;
begin
  if not private.is_direction() then raise exception 'No tienes permiso para esta acción'; end if;
  if p_profile_id = (select auth.uid()) then raise exception 'No puedes modificar tu propio perfil'; end if;
  if p_decision not in ('confirmar', 'rechazar') then raise exception 'Decisión inválida'; end if;

  select * into v_target from public.profiles where id = p_profile_id and club_id = v_club;
  if not found then raise exception 'Perfil no encontrado'; end if;
  if v_target.status <> 'pendiente' then raise exception 'Este perfil ya fue revisado'; end if;

  v_status := case when p_decision = 'confirmar' then 'confirmado' else 'rechazado' end::public.member_status;

  if exists (select 1 from public.players where user_id = p_profile_id) then
    update public.players  set status = v_status where user_id = p_profile_id;
    update public.profiles set status = v_status where id = p_profile_id;
  elsif p_decision = 'confirmar' then
    v_roles := coalesce(p_roles,
                        case when v_target.requested_role is null then null
                             else array[v_target.requested_role] end);
    if v_roles is null or cardinality(v_roles) = 0 or not (v_roles <@ private.staff_roles()) then
      raise exception 'Roles de staff inválidos';
    end if;
    update public.profiles set status = 'confirmado', roles = v_roles where id = p_profile_id;
  else
    update public.profiles set status = 'rechazado', roles = '{}' where id = p_profile_id;
  end if;
end $$;

-- La dirección cambia los roles de un miembro del staff, o lo quita del staff (lista vacía).
create or replace function public.set_staff_roles(p_profile_id uuid, p_roles public.user_role[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_club   uuid := private.current_club_id();
  v_target public.profiles%rowtype;
begin
  if not private.is_direction() then raise exception 'No tienes permiso para esta acción'; end if;
  if p_profile_id = (select auth.uid()) then raise exception 'No puedes modificar tu propio perfil'; end if;

  select * into v_target from public.profiles where id = p_profile_id and club_id = v_club;
  if not found then raise exception 'Perfil no encontrado'; end if;
  if v_target.status <> 'confirmado' then raise exception 'Solo se pueden cambiar los roles de miembros confirmados'; end if;
  if exists (select 1 from public.players where user_id = p_profile_id) then
    raise exception 'Los jugadores no tienen rol de staff';
  end if;
  if p_roles is null or not (p_roles <@ private.staff_roles()) then raise exception 'Roles de staff inválidos'; end if;

  if cardinality(p_roles) = 0 then
    update public.profiles set roles = '{}', status = 'rechazado' where id = p_profile_id;
    update public.clubs set kine_delegate_id = null where id = v_club and kine_delegate_id = p_profile_id;
  else
    update public.profiles set roles = p_roles where id = p_profile_id;
  end if;
end $$;

-- El head coach (o el manager) delega las funciones de kinesiólogo en alguien del staff. NULL = quitar la delegación.
create or replace function public.set_kine_delegate(p_profile_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_club   uuid := private.current_club_id();
  v_target public.profiles%rowtype;
begin
  if not private.is_direction() then raise exception 'No tienes permiso para esta acción'; end if;

  if p_profile_id is null then
    update public.clubs set kine_delegate_id = null where id = v_club;
    return;
  end if;

  select * into v_target from public.profiles
   where id = p_profile_id and club_id = v_club and status = 'confirmado';
  if not found or not (v_target.roles && private.staff_roles()) then
    raise exception 'La persona debe ser parte del staff confirmado';
  end if;

  update public.clubs set kine_delegate_id = p_profile_id where id = v_club;
end $$;

-- Permisos de ejecución: por defecto Postgres deja ejecutar a todos; se cierran.
revoke all on function public.club_public_info(text)                                    from public, anon, authenticated;
revoke all on function public.register_member(text, text, text, text, text, text, int, numeric, public.user_role) from public, anon, authenticated;
revoke all on function public.review_member(uuid, text, public.user_role[])             from public, anon, authenticated;
revoke all on function public.set_staff_roles(uuid, public.user_role[])                 from public, anon, authenticated;
revoke all on function public.set_kine_delegate(uuid)                                   from public, anon, authenticated;

grant execute on function public.club_public_info(text) to anon, authenticated;
grant execute on function public.register_member(text, text, text, text, text, text, int, numeric, public.user_role) to authenticated;
grant execute on function public.review_member(uuid, text, public.user_role[])          to authenticated;
grant execute on function public.set_staff_roles(uuid, public.user_role[])              to authenticated;
grant execute on function public.set_kine_delegate(uuid)                                to authenticated;
