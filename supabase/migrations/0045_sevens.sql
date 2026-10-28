-- Recov · 0045 · Rugby Sevens dentro de un club de rugby
-- Sevens no es un deporte ni un club nuevo: es un grupo con formato dentro del mismo plantel
-- (mismo club_id, mismo link, mismas fichas, lesiones, disponibilidad y evaluaciones).
-- Formatos: '15' (el de siempre, sale de public.sports) y '7' (sale de public.sport_format_config).
-- Sin enums nuevos: text + check. Escritura solo por funciones SECURITY DEFINER.

-- ---------------------------------------------------------------------------
-- 1. clubs.has_sevens: solo clubes de rugby
-- ---------------------------------------------------------------------------
alter table public.clubs add column has_sevens boolean not null default false;

create function private.validate_club_sevens()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.has_sevens and new.sport <> 'rugby' then
    raise exception 'Solo los clubes de rugby pueden tener Sevens' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.validate_club_sevens() from public;

create trigger clubs_validate_sevens
  before insert or update of has_sevens, sport on public.clubs
  for each row execute function private.validate_club_sevens();

-- ---------------------------------------------------------------------------
-- 2. positions.format y posiciones de Sevens (rugby)
-- ---------------------------------------------------------------------------
alter table public.positions add column format text not null default '15'
  check (format in ('15', '7'));
-- Los nombres de Sevens repiten los del 15: la unicidad pasa a incluir el formato.
alter table public.positions drop constraint positions_sport_name_key;
alter table public.positions add constraint positions_sport_format_name_key unique (sport, format, name);

insert into public.positions (sport, format, name, sort) values
  ('rugby', '7', 'Pilar',       1),
  ('rugby', '7', 'Hooker',      2),
  ('rugby', '7', 'Medio scrum', 3),
  ('rugby', '7', 'Apertura',    4),
  ('rugby', '7', 'Centro',      5),
  ('rugby', '7', 'Wing',        6);

-- La posición de la ficha (players) sigue siendo la del 15: igual que antes.
create or replace function private.validate_player_position()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  v_sport text;
begin
  select sport into v_sport from public.clubs where id = new.club_id;
  if v_sport is null then
    raise exception 'Club inexistente para el jugador';
  end if;

  if new.position is not null and not exists (
    select 1 from public.positions where sport = v_sport and format = '15' and name = new.position
  ) then
    raise exception 'Posición principal inválida para el deporte del club: %', new.position
      using errcode = '23514';
  end if;

  if new.secondary_position is not null and not exists (
    select 1 from public.positions where sport = v_sport and format = '15' and name = new.secondary_position
  ) then
    raise exception 'Posición secundaria inválida para el deporte del club: %', new.secondary_position
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. sevens_group: quién está en Sevens (jugadores y staff) y su posición en Sevens
-- ---------------------------------------------------------------------------
-- member_id es el user_id de la membresía (club_members no tiene id propio: su clave es
-- (user_id, club_id)). Por eso solo entran cuentas; un jugador sin cuenta no puede estar.
create table public.sevens_group (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  member_id uuid not null,
  position text,
  secondary_position text,
  added_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (club_id, member_id),
  foreign key (member_id, club_id) references public.club_members (user_id, club_id) on delete cascade,
  check (secondary_position is null or (position is not null and secondary_position <> position))
);

create function private.validate_sevens_position()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_sport text;
begin
  select sport into v_sport from public.clubs where id = new.club_id;
  if new.position is not null and not exists (
    select 1 from public.positions where sport = v_sport and format = '7' and name = new.position
  ) then
    raise exception 'Posición de Sevens inválida: %', new.position using errcode = '23514';
  end if;
  if new.secondary_position is not null and not exists (
    select 1 from public.positions where sport = v_sport and format = '7' and name = new.secondary_position
  ) then
    raise exception 'Posición secundaria de Sevens inválida: %', new.secondary_position using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.validate_sevens_position() from public;

