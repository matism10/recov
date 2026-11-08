-- Recov · Permisos del staff (fase 2a, paso 1 de 3).
-- Rol = plantilla de permisos + ajustes por persona. Con la plantilla por defecto cada rol
-- hace exactamente lo de hoy: este paso solo crea el catálogo, los ajustes, el helper
-- private.has_perm y el head coach principal. Las funciones y políticas pasan a has_perm
-- en los pasos 2 y 3.
-- Head coach (principal o co-head coach): todos los permisos, sin ajustes.
-- Delegados (clubs.kine_delegate_id, clubs.nomina_delegate_id): siguen igual, cuentan como
-- parte de la plantilla de su delegación.

-- ---------------------------------------------------------------------------
-- 1. Catálogo y plantillas (privados: la app lleva sus textos en src/lib/permissions.ts)
-- ---------------------------------------------------------------------------
create table private.permissions (
  key        text primary key,
  delegable  boolean not null default true,
  -- Delegación que lo otorga además de la plantilla: 'kine' o 'nomina'.
  delegation text check (delegation in ('kine', 'nomina'))
);

insert into private.permissions (key, delegable, delegation) values
  ('lesiones_ver',           true,  null),
  ('lesiones_revisar',       true,  'kine'),
  ('documentos_ver',         true,  'kine'),
  ('lesionado_marcar',       true,  'kine'),
  ('disponibilidad_cambiar', true,  'kine'),
  ('eventos_editar',         true,  null),
  ('eventos_cancelar',       true,  null),
  ('lista_pasar',            true,  null),
  ('nomina_armar',           true,  'nomina'),
  ('participacion_cargar',   true,  'nomina'),
  ('evaluaciones_cargar',    true,  null),
  ('tests_catalogo',         true,  null),
  ('gimnasio_planes',        true,  null),
  ('carga_ver',              true,  null),
  ('check_dias',             true,  null),
  ('registros_aprobar',      true,  null),
  ('posicion_cambiar',       true,  null),
  -- No delegables: solo por rol (head coach y manager, como hoy).
  ('staff_gestionar',        false, null),
  ('sevens_activar',         false, null),
  ('sevens_grupo',           false, null);

create table private.role_permissions (
  role public.user_role not null,
  perm text not null references private.permissions(key),
  primary key (role, perm)
);

-- El head coach no necesita filas: tiene todo. Igual que hoy:
insert into private.role_permissions (role, perm)
select r::public.user_role, p from (values
  -- Todo el staff ve lesiones, pasa lista y ve sRPE y bienestar.
  ('manager', 'lesiones_ver'), ('entrenador', 'lesiones_ver'), ('kinesiologo', 'lesiones_ver'),
  ('nutricionista', 'lesiones_ver'), ('preparador_fisico', 'lesiones_ver'),
  ('manager', 'lista_pasar'), ('entrenador', 'lista_pasar'), ('kinesiologo', 'lista_pasar'),
  ('nutricionista', 'lista_pasar'), ('preparador_fisico', 'lista_pasar'),
  ('manager', 'carga_ver'), ('entrenador', 'carga_ver'), ('kinesiologo', 'carga_ver'),
  ('nutricionista', 'carga_ver'), ('preparador_fisico', 'carga_ver'),
  -- Lesiones: kinesiólogo (y su delegado, por la delegación 'kine').
  ('kinesiologo', 'lesiones_revisar'), ('kinesiologo', 'documentos_ver'),
  ('kinesiologo', 'lesionado_marcar'), ('kinesiologo', 'disponibilidad_cambiar'),
  -- Calendario: manager y entrenador.
  ('manager', 'eventos_editar'), ('manager', 'eventos_cancelar'),
  ('entrenador', 'eventos_editar'), ('entrenador', 'eventos_cancelar'),
  -- Nóminas: manager (y el delegado de nóminas).
  ('manager', 'nomina_armar'), ('manager', 'participacion_cargar'),
  -- Evaluaciones: kinesiólogo y preparador físico.
  ('kinesiologo', 'evaluaciones_cargar'), ('kinesiologo', 'tests_catalogo'),
  ('preparador_fisico', 'evaluaciones_cargar'), ('preparador_fisico', 'tests_catalogo'),
  -- Gimnasio: preparador físico.
  ('preparador_fisico', 'gimnasio_planes'),
  -- Días del check: manager y preparador físico.
  ('manager', 'check_dias'), ('preparador_fisico', 'check_dias'),
  -- Dirección: manager.
  ('manager', 'registros_aprobar'), ('manager', 'staff_gestionar'),
  ('manager', 'sevens_activar'), ('manager', 'sevens_grupo')
) v(r, p);

