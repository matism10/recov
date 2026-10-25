-- Recov · 0044 · Evaluaciones físicas (tests y resultados por jugador)
-- Basada en 0031_evaluaciones.sql de Matías, alineada con 0001–0043:
--   is_confirmed_member  -> private.is_confirmed_member(club)
--   has_club_role        -> private.has_any_role(club, roles[]) (nueva, misma regla que private.has_role)
--   is_club_player       -> jugador confirmado y activo de public.players en ese club
--   player_id            -> public.players(id) (hay jugadores sin cuenta); "sus filas" = players.user_id
--   profiles.full_name   -> players.full_name
-- Escritura (solo por funciones): head_coach, kinesiologo, preparador_fisico.
-- Lectura directa de resultados: staff sin manager (todo el club) y el jugador (sus filas).
-- Ranking para todo el club confirmado con get_test_ranking (sin la nota). No toca enums.

-- ¿La cuenta tiene alguno de estos roles, confirmada en el plantel? (como private.has_role)
create function private.has_any_role(p_club uuid, p_roles public.user_role[])
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce((select roles && p_roles from public.club_members
                        where user_id = (select auth.uid()) and club_id = p_club and status = 'confirmado'), false) $$;
revoke all on function private.has_any_role(uuid, public.user_role[]) from public;
grant execute on function private.has_any_role(uuid, public.user_role[]) to authenticated;

create table public.test_definitions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  unit text not null check (char_length(btrim(unit)) between 1 and 12),
  higher_is_better boolean not null default true,
  display_format text not null default 'number' check (display_format in ('number', 'mmss')),
  archived_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (id, club_id)
);
create unique index test_definitions_club_name_uq
  on public.test_definitions (club_id, lower(btrim(name))) where archived_at is null;

create table public.test_results (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  test_id uuid not null,
  player_id uuid not null references public.players(id),
  value numeric(10,2) not null check (value > 0),
  measured_on date not null,
  note text check (note is null or char_length(note) <= 280),
  recorded_by uuid not null references auth.users(id),
  recorded_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  foreign key (test_id, club_id) references public.test_definitions (id, club_id),
  check ((voided_at is null) = (voided_by is null))
);
create unique index test_results_one_per_day_uq
  on public.test_results (test_id, player_id, measured_on) where voided_at is null;
create index test_results_club_test_idx on public.test_results (club_id, test_id, measured_on desc);
create index test_results_player_test_idx on public.test_results (player_id, test_id, measured_on desc)
  where voided_at is null;

-- RLS: lectura acotada, cero escritura directa
alter table public.test_definitions enable row level security;
alter table public.test_results enable row level security;
revoke all on public.test_definitions, public.test_results from anon, authenticated;
grant select on public.test_definitions, public.test_results to authenticated;

create policy test_definitions_select on public.test_definitions
  for select to authenticated using (private.is_confirmed_member(club_id));

create policy test_results_select_staff on public.test_results
  for select to authenticated using (
    private.has_any_role(club_id, array['head_coach', 'kinesiologo', 'entrenador', 'nutricionista', 'preparador_fisico']::public.user_role[]));

create policy test_results_select_own on public.test_results
  for select to authenticated using (
    private.is_confirmed_member(club_id)
    and exists (select 1 from public.players pl where pl.id = player_id and pl.user_id = (select auth.uid())));