create trigger sevens_group_validate_position
  before insert or update of position, secondary_position, club_id on public.sevens_group
  for each row execute function private.validate_sevens_position();

alter table public.sevens_group enable row level security;
revoke all on public.sevens_group from anon, authenticated;
grant select on public.sevens_group to authenticated;
create policy sevens_group_select on public.sevens_group
  for select to authenticated using (private.is_confirmed_member(club_id));

-- ---------------------------------------------------------------------------
-- 4. events.format: '7' solo si el club tiene Sevens
-- ---------------------------------------------------------------------------
alter table public.events add column format text not null default '15'
  check (format in ('15', '7'));

create function private.validate_event_format()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.format = '7' and not exists (
    select 1 from public.clubs where id = new.club_id and has_sevens
  ) then
    raise exception 'El club no tiene Sevens activado' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.validate_event_format() from public;

create trigger events_validate_format
  before insert or update of format, club_id on public.events
  for each row execute function private.validate_event_format();

-- create_event recibe el formato (al final, con default '15'). Mismo cuerpo que 0022;
-- cambiar la firma exige recrearla. Mismos permisos que antes.
drop function public.create_event(text, timestamptz, timestamptz, text, text, text, integer);
create function public.create_event(
  p_type text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_location text default null, p_opponent text default null, p_notes text default null,
  p_weeks integer default 1, p_format text default '15')
returns setof uuid language plpgsql security definer set search_path = ''
as $function$
declare
  v_club   uuid := private.events_actor_club();
  v_series uuid;
  v_id     uuid;
  v_i      int;
  v_tz constant text := 'America/Santiago';
begin
  if v_club is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_type is null or p_type not in ('entrenamiento', 'competencia') then raise exception 'invalid_type'; end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then raise exception 'invalid_range'; end if;
  if p_weeks is null or p_weeks < 1 or p_weeks > 12 then raise exception 'invalid_weeks'; end if;
  if p_weeks > 1 and p_type <> 'entrenamiento' then raise exception 'repeat_only_training'; end if;
  if p_format is null or p_format not in ('15', '7') then raise exception 'invalid_format'; end if;
  if p_weeks > 1 then v_series := gen_random_uuid(); end if;

  for v_i in 0 .. p_weeks - 1 loop
    insert into public.events (club_id, type, starts_at, ends_at, location, opponent, notes, series_id, created_by, format)
    values (
      v_club, p_type,
      ((p_starts_at at time zone v_tz) + make_interval(days => 7 * v_i)) at time zone v_tz,
      ((p_ends_at   at time zone v_tz) + make_interval(days => 7 * v_i)) at time zone v_tz,
      nullif(trim(p_location), ''), nullif(trim(p_opponent), ''), nullif(trim(p_notes), ''),
      v_series, (select auth.uid()), p_format)
    returning id into v_id;
    return next v_id;
  end loop;
