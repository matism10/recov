-- Recov · 0028 · Nóminas (convocatoria) y carga del plantel
-- Ejecutar DESPUÉS de 0027.
--
-- El staff arma la convocatoria de un evento de competencia y, cuando el partido
-- ya empezó, carga la participación de cada convocado. Con eso se calcula la
-- carga del plantel (Métricas y ficha) y la carga propia del jugador.
--   Escriben:  head coach, manager y la persona delegada (clubs.nomina_delegate_id).
--   Leen:      todo el staff del club; el jugador solo sus propias filas.
--   Modo:      clubs.nomina_mode (exacto | rango | jugo), lo cambia la dirección.
-- Fuente de verdad por deporte: columnas de carga en public.sports (duración,
-- tope, cortes de los rangos). Puntos medios y etiquetas salen de ahí
-- (public.sport_load_scale); agregar un deporte es agregar una fila.
-- Quitar a alguien de la convocatoria no borra nada: su fila queda archivada
-- (removed_at) y su participación deja de contar; si se lo vuelve a convocar,
-- se reactiva la misma fila.
-- No hay escritura directa: authenticated solo tiene SELECT sobre las tablas.

-- ---------------------------------------------------------------------
-- Configuración de carga por deporte
-- ---------------------------------------------------------------------
alter table public.sports
  add column match_minutes smallint,   -- duración del partido (escala de las barras)
  add column max_minutes   smallint,   -- tope permitido en el modo exacto
  add column bucket2_from  smallint,   -- el rango 2 empieza en este minuto
  add column bucket3_from  smallint,
  add column bucket4_from  smallint;

update public.sports s set
  match_minutes = v.match_minutes, max_minutes = v.max_minutes,
  bucket2_from = v.b2, bucket3_from = v.b3, bucket4_from = v.b4
from (values
  ('rugby',      80, 100, 20, 40, 60),
  ('hockey',     60,  75, 15, 30, 45),
  ('futbol',     90, 120, 25, 45, 70),
  ('futsal',     40,  50, 10, 20, 30),
  ('handball',   60,  75, 15, 30, 45),
  ('basquetbol', 40,  50, 10, 20, 30),
  ('voleibol',   90, 150, 25, 45, 70)
) as v(slug, match_minutes, max_minutes, b2, b3, b4)
where s.slug = v.slug;

alter table public.sports
  alter column match_minutes set not null,
  alter column max_minutes   set not null,
  alter column bucket2_from  set not null,
  alter column bucket3_from  set not null,
  alter column bucket4_from  set not null;

-- Rangos ordenados y no vacíos: el 1 va de 1 al minuto anterior al corte del 2.
alter table public.sports add constraint sports_load_scale_chk check (
  bucket2_from >= 2
  and bucket2_from < bucket3_from
  and bucket3_from < bucket4_from
  and bucket4_from < match_minutes
  and match_minutes <= max_minutes);

-- Escala de rangos de un deporte: etiqueta, minutos que cubre y punto medio para
-- estimar. 0 = no jugó; el 1 se mide desde 0 hasta el corte del 2; el último llega
-- hasta la duración. Para rugby: 0, 10, 30, 50, 70.
create function public.sport_load_scale(p_sport text)
returns table (bucket smallint, label text, min_from smallint, min_to smallint, midpoint smallint)
language sql stable set search_path to ''
as $$
  select b.bucket, b.label, b.min_from, b.min_to, b.midpoint
    from public.sports s
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
   where s.slug = p_sport
   order by b.bucket
$$;

revoke all on function public.sport_load_scale(text) from public, anon, authenticated;
grant execute on function public.sport_load_scale(text) to authenticated;

-- Rango que corresponde a unos minutos en un deporte (derivación del modo exacto).
create function private.load_bucket(p_sport text, p_minutes int)
returns smallint
language sql stable security definer set search_path to ''
as $$
  select case
           when p_minutes <= 0 then 0
           when p_minutes < s.bucket2_from then 1
           when p_minutes < s.bucket3_from then 2
           when p_minutes < s.bucket4_from then 3
           else 4
         end::smallint
    from public.sports s where s.slug = p_sport
$$;

-- Punto medio de un rango (estimación de minutos en el modo rango).
create function private.bucket_midpoint(p_sport text, p_bucket int)
returns smallint
language sql stable security definer set search_path to ''
as $$
  select sc.midpoint from public.sport_load_scale(p_sport) sc where sc.bucket = p_bucket