-- ---------------------------------------------------------------------------
-- 2. Ajustes por persona (sin escritura directa; "Restablecer al rol" archiva)
-- ---------------------------------------------------------------------------
create table public.member_permissions (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  user_id     uuid not null,
  perm        text not null references private.permissions(key),
  granted     boolean not null,
  set_by      uuid references auth.users(id) on delete set null,
  set_at      timestamptz not null default now(),
  archived_at timestamptz,
  foreign key (user_id, club_id) references public.club_members (user_id, club_id) on delete cascade
);
create unique index member_permissions_active_uq
  on public.member_permissions (club_id, user_id, perm) where archived_at is null;

alter table public.member_permissions enable row level security;
revoke all on public.member_permissions from anon, authenticated;
grant select on public.member_permissions to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Head coach principal
-- ---------------------------------------------------------------------------
alter table public.club_members add column is_principal boolean not null default false;
create unique index club_members_principal_uq on public.club_members (club_id) where is_principal;

-- Clubes existentes: el head coach confirmado más antiguo.
update public.club_members m set is_principal = true
  from (select distinct on (club_id) club_id, user_id
          from public.club_members
         where status = 'confirmado' and 'head_coach' = any (roles)
         order by club_id, created_at, user_id) f
 where m.club_id = f.club_id and m.user_id = f.user_id;

-- El principal sigue siendo head coach confirmado; un club sin principal lo toma del
-- primer head coach confirmado (club nuevo).
create function private.club_members_principal()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.is_principal
     and (new.status <> 'confirmado' or not ('head_coach' = any (new.roles))) then
    raise exception 'No se puede quitar ni degradar al head coach principal' using errcode = '42501';
  end if;
  if new.is_principal and (new.status <> 'confirmado' or not ('head_coach' = any (new.roles))) then
    raise exception 'El head coach principal debe ser head coach confirmado';
  end if;
  if not new.is_principal and new.status = 'confirmado' and 'head_coach' = any (new.roles)
     and not exists (select 1 from public.club_members m
                      where m.club_id = new.club_id and m.is_principal and m.user_id <> new.user_id) then
    new.is_principal := true;
  end if;
  return new;
end $$;
revoke all on function private.club_members_principal() from public;

create trigger club_members_principal
  before insert or update of status, roles, is_principal on public.club_members
  for each row execute function private.club_members_principal();

-- ---------------------------------------------------------------------------
-- 4. Helpers
-- ---------------------------------------------------------------------------
-- Permiso según rol y delegación, sin ajustes (lo que "Restablecer al rol" deja).
create function private.member_perm_default(p_club uuid, p_user uuid, p_perm text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select 'head_coach' = any (m.roles)
        or exists (select 1 from private.role_permissions rp
                    where rp.perm = p.key and rp.role = any (m.roles))
        or (p.delegation = 'kine' and exists (
              select 1 from public.clubs c where c.id = p_club and c.kine_delegate_id = m.user_id))
        or (p.delegation = 'nomina' and exists (
              select 1 from public.clubs c where c.id = p_club and c.nomina_delegate_id = m.user_id))
      from public.club_members m
      join private.permissions p on p.key = p_perm
     where m.user_id = p_user and m.club_id = p_club and m.status = 'confirmado'
       and m.roles && private.staff_roles()
  ), false)
$$;

-- Permiso efectivo: el ajuste vigente si hay (delegables y no head coach); si no, el default.
create function private.member_has_perm(p_club uuid, p_user uuid, p_perm text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
             when 'head_coach' = any (m.roles) then true
             when p.delegable and o.granted is not null then o.granted
             else private.member_perm_default(p_club, p_user, p_perm)
           end
      from public.club_members m
      join private.permissions p on p.key = p_perm
      left join public.member_permissions o
        on o.club_id = p_club and o.user_id = p_user and o.perm = p_perm and o.archived_at is null
     where m.user_id = p_user and m.club_id = p_club and m.status = 'confirmado'
       and m.roles && private.staff_roles()
  ), false)
$$;