end $function$;
revoke all on function public.create_event(text, timestamptz, timestamptz, text, text, text, integer, text) from public, anon;
grant execute on function public.create_event(text, timestamptz, timestamptz, text, text, text, integer, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. sport_format_config: escala y tamaño de nómina de los formatos distintos del '15'
-- ---------------------------------------------------------------------------
-- public.sports sigue siendo la fuente del formato '15'. Mismas columnas que sports.
create table public.sport_format_config (
  sport text not null references public.sports(slug) on delete cascade,
  format text not null check (format in ('7')),
  match_minutes smallint not null,
  max_minutes smallint not null,
  bucket2_from smallint not null,
  bucket3_from smallint not null,
  bucket4_from smallint not null,
  starters smallint not null,
  bench_size smallint not null,
  primary key (sport, format),
  constraint sport_format_config_lineup_size_chk check (starters between 1 and 30 and bench_size between 0 and 20),
  -- Como sports_load_scale_chk, pero el último rango puede empezar en la duración del partido.
  constraint sport_format_config_load_scale_chk check (
    bucket2_from >= 2 and bucket2_from < bucket3_from and bucket3_from < bucket4_from
    and bucket4_from <= match_minutes and match_minutes <= max_minutes)
);
alter table public.sport_format_config enable row level security;
revoke all on public.sport_format_config from anon, authenticated;
grant select on public.sport_format_config to anon, authenticated;
create policy sport_format_config_read on public.sport_format_config
  for select to anon, authenticated using (true);

-- PROVISORIO (se cambia con un update de esta fila): Sevens de rugby, 7 titulares y 5 de
-- banca, 14 minutos, tope 14; rangos 0 / 1–4 / 5–9 / 10–13 / 14.
insert into public.sport_format_config
  (sport, format, match_minutes, max_minutes, bucket2_from, bucket3_from, bucket4_from, starters, bench_size)
values ('rugby', '7', 14, 14, 5, 10, 14, 7, 5);

-- Escala y nómina de un deporte en un formato: la config si existe; si no, sports.
create function private.sport_format(p_sport text, p_format text)
returns table (match_minutes smallint, max_minutes smallint, bucket2_from smallint, bucket3_from smallint,
               bucket4_from smallint, starters smallint, bench_size smallint)
language sql stable security definer set search_path = ''
as $$
  select c.match_minutes, c.max_minutes, c.bucket2_from, c.bucket3_from, c.bucket4_from, c.starters, c.bench_size
    from public.sport_format_config c
   where c.sport = p_sport and c.format = p_format
  union all
  select s.match_minutes, s.max_minutes, s.bucket2_from, s.bucket3_from, s.bucket4_from, s.starters, s.bench_size
    from public.sports s
   where s.slug = p_sport
     and not exists (select 1 from public.sport_format_config c where c.sport = p_sport and c.format = p_format)
$$;
revoke all on function private.sport_format(text, text) from public;

-- Escala de participación de un formato (misma salida que sport_load_scale, que queda para el 15).
create function public.format_load_scale(p_sport text, p_format text)
returns table (bucket smallint, label text, min_from smallint, min_to smallint, midpoint smallint)
language sql stable security definer set search_path = ''
as $$
  select b.bucket, b.label, b.min_from, b.min_to, b.midpoint
    from private.sport_format(p_sport, p_format) s
    cross join lateral (values
      (0::smallint, 'No jugó', 0::smallint, 0::smallint, 0::smallint),
      (1::smallint, '<' || s.bucket2_from, 1::smallint, (s.bucket2_from - 1)::smallint,
         round(s.bucket2_from / 2.0)::smallint),
      (2::smallint, s.bucket2_from || '-' || s.bucket3_from, s.bucket2_from, (s.bucket3_from - 1)::smallint,
         round((s.bucket2_from + s.bucket3_from) / 2.0)::smallint),
      (3::smallint, s.bucket3_from || '-' || s.bucket4_from, s.bucket3_from, (s.bucket4_from - 1)::smallint,
         round((s.bucket3_from + s.bucket4_from) / 2.0)::smallint),
      (4::smallint, s.bucket4_from || '+', s.bucket4_from, s.match_minutes,
         round((s.bucket4_from + s.match_minutes) / 2.0)::smallint)
    ) as b(bucket, label, min_from, min_to, midpoint)
   order by b.bucket
$$;
revoke all on function public.format_load_scale(text, text) from public, anon;
grant execute on function public.format_load_scale(text, text) to authenticated, service_role;

create function private.load_bucket(p_sport text, p_format text, p_minutes integer)
returns smallint language sql stable security definer set search_path = ''
as $$
  select case
           when p_minutes <= 0 then 0
           when p_minutes < s.bucket2_from then 1
           when p_minutes < s.bucket3_from then 2
           when p_minutes < s.bucket4_from then 3
           else 4
         end::smallint
    from private.sport_format(p_sport, p_format) s
$$;
revoke all on function private.load_bucket(text, text, integer) from public;

create function private.bucket_midpoint(p_sport text, p_format text, p_bucket integer)
returns smallint language sql stable security definer set search_path = ''
as $$ select sc.midpoint from public.format_load_scale(p_sport, p_format) sc where sc.bucket = p_bucket $$;
revoke all on function private.bucket_midpoint(text, text, integer) from public;

-- Nómina por puestos (0029): el tope sale del formato del evento.
create or replace function public.set_event_lineup(p_event_id uuid, p_lineup jsonb)
returns void language plpgsql security definer set search_path = ''
as $function$
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

  select f.starters + f.bench_size into v_max
    from public.events e
    join public.clubs c on c.id = e.club_id
    cross join lateral private.sport_format(c.sport, e.format) f
   where e.id = p_event_id;

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
end $function$;

-- Participación (0027): tope de minutos y rangos según el formato del evento.
create or replace function public.set_event_participation(p_event_id uuid, p_rows jsonb)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_club   uuid := private.current_club_id();
  v_mode   public.nomina_mode;
  v_sport  text;
  v_format text;
  v_max    smallint;
  v_row    jsonb;
  v_player uuid;
  v_callup uuid;
  v_min    int;
  v_bucket int;
  v_played boolean;
  has_min    boolean;
  has_bucket boolean;
  has_played boolean;
begin
  if v_club is null or not private.can_manage_nominas() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform 1 from public.events e where e.id = p_event_id and e.club_id = v_club;
  if not found then raise exception 'not_found'; end if;

  perform 1 from public.events e
   where e.id = p_event_id and e.type = 'competencia' and e.cancelled_at is null;
  if not found then raise exception 'Solo se carga la participación de eventos de competencia no cancelados'; end if;

  perform 1 from public.events e where e.id = p_event_id and e.starts_at <= now();
  if not found then raise exception 'El partido todavía no empieza'; end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Formato de participación inválido';
  end if;

  select c.nomina_mode, c.sport, e.format, f.max_minutes into v_mode, v_sport, v_format, v_max
    from public.events e
    join public.clubs c on c.id = e.club_id
    cross join lateral private.sport_format(c.sport, e.format) f
   where e.id = p_event_id;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(v_row) <> 'object' then raise exception 'Formato de participación inválido'; end if;

    begin
      v_player := (v_row ->> 'player_id')::uuid;
    exception when others then
      raise exception 'Jugador inválido';
    end;

    select c.id into v_callup from public.event_callups c
     where c.event_id = p_event_id and c.player_id = v_player and c.club_id = v_club
       and c.removed_at is null;
    if not found then raise exception 'El jugador no está convocado a este partido'; end if;

    has_min    := coalesce(jsonb_typeof(v_row -> 'minutes'), 'null') <> 'null';
    has_bucket := coalesce(jsonb_typeof(v_row -> 'range_bucket'), 'null') <> 'null';
    has_played := coalesce(jsonb_typeof(v_row -> 'played'), 'null') <> 'null';

    if v_mode = 'exacto' then
      if has_bucket or has_played then raise exception 'Este club registra minutos exactos'; end if;
      if not has_min or jsonb_typeof(v_row -> 'minutes') <> 'number' then
        raise exception 'Indica los minutos jugados';
      end if;
      if (v_row ->> 'minutes')::numeric <> trunc((v_row ->> 'minutes')::numeric) then
        raise exception 'Los minutos deben ser un número entero';
      end if;
      v_min := (v_row ->> 'minutes')::numeric::int;
      if v_min < 0 or v_min > v_max then
        raise exception 'Los minutos deben estar entre 0 y %', v_max;
      end if;
      v_bucket := private.load_bucket(v_sport, v_format, v_min);
      v_played := v_min > 0;

    elsif v_mode = 'rango' then
      if has_min or has_played then raise exception 'Este club registra rangos de minutos'; end if;
      if not has_bucket or jsonb_typeof(v_row -> 'range_bucket') <> 'number' then
        raise exception 'Indica el rango de minutos';
      end if;
      if (v_row ->> 'range_bucket') not in ('0', '1', '2', '3', '4') then
        raise exception 'El rango debe estar entre 0 y 4';
      end if;
      v_bucket := (v_row ->> 'range_bucket')::int;
      v_min    := null;
      v_played := v_bucket > 0;

    else -- jugo
      if has_min or has_bucket then raise exception 'Este club registra solo si jugó o no'; end if;
      if not has_played or jsonb_typeof(v_row -> 'played') <> 'boolean' then
        raise exception 'Indica si jugó';
      end if;
      v_played := (v_row ->> 'played')::boolean;
      v_min    := null;
      v_bucket := null;
    end if;

    insert into public.event_participations
      (callup_id, club_id, event_id, player_id, mode, minutes, range_bucket, played, recorded_by, recorded_at)
    values
      (v_callup, v_club, p_event_id, v_player, v_mode, v_min, v_bucket, v_played, (select auth.uid()), now())
    on conflict (callup_id) do update set
      mode = excluded.mode, minutes = excluded.minutes, range_bucket = excluded.range_bucket,
      played = excluded.played, recorded_by = excluded.recorded_by, recorded_at = excluded.recorded_at;
  end loop;
end $function$;

-- Carga del plantel (0028) por formato: solo eventos de ese formato y su escala. En '7',
-- el plantel es el grupo Sevens activo (cuentas con ficha de jugador en el club).
create function private.match_load(p_club uuid, p_matches integer, p_player uuid, p_format text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_mode    public.nomina_mode;
  v_sport   text;
  v_minutes smallint;
  v_events  uuid[];
  v_n       int;
  v_result  jsonb;
begin
  select c.nomina_mode, c.sport, f.match_minutes into v_mode, v_sport, v_minutes
    from public.clubs c cross join lateral private.sport_format(c.sport, p_format) f
   where c.id = p_club;

  select coalesce(array_agg(w.id), '{}') into v_events
    from (select e.id from public.events e
           where e.club_id = p_club and e.type = 'competencia' and e.cancelled_at is null
             and e.format = p_format
             and e.starts_at <= now()
             and exists (select 1 from public.event_participations ep
                           join public.event_callups cu on cu.id = ep.callup_id
                          where ep.event_id = e.id and cu.removed_at is null)
           order by e.starts_at desc
           limit p_matches) w;
  v_n := cardinality(v_events);

  with pl as (
    select p.id, p.full_name, p.position from public.players p
     where p.club_id = p_club and p.status = 'confirmado' and p.active
       and (p_format = '15' or exists (
             select 1 from public.sevens_group g
              where g.club_id = p_club and g.member_id = p.user_id and g.archived_at is null))),
  cells as (
    select pl.id as player_id, e.id as event_id, e.starts_at,
           cu.id is not null as convocado,
           ep.mode as rmode, ep.minutes, ep.range_bucket, ep.played
      from pl
      cross join public.events e
      left join public.event_callups cu
        on cu.event_id = e.id and cu.player_id = pl.id and cu.removed_at is null
      left join public.event_participations ep on ep.callup_id = cu.id
     where e.id = any (v_events)),
  vals as (
    select c.*,
           (c.rmode is not null
             and ((v_mode = 'exacto' and c.rmode <> 'exacto')
               or (v_mode = 'rango' and c.rmode = 'jugo'))) as other_mode,
           (case
              when c.rmode is null then 0
              when v_mode = 'jugo' then case when c.played then 1 else 0 end
              when v_mode = 'exacto' and c.rmode = 'exacto' then c.minutes
              when v_mode = 'rango' and c.rmode <> 'jugo' then private.bucket_midpoint(v_sport, p_format, c.range_bucket)
            end)::numeric as value,
           case when v_mode <> 'jugo' and c.rmode is not null and c.rmode <> 'jugo'
                  and not (v_mode = 'exacto' and c.rmode <> 'exacto')
                then c.range_bucket end as bucket
      from cells c),
  per_player as (
    select pl.id as player_id, pl.full_name, pl.position,
           coalesce(sum(v.value), 0) as total,
           count(v.event_id) filter (where v.other_mode) as other_mode,
           count(v.event_id) filter (where v.played) as played_count,
           coalesce(jsonb_agg(jsonb_build_object(
             'event_id', v.event_id, 'value', v.value, 'bucket', v.bucket,
             'played', coalesce(v.played, false), 'convocado', v.convocado,
             'loaded', v.rmode is not null, 'other_mode', v.other_mode)
             order by v.starts_at) filter (where v.event_id is not null), '[]') as vals
      from pl left join vals v on v.player_id = pl.id
     group by pl.id, pl.full_name, pl.position),
  ref as (
    select avg(total) filter (where total > 0) as reference,
           count(*) filter (where total > 0) as active_players
      from per_player)
  select jsonb_build_object(
    'mode', v_mode,
    'sport', v_sport,
    'format', p_format,
    'match_minutes', v_minutes,
    'window_size', p_matches,
    'matches_count', v_n,
    'scale', (select jsonb_agg(to_jsonb(sc) order by sc.bucket) from public.format_load_scale(v_sport, p_format) sc),
    'matches', (select coalesce(jsonb_agg(jsonb_build_object(
                  'event_id', e.id, 'starts_at', e.starts_at, 'opponent', e.opponent)
                  order by e.starts_at), '[]')
                  from public.events e where e.id = any (v_events)),
    'reference', (select round(reference, 1) from ref),
    'other_mode_count', (select count(*) from vals where other_mode
                          and (p_player is null or player_id = p_player)),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
               'player_id', pp.player_id, 'full_name', pp.full_name, 'position', pp.position,
               'total', pp.total, 'other_mode', pp.other_mode, 'played_count', pp.played_count,
               'status', case
                 when p_player is not null or v_n < 3 then null
                 when v_mode = 'jugo' then case
                   when pp.played_count >= v_n then 'alta'
                   when pp.played_count >= 2 then 'normal'
                   when pp.played_count = 1 then 'baja'
                   else 'sin_partidos' end
                 when pp.total = 0 then 'sin_minutos'
                 when pp.total >= 1.25 * r.reference then 'alta'
                 when pp.total <= 0.5 * r.reference then 'baja'
                 else 'normal' end,
               'values', pp.vals)
             order by pp.total desc, pp.full_name)
        from per_player pp cross join ref r
       where p_player is null or pp.player_id = p_player), '[]'))
  into v_result;

  return v_result;