-- Funciones de escritura (head_coach, kinesiologo, preparador_fisico)
create or replace function public.create_test_definition(
  p_club uuid, p_name text, p_unit text,
  p_higher_is_better boolean default true, p_display_format text default 'number')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null
     or not private.has_any_role(p_club, array['head_coach', 'kinesiologo', 'preparador_fisico']::public.user_role[]) then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  insert into public.test_definitions (club_id, name, unit, higher_is_better, display_format, created_by)
  values (p_club, btrim(p_name), btrim(p_unit), p_higher_is_better, p_display_format, (select auth.uid()))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.archive_test_definition(p_test uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_club uuid;
begin
  select club_id into v_club from public.test_definitions where id = p_test;
  if v_club is null or (select auth.uid()) is null
     or not private.has_any_role(v_club, array['head_coach', 'kinesiologo', 'preparador_fisico']::public.user_role[]) then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  update public.test_definitions set archived_at = now() where id = p_test and archived_at is null;
end $$;

-- p_results: [{"player_id": "...", "value": 140, "note": "..."}]
create or replace function public.record_test_results(p_test uuid, p_measured_on date, p_results jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare v_club uuid; v_n int := 0; r jsonb; v_player uuid;
begin
  select club_id into v_club from public.test_definitions where id = p_test and archived_at is null;
  if v_club is null or (select auth.uid()) is null
     or not private.has_any_role(v_club, array['head_coach', 'kinesiologo', 'preparador_fisico']::public.user_role[]) then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if p_measured_on is null or p_measured_on > (now() at time zone 'America/Santiago')::date then
    raise exception 'la fecha no puede ser futura';
  end if;
  if jsonb_typeof(p_results) is distinct from 'array' or jsonb_array_length(p_results) not between 1 and 100 then
    raise exception 'resultados inválidos';
  end if;
  for r in select * from jsonb_array_elements(p_results) loop
    v_player := private.safe_uuid(r->>'player_id');
    if v_player is null or not exists (
         select 1 from public.players
          where id = v_player and club_id = v_club and status = 'confirmado' and active) then
      raise exception 'jugador fuera del club';
    end if;
    insert into public.test_results (club_id, test_id, player_id, value, measured_on, note, recorded_by)
    values (v_club, p_test, v_player, (r->>'value')::numeric, p_measured_on,
            nullif(btrim(r->>'note'), ''), (select auth.uid()));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

create or replace function public.void_test_result(p_result uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_club uuid;
begin
  select club_id into v_club from public.test_results where id = p_result and voided_at is null;
  if v_club is null or (select auth.uid()) is null
     or not private.has_any_role(v_club, array['head_coach', 'kinesiologo', 'preparador_fisico']::public.user_role[]) then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  update public.test_results set voided_at = now(), voided_by = (select auth.uid()) where id = p_result;
end $$;

-- Ranking visible para todo el club (sin la nota, que queda solo para staff y el propio jugador)
create or replace function public.get_test_ranking(p_test uuid)
returns table (player_id uuid, full_name text, value numeric, measured_on date, previous_value numeric)
language plpgsql stable security definer set search_path = '' as $$
declare v_club uuid; v_hib boolean;
begin
  select td.club_id, td.higher_is_better into v_club, v_hib from public.test_definitions td where td.id = p_test;
  if v_club is null or (select auth.uid()) is null or not private.is_confirmed_member(v_club) then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  return query
  with x as (
    select r.player_id, r.value, r.measured_on,
           row_number() over (partition by r.player_id order by r.measured_on desc) rn
    from public.test_results r
    where r.test_id = p_test and r.voided_at is null)
  select a.player_id, pl.full_name, a.value, a.measured_on, b.value
  from x a
  left join x b on b.player_id = a.player_id and b.rn = 2
  join public.players pl on pl.id = a.player_id
  where a.rn = 1 and pl.status = 'confirmado' and pl.active
  order by case when v_hib then a.value end desc, case when not v_hib then a.value end asc, pl.full_name;
end $$;

revoke execute on function
  public.create_test_definition(uuid, text, text, boolean, text),
  public.archive_test_definition(uuid),
  public.record_test_results(uuid, date, jsonb),
  public.void_test_result(uuid),
  public.get_test_ranking(uuid)
from public, anon;
grant execute on function
  public.create_test_definition(uuid, text, text, boolean, text),
  public.archive_test_definition(uuid),
  public.record_test_results(uuid, date, jsonb),
  public.void_test_result(uuid),
  public.get_test_ranking(uuid)
to authenticated;