$$;

revoke all on function private.load_bucket(text, int) from public, anon, authenticated;
revoke all on function private.bucket_midpoint(text, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Club: modo de registro y delegado de nóminas
-- ---------------------------------------------------------------------
alter table public.clubs add column nomina_mode public.nomina_mode not null default 'rango';
alter table public.clubs add column nomina_delegate_id uuid;

-- el delegado debe ser un perfil del mismo club (como kine_delegate_id)
alter table public.clubs add constraint clubs_nomina_delegate_fkey
  foreign key (nomina_delegate_id, id) references public.profiles (id, club_id)
  on delete set null (nomina_delegate_id);

-- Habilita la FK compuesta (evento, club) de la convocatoria.
alter table public.events add constraint events_id_club_key unique (id, club_id);

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------
-- Convocatoria: un jugador del club convocado a un evento de competencia del club.
create table public.event_callups (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  event_id   uuid not null,
  player_id  uuid not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  removed_at timestamptz,   -- quitado de la convocatoria (no se borra)
  removed_by uuid references public.profiles(id),
  constraint event_callups_event_player_key unique (event_id, player_id),
  -- habilita la FK compuesta de la participación
  constraint event_callups_full_key unique (id, event_id, player_id, club_id),
  foreign key (event_id, club_id) references public.events (id, club_id) on delete cascade,
  foreign key (player_id, club_id) references public.players (id, club_id) on delete cascade
);

create index event_callups_player_idx on public.event_callups (player_id);
create index event_callups_club_event_idx on public.event_callups (club_id, event_id);

-- Participación: una fila por convocado (si se borrara el convocado, se borra en
-- cascada; la app solo archiva). Solo cuenta mientras la convocatoria esté vigente.
-- mode guarda en qué modo se cargó; los campos derivados quedan coherentes con él.
create table public.event_participations (
  callup_id    uuid primary key,
  club_id      uuid not null,
  event_id     uuid not null,
  player_id    uuid not null,
  mode         public.nomina_mode not null,
  minutes      smallint,
  range_bucket smallint,
  played       boolean not null,
  recorded_by  uuid not null references public.profiles(id),
  recorded_at  timestamptz not null default now(),
  foreign key (callup_id, event_id, player_id, club_id)
    references public.event_callups (id, event_id, player_id, club_id) on delete cascade,
  constraint event_participations_minutes_chk check (minutes is null or minutes >= 0),
  constraint event_participations_bucket_chk check (range_bucket is null or range_bucket between 0 and 4),
  constraint event_participations_mode_chk check (
       (mode = 'exacto' and minutes is not null and range_bucket is not null and played = (minutes > 0))
    or (mode = 'rango'  and minutes is null and range_bucket is not null and played = (range_bucket > 0))
    or (mode = 'jugo'   and minutes is null and range_bucket is null))
);

create index event_participations_event_idx on public.event_participations (event_id);
create index event_participations_player_idx on public.event_participations (player_id);

alter table public.event_callups enable row level security;
alter table public.event_participations enable row level security;
revoke all on table public.event_callups from anon, authenticated;
revoke all on table public.event_participations from anon, authenticated;
grant select on table public.event_callups to authenticated;
grant select on table public.event_participations to authenticated;

-- Lectura: el staff ve todo su club; el jugador, solo sus propias filas.
create policy event_callups_select on public.event_callups
  for select to authenticated
  using (club_id = private.current_club_id()
         and (private.is_staff() or player_id = private.current_player_id()));

create policy event_participations_select on public.event_participations
  for select to authenticated
  using (club_id = private.current_club_id()
         and (private.is_staff() or player_id = private.current_player_id()));

-- ---------------------------------------------------------------------
-- Permisos de escritura
-- ---------------------------------------------------------------------
-- Arman la convocatoria y cargan la participación: head coach, manager y el
-- delegado de nóminas (staff confirmado del mismo club).
create function private.can_manage_nominas()
returns boolean
language sql stable security definer set search_path to ''
as $$
  select private.has_role('head_coach')
      or private.has_role('manager')
      or exists (
        select 1 from public.clubs c
          join public.profiles p on p.id = c.nomina_delegate_id and p.club_id = c.id
         where p.id = (select auth.uid()) and p.status = 'confirmado'
           and p.roles && private.staff_roles())
$$;

revoke all on function private.can_manage_nominas() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Guardar la convocatoria (reemplaza la lista completa)
-- ---------------------------------------------------------------------
-- Archiva a los que ya no están (su participación deja de contar), reactiva a los
-- que vuelven y agrega a los nuevos. Solo eventos de competencia no cancelados del propio club, y
-- jugadores confirmados y activos del club.
create function public.set_event_callups(p_event_id uuid, p_player_ids uuid[])
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
     set removed_at = now(), removed_by = (select auth.uid())
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
-- Guardar la participación (lote)
-- ---------------------------------------------------------------------
-- p_rows: [{"player_id": uuid, "minutes"?: int, "range_bucket"?: int, "played"?: bool}]
-- Según el modo del club se exige un solo campo y se rechazan los de otro modo:
--   exacto: minutes (0 al tope del deporte); played y range_bucket se derivan.
--   rango:  range_bucket (0 a 4); played = bucket > 0; minutes queda null.
--   jugo:   played; minutes y range_bucket quedan null.
-- Todo o nada: si una fila falla, no se guarda ninguna.
create function public.set_event_participation(p_event_id uuid, p_rows jsonb)
returns void
language plpgsql security definer set search_path to ''
as $$
declare
  v_club   uuid := private.current_club_id();
  v_mode   public.nomina_mode;
  v_sport  text;
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

  select c.nomina_mode, c.sport, s.max_minutes into v_mode, v_sport, v_max
    from public.clubs c join public.sports s on s.slug = c.sport
   where c.id = v_club;

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
      v_bucket := private.load_bucket(v_sport, v_min);
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
end $$;

-- ---------------------------------------------------------------------
-- Modo del club y delegado de nóminas (dirección)
-- ---------------------------------------------------------------------
create function public.set_nomina_mode(p_mode public.nomina_mode)
returns void
language plpgsql security definer set search_path to ''
as $$
declare
  v_club uuid := private.current_club_id();
begin
  if v_club is null or not private.is_direction() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_mode is null then raise exception 'Elige un modo de registro'; end if;
  update public.clubs set nomina_mode = p_mode where id = v_club;
end $$;

-- Igual que set_kine_delegate: la dirección delega las nóminas en alguien del
-- staff confirmado. NULL = quitar la delegación.
create function public.set_nomina_delegate(p_profile_id uuid)
returns void
language plpgsql security definer set search_path to ''
as $$
declare
  v_club   uuid := private.current_club_id();
  v_target public.profiles%rowtype;
begin
  if v_club is null or not private.is_direction() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_profile_id is null then
    update public.clubs set nomina_delegate_id = null where id = v_club;
    return;
  end if;

  select * into v_target from public.profiles
   where id = p_profile_id and club_id = v_club and status = 'confirmado';
  if not found or not (v_target.roles && private.staff_roles()) then
    raise exception 'La persona debe ser parte del staff confirmado';
  end if;

  update public.clubs set nomina_delegate_id = p_profile_id where id = v_club;
end $$;

-- ---------------------------------------------------------------------
-- Cálculo de la carga (interno)
-- ---------------------------------------------------------------------
-- Ventana: los últimos p_matches eventos de competencia del club, ya empezados y
-- no cancelados, que tengan participación cargada. Valor de cada jugador por
-- partido según el modo ACTUAL del club:
--   exacto: minutos (solo filas cargadas en exacto).
--   rango:  punto medio del rango (filas en exacto o rango).
--   jugo:   1 si jugó, 0 si no (cualquier fila).
-- Un dato menos detallado que el modo actual no se estima hacia arriba: queda
-- fuera del total y se cuenta en other_mode. No convocado (o sin fila, o quitado
-- de la convocatoria) = 0.
-- Semáforo (con 3 partidos o más en la ventana):
--   exacto/rango: referencia = promedio de totales > 0; alta >= 1,25 × ref,
--                 baja <= 0,5 × ref, sin_minutos si total = 0, si no normal.
--   jugo:         todos = alta, 2 o más = normal, 1 = baja, 0 = sin_partidos.
-- p_player: si viene, devuelve solo ese jugador y sin semáforo.
create function private.match_load(p_club uuid, p_matches int, p_player uuid)
returns jsonb
language plpgsql stable security definer set search_path to ''
as $$
declare
  v_mode    public.nomina_mode;
  v_sport   text;
  v_minutes smallint;
  v_events  uuid[];
  v_n       int;
  v_result  jsonb;
begin
  select c.nomina_mode, c.sport, s.match_minutes into v_mode, v_sport, v_minutes
    from public.clubs c join public.sports s on s.slug = c.sport
   where c.id = p_club;

  select coalesce(array_agg(w.id), '{}') into v_events
    from (select e.id from public.events e
           where e.club_id = p_club and e.type = 'competencia' and e.cancelled_at is null
             and e.starts_at <= now()
             and exists (select 1 from public.event_participations ep
                           join public.event_callups cu on cu.id = ep.callup_id
                          where ep.event_id = e.id and cu.removed_at is null)
           order by e.starts_at desc
           limit p_matches) w;
  v_n := cardinality(v_events);

  with pl as (
    select p.id, p.full_name, p.position from public.players p
     where p.club_id = p_club and p.status = 'confirmado' and p.active),
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
              when v_mode = 'rango' and c.rmode <> 'jugo' then private.bucket_midpoint(v_sport, c.range_bucket)
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
    'match_minutes', v_minutes,
    'window_size', p_matches,
    'matches_count', v_n,
    'scale', (select jsonb_agg(to_jsonb(sc) order by sc.bucket) from public.sport_load_scale(v_sport) sc),
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
end $$;

revoke all on function private.match_load(uuid, int, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Carga del plantel (staff)
-- ---------------------------------------------------------------------
create function public.team_match_load(p_matches int default 4)
returns jsonb
language plpgsql stable security definer set search_path to ''
as $$
declare
  v_club uuid := private.events_staff_club();
begin
  if v_club is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_matches is null or p_matches < 1 or p_matches > 12 then raise exception 'invalid_window'; end if;
  return private.match_load(v_club, p_matches, null);
end $$;

-- ---------------------------------------------------------------------
-- Carga propia del jugador
-- ---------------------------------------------------------------------
-- Solo al jugador autenticado: sus últimos 6 partidos, total de la ventana, la
-- referencia del plantel (solo el agregado) y sus convocatorias con participación.
-- Sin semáforo ni datos de otros jugadores.
create function public.my_match_load()
returns jsonb
language plpgsql stable security definer set search_path to ''
as $$
declare
  v_club   uuid := private.current_club_id();
  v_player uuid;
  v_load   jsonb;
begin
  if v_club is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select p.id into v_player from public.players p
   where p.user_id = (select auth.uid()) and p.club_id = v_club and p.status = 'confirmado';
  if v_player is null then raise exception 'forbidden' using errcode = '42501'; end if;

  v_load := private.match_load(v_club, 6, v_player);

  return (v_load || jsonb_build_object(
    'player', v_load -> 'players' -> 0,
    'callups', coalesce((
      select jsonb_agg(jsonb_build_object(
               'event_id', x.event_id, 'starts_at', x.starts_at, 'opponent', x.opponent,
               'location', x.location, 'mode', x.mode, 'minutes', x.minutes,
               'range_bucket', x.range_bucket, 'played', x.played, 'loaded', x.loaded)
             order by x.starts_at desc)
        from (select e.id as event_id, e.starts_at, e.opponent, e.location,
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

-- ---------------------------------------------------------------------
-- Permisos de las funciones
-- ---------------------------------------------------------------------
revoke all on function public.set_event_callups(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.set_event_participation(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.set_nomina_mode(public.nomina_mode) from public, anon, authenticated;
revoke all on function public.set_nomina_delegate(uuid) from public, anon, authenticated;
revoke all on function public.team_match_load(int) from public, anon, authenticated;
revoke all on function public.my_match_load() from public, anon, authenticated;
grant execute on function public.set_event_callups(uuid, uuid[]) to authenticated;
grant execute on function public.set_event_participation(uuid, jsonb) to authenticated;
grant execute on function public.set_nomina_mode(public.nomina_mode) to authenticated;
grant execute on function public.set_nomina_delegate(uuid) to authenticated;
grant execute on function public.team_match_load(int) to authenticated;
grant execute on function public.my_match_load() to authenticated;