end $function$;
revoke all on function private.match_load(uuid, integer, uuid, text) from public;

-- La versión de siempre es la del formato '15'.
create or replace function private.match_load(p_club uuid, p_matches integer, p_player uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$ select private.match_load(p_club, p_matches, p_player, '15') $$;

create function public.team_match_load(p_matches integer, p_format text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_club uuid := private.events_staff_club();
begin
  if v_club is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_matches is null or p_matches < 1 or p_matches > 12 then raise exception 'invalid_window'; end if;
  if p_format is null or p_format not in ('15', '7') then raise exception 'invalid_format'; end if;
  return private.match_load(v_club, p_matches, null, p_format);
end $function$;
revoke all on function public.team_match_load(integer, text) from public, anon;
grant execute on function public.team_match_load(integer, text) to authenticated, service_role;

create function public.my_match_load(p_format text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_club     uuid := private.current_club_id();
  v_player   uuid;
  v_load     jsonb;
  v_starters smallint;
begin
  if v_club is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_format is null or p_format not in ('15', '7') then raise exception 'invalid_format'; end if;
  select p.id into v_player from public.players p
   where p.user_id = (select auth.uid()) and p.club_id = v_club and p.status = 'confirmado';
  if v_player is null then raise exception 'forbidden' using errcode = '42501'; end if;

  select f.starters into v_starters
    from public.clubs c cross join lateral private.sport_format(c.sport, p_format) f where c.id = v_club;

  v_load := private.match_load(v_club, 6, v_player, p_format);

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
                 and e.cancelled_at is null and e.format = p_format
               order by e.starts_at desc
               limit 20) x), '[]')))
    - 'players';
