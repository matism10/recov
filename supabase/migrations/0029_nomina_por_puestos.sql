-- Recov · 0029 · Nómina por puestos (titulares y banca)
-- Ejecutar DESPUÉS de 0028.
--
-- Cada convocado puede ocupar un puesto numerado: 1 a `starters` son titulares
-- (en rugby, cada número es su posición) y los siguientes `bench_size` son la
-- banca (en rugby, 16 a 23). Un puesto no puede tener dos jugadores en el mismo
-- partido. Se puede convocar sin puesto; en total, no más de titulares + banca.
--   sports.starters / bench_size: por deporte (fuente de verdad).
--   event_callups.slot:          puesto del convocado (o null).
--   set_event_lineup:             guarda la nómina completa con sus puestos.
-- set_event_callups (0028) sigue disponible; al archivar a alguien libera su puesto.

-- ---------------------------------------------------------------------
-- Titulares y banca por deporte
-- ---------------------------------------------------------------------
alter table public.sports
  add column starters   smallint,
  add column bench_size smallint;

update public.sports s set starters = v.starters, bench_size = v.bench
from (values
  ('rugby',      15, 8),
  ('futbol',     11, 7),
  ('hockey',     11, 5),
  ('futsal',      5, 9),
  ('handball',    7, 9),
  ('basquetbol',  5, 7),
  ('voleibol',    6, 8)
) as v(slug, starters, bench)
where s.slug = v.slug;

alter table public.sports
  alter column starters   set not null,
  alter column bench_size set not null;
alter table public.sports add constraint sports_lineup_size_chk
  check (starters between 1 and 30 and bench_size between 0 and 20);

-- ---------------------------------------------------------------------
-- Puesto en la convocatoria
-- ---------------------------------------------------------------------
alter table public.event_callups add column slot smallint;
alter table public.event_callups add constraint event_callups_slot_chk check (slot is null or slot >= 1);
alter table public.event_callups add constraint event_callups_slot_removed_chk
  check (removed_at is null or slot is null);

-- Un puesto por partido (solo en la convocatoria vigente).
create unique index event_callups_event_slot_key on public.event_callups (event_id, slot)
  where removed_at is null and slot is not null;

-- ---------------------------------------------------------------------
-- set_event_callups: igual que en 0028, y al archivar libera el puesto
-- ---------------------------------------------------------------------
create or replace function public.set_event_callups(p_event_id uuid, p_player_ids uuid[])
returns void
language plpgsql security definer set search_path to ''
as $$
declare
  v_club uuid := private.current_club_id();
  v_ids  uuid[] := coalesce(p_player_ids, '{}');
begin
  if v_club is null or not private.can_manage_nominas() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform 1 from public.events e
   where e.id = p_event_id and e.club_id = v_club;
  if not found then raise exception 'not_found'; end if;

  perform 1 from public.events e
   where e.id = p_event_id and e.type = 'competencia' and e.cancelled_at is null;
  if not found then raise exception 'Solo se convoca a eventos de competencia no cancelados'; end if;

  if exists (
    select 1 from unnest(v_ids) as x(id)
     where not exists (
       select 1 from public.players p
        where p.id = x.id and p.club_id = v_club and p.status = 'confirmado' and p.active))
  then
    raise exception 'Solo se puede convocar a jugadores confirmados del club';
  end if;

  update public.event_callups c
     set removed_at = now(), removed_by = (select auth.uid()), slot = null
   where c.event_id = p_event_id and c.club_id = v_club and c.removed_at is null
     and not (c.player_id = any (v_ids));

  insert into public.event_callups (club_id, event_id, player_id, created_by)
  select distinct v_club, p_event_id, x.id, (select auth.uid())
    from unnest(v_ids) as x(id)
  on conflict (event_id, player_id) do update
    set removed_at = null, removed_by = null
    where public.event_callups.removed_at is not null;
end $$;

-- ---------------------------------------------------------------------
-- Guardar la nómina con puestos (reemplaza la lista completa)
-- ---------------------------------------------------------------------
-- p_lineup: [{"player_id": uuid, "slot": int | null}]
-- Valida: jugadores confirmados y activos del club, sin repetir; puestos entre 1
-- y titulares + banca del deporte, sin repetir; no más jugadores que puestos.
-- Archiva a los que salen (libera su puesto) y reactiva a los que vuelven.
create function public.set_event_lineup(p_event_id uuid, p_lineup jsonb)
returns void
language plpgsql security definer set search_path to ''
as $$
declare
  v_club    uuid := private.current_club_id();
  v_max     int;
  v_item    jsonb;
  v_player  uuid;
  v_slot    int;
  v_players uuid[] := '{}';
  v_slots   int[] := '{}';
