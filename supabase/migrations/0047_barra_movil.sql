-- Recov · 0047 · Barra inferior móvil configurable por cuenta y plantel
-- Cada cuenta elige qué pantallas van en su barra inferior del celular. Es por
-- plantel (los roles son por plantel, club_members), así que la fila lleva club_id.
--   Lectura: cada cuenta lee solo su fila del plantel activo (RLS).
--   Escritura: solo por set_nav_slots (SECURITY DEFINER); authenticated no tiene
--   INSERT ni UPDATE. Valida que cada pantalla la pueda ver el rol.
--   slots NULL = valor por defecto del rol ("Restablecer"; no se borran filas).
-- Las claves y sus reglas son las mismas de src/lib/nav-slots.ts (solo decide qué se
-- muestra; cada página sigue validando su acceso).

-- ---------------------------------------------------------------------
-- Catálogo de pantallas que pueden ir en la barra
-- ---------------------------------------------------------------------
create function private.nav_screen_keys()
returns text[]
language sql immutable set search_path to ''
as $$
  select array[
    'resumen', 'calendario', 'plantel', 'lesiones', 'nominas', 'evaluaciones',
    'metricas', 'registros', 'staff', 'mis_lesiones', 'mis_evaluaciones'
  ]::text[]
$$;
revoke all on function private.nav_screen_keys() from public, anon, authenticated;

-- Pantallas que la cuenta autenticada puede ver en un plantel (confirmada):
--   todos: resumen, calendario, plantel;
--   staff: lesiones, nominas, metricas;
--   evaluaciones: head coach, kine, entrenador, nutricionista y preparador físico;
--   dirección (head coach y manager): registros y staff;
--   jugador: mis_evaluaciones (con ficha) y mis_lesiones (si además no es staff:
--   para el staff, Lesiones ya muestra las del plantel).
create function private.nav_allowed_screens(p_club uuid)
returns text[]
language sql stable security definer set search_path to ''
as $$
  select case when not private.is_confirmed_member(p_club) then '{}'::text[] else
    array['resumen', 'calendario', 'plantel']
    || case when private.is_staff(p_club) then array['lesiones', 'nominas', 'metricas'] else '{}' end
    || case when private.has_role(p_club, 'head_coach') or private.has_role(p_club, 'kinesiologo')
              or private.has_role(p_club, 'entrenador') or private.has_role(p_club, 'nutricionista')
              or private.has_role(p_club, 'preparador_fisico')
            then array['evaluaciones'] else '{}' end
    || case when private.is_direction(p_club) then array['registros', 'staff'] else '{}' end
    || case when private.has_role(p_club, 'jugador') and not private.is_staff(p_club)
            then array['mis_lesiones'] else '{}' end
    || case when private.has_role(p_club, 'jugador') and private.current_player_id(p_club) is not null
            then array['mis_evaluaciones'] else '{}' end
  end
$$;
revoke all on function private.nav_allowed_screens(uuid) from public, anon, authenticated;

-- Cantidad de pantallas en la barra: 3 si la cuenta es jugador (el centro es el
-- botón fijo "Registrar lesión"), 4 para el resto. "Más" va siempre aparte.
create function private.nav_slot_count(p_club uuid)
returns integer
language sql stable security definer set search_path to ''
as $$ select case when private.has_role(p_club, 'jugador') then 3 else 4 end $$;
revoke all on function private.nav_slot_count(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Tabla
-- ---------------------------------------------------------------------
create table public.nav_preferences (
  user_id uuid not null,
  club_id uuid not null,
  slots text[],
  updated_at timestamptz not null default now(),
  primary key (user_id, club_id),
  foreign key (user_id, club_id) references public.club_members (user_id, club_id) on delete cascade,
  constraint nav_preferences_slots_chk check (
    slots is null
    or (
      slots <@ private.nav_screen_keys()
      and array_position(slots, null) is null
      and cardinality(slots) between 3 and 4
    )
  )
);

alter table public.nav_preferences enable row level security;

-- Solo lectura para la app; las escrituras van por set_nav_slots.
revoke all on table public.nav_preferences from public, anon, authenticated;
grant select on table public.nav_preferences to authenticated;

create policy nav_preferences_select_own on public.nav_preferences
  for select to authenticated
  using (user_id = (select auth.uid()) and club_id = (select private.active_club_id()));

-- ---------------------------------------------------------------------
-- Guardar (o restablecer con NULL) la barra en el plantel activo
-- ---------------------------------------------------------------------
-- Errores: 'forbidden' (42501) sin plantel activo confirmado; 'invalid_slots' si
-- la cantidad no es la del rol, hay repetidas, nulas o pantallas que el rol no ve.
create function public.set_nav_slots(p_slots text[])
returns void
language plpgsql security definer set search_path to ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_club uuid := private.current_club_id();
begin
  if v_user is null or v_club is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_slots is not null and (
       cardinality(p_slots) <> private.nav_slot_count(v_club)
       or array_position(p_slots, null) is not null
       or not (p_slots <@ private.nav_allowed_screens(v_club))
       or cardinality(p_slots) <> (select count(distinct s) from unnest(p_slots) s)
     ) then
    raise exception 'invalid_slots';
  end if;

  insert into public.nav_preferences (user_id, club_id, slots, updated_at)
  values (v_user, v_club, p_slots, now())
  on conflict (user_id, club_id) do update
    set slots = excluded.slots, updated_at = excluded.updated_at;
end $$;

revoke all on function public.set_nav_slots(text[]) from public, anon, authenticated;
grant execute on function public.set_nav_slots(text[]) to authenticated;