end $function$;
revoke all on function public.my_match_load(text) from public, anon;
grant execute on function public.my_match_load(text) to authenticated, service_role;

-- La de siempre: formato '15'.
create or replace function public.my_match_load()
returns jsonb language sql stable security definer set search_path = ''
as $$ select public.my_match_load('15') $$;

-- ---------------------------------------------------------------------------
-- 6. Funciones de Sevens (plantel activo, como 0039)
-- ---------------------------------------------------------------------------
-- Activar o desactivar Sevens: head coach y manager; solo clubes de rugby.
create function public.set_club_sevens(p_enabled boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_club uuid := private.current_club_id();
begin
  if v_club is null or not private.is_direction(v_club) then
    raise exception 'No tienes permiso para esta acción' using errcode = '42501';
  end if;
  if p_enabled is null then raise exception 'Indica si Sevens queda activo'; end if;
  if p_enabled and not exists (select 1 from public.clubs where id = v_club and sport = 'rugby') then
    raise exception 'Solo los clubes de rugby pueden tener Sevens';
  end if;
  update public.clubs set has_sevens = p_enabled where id = v_club;
end $$;

-- Arma el grupo Sevens con la lista completa (atómico): agrega a los nuevos, archiva a
-- quienes salen y restaura a los archivados conservando su posición.
create function public.set_sevens_group(p_member_ids uuid[])
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_club uuid := private.current_club_id();
  v_ids  uuid[];
begin
  if v_club is null or not private.is_direction(v_club) then
    raise exception 'No tienes permiso para esta acción' using errcode = '42501';
  end if;
  if not exists (select 1 from public.clubs where id = v_club and has_sevens) then
    raise exception 'El club no tiene Sevens activado';
  end if;

  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(coalesce(p_member_ids, '{}')) x;
  if exists (
    select 1 from unnest(v_ids) as x(id)
     where not exists (
       select 1 from public.club_members m
        where m.user_id = x.id and m.club_id = v_club and m.status = 'confirmado'))
  then
    raise exception 'Solo se pueden agregar miembros confirmados del club';
  end if;

  update public.sevens_group g
     set archived_at = now()
   where g.club_id = v_club and g.archived_at is null and not (g.member_id = any (v_ids));

  insert into public.sevens_group (club_id, member_id)
  select v_club, x from unnest(v_ids) x
  on conflict (club_id, member_id) do update
    set archived_at = null, added_at = now()
    where public.sevens_group.archived_at is not null;
end $$;

-- La propia posición en Sevens: solo si la cuenta está en el grupo activo del plantel.
create function public.set_my_sevens_position(p_position text, p_secondary text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_club uuid := private.current_club_id();
  v_pos  text := nullif(btrim(p_position), '');
  v_sec  text := nullif(btrim(p_secondary), '');
begin
  if v_club is null then raise exception 'No tienes permiso para esta acción' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.sevens_group
     where club_id = v_club and member_id = (select auth.uid()) and archived_at is null) then
    raise exception 'No estás en el grupo Sevens' using errcode = '42501';
  end if;
  if v_pos is null then raise exception 'Elige tu posición principal en Sevens'; end if;
  if v_sec is not null and v_sec = v_pos then
    raise exception 'La posición secundaria debe ser distinta de la principal';
  end if;
  update public.sevens_group
     set position = v_pos, secondary_position = v_sec
   where club_id = v_club and member_id = (select auth.uid()) and archived_at is null;
end $$;

revoke all on function
  public.set_club_sevens(boolean),
  public.set_sevens_group(uuid[]),
  public.set_my_sevens_position(text, text)
from public, anon;
grant execute on function
  public.set_club_sevens(boolean),
  public.set_sevens_group(uuid[]),
  public.set_my_sevens_position(text, text)
to authenticated;