create function private.has_perm(p_club uuid, p_perm text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.member_has_perm(p_club, (select auth.uid()), p_perm)
$$;

create function private.has_perm(p_perm text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_perm(private.current_club_id(), p_perm)
$$;

revoke all on function private.member_perm_default(uuid, uuid, text) from public;
revoke all on function private.member_has_perm(uuid, uuid, text) from public;
revoke all on function private.has_perm(uuid, text) from public;
revoke all on function private.has_perm(text) from public;
-- Las políticas RLS (paso 3) llaman a has_perm como el usuario.
grant execute on function private.has_perm(uuid, text) to authenticated;
grant execute on function private.has_perm(text) to authenticated;

-- RLS de los ajustes: la propia persona y quien gestiona el staff.
create policy member_permissions_select on public.member_permissions for select to authenticated
  using (user_id = (select auth.uid()) or private.has_perm(club_id, 'staff_gestionar'));

-- ---------------------------------------------------------------------------
-- 5. Lecturas para la app
-- ---------------------------------------------------------------------------
-- Permisos efectivos de la sesión en el plantel activo (la app los pide una vez por request).
create function public.my_permissions()
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(p.key order by p.key), '{}')
    from private.permissions p
   where private.has_perm(private.current_club_id(), p.key)
$$;
revoke all on function public.my_permissions() from public, anon;
grant execute on function public.my_permissions() to authenticated;

-- Detalle de /staff: por persona del staff confirmado, permisos efectivos, los de su rol y
-- sus ajustes vigentes. Solo quien gestiona el staff.
create function public.staff_permissions(p_club_id uuid default null)
returns table (user_id uuid, is_principal boolean, perms text[], defaults text[], overrides jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_club uuid := private.resolve_club(p_club_id);
begin
  if v_club is null or not private.has_perm(v_club, 'staff_gestionar') then
    raise exception 'No tienes permiso para esta acción' using errcode = '42501';
  end if;
  return query
  select m.user_id, m.is_principal,
         coalesce((select array_agg(p.key order by p.key) from private.permissions p
                    where private.member_has_perm(v_club, m.user_id, p.key)), '{}'),
         coalesce((select array_agg(p.key order by p.key) from private.permissions p
                    where private.member_perm_default(v_club, m.user_id, p.key)), '{}'),
         coalesce((select jsonb_object_agg(o.perm, o.granted) from public.member_permissions o
                    where o.club_id = v_club and o.user_id = m.user_id and o.archived_at is null), '{}')
    from public.club_members m
   where m.club_id = v_club and m.status = 'confirmado' and m.roles && private.staff_roles();
end $$;
revoke all on function public.staff_permissions(uuid) from public, anon;
grant execute on function public.staff_permissions(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Escrituras de ajustes (solo head coach)
-- ---------------------------------------------------------------------------
create function public.set_member_permission(
  p_profile_id uuid, p_perm text, p_granted boolean, p_club_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_club   uuid := private.resolve_club(p_club_id);
  v_target public.club_members%rowtype;
begin
  if v_club is null or not private.has_role(v_club, 'head_coach') then
    raise exception 'No tienes permiso para esta acción' using errcode = '42501';
  end if;
  if p_granted is null then raise exception 'Indica si el permiso queda activo'; end if;
  if not exists (select 1 from private.permissions where key = p_perm and delegable) then
    raise exception 'Permiso inválido';
  end if;

  select * into v_target from public.club_members
   where user_id = p_profile_id and club_id = v_club and status = 'confirmado';
  if not found or not (v_target.roles && private.staff_roles()) then
    raise exception 'La persona debe ser parte del staff confirmado';
  end if;
  if 'head_coach' = any (v_target.roles) then
    raise exception 'Un head coach tiene todos los permisos';
  end if;

  update public.member_permissions set archived_at = now()
   where club_id = v_club and user_id = p_profile_id and perm = p_perm and archived_at is null;

  -- Igual a su rol: queda sin ajuste.
  if p_granted <> private.member_perm_default(v_club, p_profile_id, p_perm) then
    insert into public.member_permissions (club_id, user_id, perm, granted, set_by)
    values (v_club, p_profile_id, p_perm, p_granted, (select auth.uid()));
  end if;
end $$;
revoke all on function public.set_member_permission(uuid, text, boolean, uuid) from public, anon;
grant execute on function public.set_member_permission(uuid, text, boolean, uuid) to authenticated;

create function public.reset_member_permissions(p_profile_id uuid, p_club_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_club uuid := private.resolve_club(p_club_id);
begin
  if v_club is null or not private.has_role(v_club, 'head_coach') then
    raise exception 'No tienes permiso para esta acción' using errcode = '42501';
  end if;
  update public.member_permissions set archived_at = now()
   where club_id = v_club and user_id = p_profile_id and archived_at is null;
end $$;
revoke all on function public.reset_member_permissions(uuid, uuid) from public, anon;
grant execute on function public.reset_member_permissions(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. set_staff_roles con las reglas del head coach (misma firma)
-- ---------------------------------------------------------------------------
-- - Gestiona el staff: head coach y manager (staff_gestionar, como hoy).
-- - Dar o quitar el rol head coach: solo un head coach.
-- - Nadie modifica al principal; a un co-head coach solo lo modifica el principal.
-- - El club nunca queda sin head coach.
create or replace function public.set_staff_roles(
  p_profile_id uuid, p_roles public.user_role[], p_club_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
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
  end if;
end $$;
