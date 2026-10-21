-- Recov · 0030 · Teléfono del jugador (opcional)
-- El número vive en una tabla aparte, sin acceso directo (RLS activo y sin
-- políticas): solo se escribe y se lee por funciones.
-- - set_my_phone: el propio jugador lo guarda o lo borra (también si está pendiente).
-- - get_player_phone: lo ve el propio jugador, o el staff confirmado de su club
--   cuando el jugador está confirmado. Si no, devuelve null.

create table public.player_contacts (
  player_id uuid primary key references public.players (id) on delete cascade,
  club_id uuid not null references public.clubs (id) on delete cascade,
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  updated_at timestamptz not null default now()
);

create index player_contacts_club_id_idx on public.player_contacts (club_id);

alter table public.player_contacts enable row level security;
revoke all on table public.player_contacts from anon, authenticated;

-- ---------------------------------------------------------------------
-- set_my_phone: null o '' lo borra; si no, lo guarda (formato +56912345678)
-- ---------------------------------------------------------------------
create or replace function public.set_my_phone(p_phone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player uuid;
  v_club uuid;
  v_phone text := nullif(btrim(p_phone), '');
begin
  select id, club_id into v_player, v_club
    from public.players
   where user_id = (select auth.uid());
  if v_player is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_phone is null then
    delete from public.player_contacts where player_id = v_player;
    return;
  end if;

  if v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'El teléfono debe tener formato internacional, por ejemplo +56912345678.';
  end if;

  insert into public.player_contacts (player_id, club_id, phone, updated_at)
  values (v_player, v_club, v_phone, now())
  on conflict (player_id) do update
    set phone = excluded.phone, club_id = excluded.club_id, updated_at = excluded.updated_at;
end;
$$;

-- ---------------------------------------------------------------------
-- get_player_phone: el número o null
-- ---------------------------------------------------------------------
create or replace function public.get_player_phone(p_player_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select pc.phone
    from public.player_contacts pc
    join public.players p on p.id = pc.player_id
   where pc.player_id = p_player_id
     and (
       p.user_id = (select auth.uid())
       or (
         p.status = 'confirmado'
         and private.is_staff()
         and p.club_id = private.current_club_id()
       )
     )
$$;

revoke all on function public.set_my_phone(text) from public, anon, authenticated;
revoke all on function public.get_player_phone(uuid) from public, anon, authenticated;
grant execute on function public.set_my_phone(text) to authenticated;
grant execute on function public.get_player_phone(uuid) to authenticated;