begin
  if v_club is null or not private.can_manage_nominas() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform 1 from public.events e
   where e.id = p_event_id and e.club_id = v_club;
  if not found then raise exception 'not_found'; end if;

  perform 1 from public.events e
   where e.id = p_event_id and e.type = 'competencia' and e.cancelled_at is null;
  if not found then raise exception 'Solo se convoca a eventos de competencia no cancelados'; end if;

  if p_lineup is null or jsonb_typeof(p_lineup) <> 'array' then
    raise exception 'Formato de nómina inválido';
  end if;

  select s.starters + s.bench_size into v_max
    from public.clubs c join public.sports s on s.slug = c.sport
   where c.id = v_club;

  if jsonb_array_length(p_lineup) > v_max then
    raise exception 'La nómina admite hasta % jugadores', v_max;
  end if;

  for v_item in select * from jsonb_array_elements(p_lineup) loop
    if jsonb_typeof(v_item) <> 'object' then raise exception 'Formato de nómina inválido'; end if;

    begin
      v_player := (v_item ->> 'player_id')::uuid;
    exception when others then
      raise exception 'Jugador inválido';
    end;
    if v_player is null then raise exception 'Jugador inválido'; end if;
    if v_player = any (v_players) then raise exception 'Un jugador aparece dos veces en la nómina'; end if;
    if not exists (
      select 1 from public.players p
       where p.id = v_player and p.club_id = v_club and p.status = 'confirmado' and p.active)
    then
      raise exception 'Solo se puede convocar a jugadores confirmados del club';
    end if;
    v_players := v_players || v_player;

    if coalesce(jsonb_typeof(v_item -> 'slot'), 'null') <> 'null' then
      if jsonb_typeof(v_item -> 'slot') <> 'number' or (v_item ->> 'slot') !~ '^[0-9]+$' then
        raise exception 'Puesto inválido';
      end if;
      v_slot := (v_item ->> 'slot')::int;
      if v_slot < 1 or v_slot > v_max then
        raise exception 'El puesto debe estar entre 1 y %', v_max;
      end if;
      if v_slot = any (v_slots) then raise exception 'Hay dos jugadores en el puesto %', v_slot; end if;
      v_slots := v_slots || v_slot;
    end if;
  end loop;

  -- Archiva a los que salen y libera todos los puestos antes de reasignarlos.
  update public.event_callups c
     set removed_at = now(), removed_by = (select auth.uid()), slot = null
   where c.event_id = p_event_id and c.club_id = v_club and c.removed_at is null
     and not (c.player_id = any (v_players));
  update public.event_callups c
     set slot = null
   where c.event_id = p_event_id and c.club_id = v_club and c.removed_at is null;

  insert into public.event_callups (club_id, event_id, player_id, created_by, slot)
  select v_club, p_event_id, x.player_id, (select auth.uid()), x.slot
    from jsonb_to_recordset(p_lineup) as x(player_id uuid, slot smallint)
  on conflict (event_id, player_id) do update
    set removed_at = null, removed_by = null, slot = excluded.slot;
end $$;

revoke all on function public.set_event_lineup(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.set_event_lineup(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- my_match_load: igual que en 0028, y sus convocatorias traen el puesto
-- ---------------------------------------------------------------------
create or replace function public.my_match_load()
returns jsonb
language plpgsql stable security definer set search_path to ''
as $$
declare
  v_club     uuid := private.current_club_id();
  v_player   uuid;
  v_load     jsonb;
  v_starters smallint;
begin
  if v_club is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select p.id into v_player from public.players p
   where p.user_id = (select auth.uid()) and p.club_id = v_club and p.status = 'confirmado';
  if v_player is null then raise exception 'forbidden' using errcode = '42501'; end if;

  select s.starters into v_starters
    from public.clubs c join public.sports s on s.slug = c.sport where c.id = v_club;

  v_load := private.match_load(v_club, 6, v_player);

  return (v_load || jsonb_build_object(
    'player', v_load -> 'players' -> 0,
    'starters', v_starters,
    'callups', coalesce((
      select jsonb_agg(jsonb_build_object(
               'event_id', x.event_id, 'starts_at', x.starts_at, 'opponent', x.opponent,
               'location', x.location, 'slot', x.slot, 'mode', x.mode, 'minutes', x.minutes,
               'range_bucket', x.range_bucket, 'played', x.played, 'loaded', x.loaded)
             order by x.starts_at desc)
        from (select e.id as event_id, e.starts_at, e.opponent, e.location, cu.slot,
                     ep.mode, ep.minutes, ep.range_bucket, ep.played, ep.callup_id is not null as loaded
                from public.event_callups cu
                join public.events e on e.id = cu.event_id
                left join public.event_participations ep on ep.callup_id = cu.id
               where cu.player_id = v_player and cu.club_id = v_club and cu.removed_at is null
                 and e.cancelled_at is null
               order by e.starts_at desc
               limit 20) x), '[]')))
    - 'players';
end $$;
