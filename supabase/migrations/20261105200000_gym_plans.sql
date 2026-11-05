-- Recov · Plan de gimnasio (fuerza y acondicionamiento).
-- El head coach o el preparador físico arma un plan con sesiones y ejercicios, lo asigna
-- (todo el plantel, posiciones, jugadores o el grupo Sevens) y lo publica. El jugador ve
-- "Mi plan de hoy" con los kilos calculados desde sus máximos de Evaluaciones, lo marca
-- como hecho y registra su esfuerzo.
-- Nada se borra: al editar, lo que se quita se marca con archived_at. Las sesiones y los
-- ejercicios que siguen en el plan conservan su id, así los registros ya hechos no cambian.
-- El gimnasio no tiene formato (cuenta en '15' y en '7').

-- ---------------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------------
create table public.gym_plans (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 2 and 80),
  starts_on    date not null,
  ends_on      date not null,
  status       text not null default 'borrador' check (status in ('borrador', 'publicado', 'archivado')),
  created_by   uuid not null references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz,
  archived_at  timestamptz,
  unique (id, club_id),
  check (ends_on >= starts_on),
  check (status <> 'publicado' or published_at is not null),
  check ((status = 'archivado') = (archived_at is not null))
);
create index gym_plans_club_idx on public.gym_plans (club_id, status, starts_on);

create table public.gym_plan_sessions (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null,
  plan_id     uuid not null,
  label       text not null check (char_length(btrim(label)) between 1 and 40),
  weekday     smallint not null check (weekday between 1 and 7),
  est_minutes smallint not null check (est_minutes between 10 and 240),
  sort        smallint not null default 0,
  archived_at timestamptz,
  unique (id, club_id),
  foreign key (plan_id, club_id) references public.gym_plans(id, club_id) on delete cascade
);
create index gym_plan_sessions_plan_idx on public.gym_plan_sessions (plan_id) where archived_at is null;

create table public.gym_plan_exercises (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null,
  session_id     uuid not null,
  sort           smallint not null default 0,
  name           text not null check (char_length(btrim(name)) between 2 and 60),
  sets           smallint not null check (sets between 1 and 10),
  reps           text not null check (char_length(btrim(reps)) between 1 and 12),
  intensity_type text not null check (intensity_type in ('pct', 'rpe', 'kg', 'bw')),
  pct            smallint check (pct between 30 and 110),
  test_id        uuid,
  rpe            smallint check (rpe between 1 and 10),
  kg             numeric(6,2) check (kg > 0),
  rest_seconds   smallint check (rest_seconds between 0 and 900),
  note           text check (note is null or char_length(note) <= 140),
  archived_at    timestamptz,
  foreign key (session_id, club_id) references public.gym_plan_sessions(id, club_id) on delete cascade,
  foreign key (test_id, club_id) references public.test_definitions(id, club_id),
  constraint gym_plan_exercises_intensity_check check (
    (intensity_type = 'pct' and pct is not null and test_id is not null and rpe is null and kg is null)
    or (intensity_type = 'rpe' and rpe is not null and pct is null and test_id is null and kg is null)
    or (intensity_type = 'kg' and kg is not null and pct is null and test_id is null and rpe is null)
    or (intensity_type = 'bw' and pct is null and test_id is null and rpe is null and kg is null))
);
create index gym_plan_exercises_session_idx on public.gym_plan_exercises (session_id) where archived_at is null;

create table public.gym_plan_targets (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null,
  plan_id     uuid not null,
  kind        text not null check (kind in ('plantel', 'posicion', 'jugador', 'sevens')),
  position_id uuid references public.positions(id),
  player_id   uuid,
  archived_at timestamptz,
  foreign key (plan_id, club_id) references public.gym_plans(id, club_id) on delete cascade,
  foreign key (player_id, club_id) references public.players(id, club_id),
  check ((kind = 'posicion') = (position_id is not null)),
  check ((kind = 'jugador') = (player_id is not null))
);
create index gym_plan_targets_plan_idx on public.gym_plan_targets (plan_id) where archived_at is null;

create table public.gym_plan_exclusions (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null,
  plan_id     uuid not null,
  player_id   uuid not null,
  archived_at timestamptz,
  foreign key (plan_id, club_id) references public.gym_plans(id, club_id) on delete cascade,
  foreign key (player_id, club_id) references public.players(id, club_id)
);
create index gym_plan_exclusions_plan_idx on public.gym_plan_exclusions (plan_id) where archived_at is null;

create table public.gym_session_logs (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null,
  player_id       uuid not null,
  plan_session_id uuid,                 -- null = sesión por su cuenta
  performed_on    date not null,
  minutes         smallint not null check (minutes between 10 and 240),
  rpe             smallint check (rpe between 0 and 10),
  completed_all   boolean not null default false,
  exercise_ids    uuid[] not null default '{}',
  note            text check (note is null or char_length(note) <= 140),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (player_id, club_id) references public.players(id, club_id),
  foreign key (plan_session_id, club_id) references public.gym_plan_sessions(id, club_id)
);
create unique index gym_session_logs_once_uq
  on public.gym_session_logs (player_id, plan_session_id, performed_on) where plan_session_id is not null;
create index gym_session_logs_club_player_idx on public.gym_session_logs (club_id, player_id, performed_on desc);

-- ---------------------------------------------------------------------------
-- 2. RLS: lectura acotada, sin escritura directa
-- ---------------------------------------------------------------------------
alter table public.gym_plans           enable row level security;
alter table public.gym_plan_sessions   enable row level security;
alter table public.gym_plan_exercises  enable row level security;
alter table public.gym_plan_targets    enable row level security;
alter table public.gym_plan_exclusions enable row level security;
alter table public.gym_session_logs    enable row level security;

revoke all on public.gym_plans, public.gym_plan_sessions, public.gym_plan_exercises,
              public.gym_plan_targets, public.gym_plan_exclusions, public.gym_session_logs
  from anon, authenticated;
grant select on public.gym_plans, public.gym_plan_sessions, public.gym_plan_exercises,
                public.gym_plan_targets, public.gym_plan_exclusions, public.gym_session_logs
  to authenticated;

-- Planes: solo el staff confirmado del club (el jugador ve lo suyo por my_gym_today/my_gym_week).
create policy gym_plans_select on public.gym_plans
  for select to authenticated using (private.is_staff(club_id));
create policy gym_plan_sessions_select on public.gym_plan_sessions
  for select to authenticated using (private.is_staff(club_id));
create policy gym_plan_exercises_select on public.gym_plan_exercises
  for select to authenticated using (private.is_staff(club_id));
create policy gym_plan_targets_select on public.gym_plan_targets
  for select to authenticated using (private.is_staff(club_id));
create policy gym_plan_exclusions_select on public.gym_plan_exclusions
  for select to authenticated using (private.is_staff(club_id));

-- Registros: el staff confirmado ve todo el club; el jugador, solo lo suyo.
create policy gym_session_logs_select on public.gym_session_logs
  for select to authenticated
  using (private.is_confirmed_member(club_id)
         and (private.is_staff(club_id) or player_id = private.current_player_id(club_id)));

-- ---------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------
create function private.chile_today()
returns date language sql stable set search_path = ''
as $$ select (now() at time zone 'America/Santiago')::date $$;
revoke all on function private.chile_today() from public;

-- Jugadores que reciben un plan: confirmados y activos que caen en algún destinatario
-- vigente, menos las exclusiones. Los lesionados lo reciben salvo que se les excluya.
-- Posición: la principal del jugador (players.position).
create function private.gym_plan_players(p_plan_id uuid)
returns table (player_id uuid)
language sql stable security definer set search_path = ''
as $$
  select p.id
    from public.gym_plans gp
    join public.players p on p.club_id = gp.club_id
   where gp.id = p_plan_id
     and p.status = 'confirmado' and p.active
     and exists (
       select 1 from public.gym_plan_targets t
        where t.plan_id = gp.id and t.archived_at is null
          and (t.kind = 'plantel'
               or (t.kind = 'jugador' and t.player_id = p.id)
               or (t.kind = 'posicion' and exists (
                     select 1 from public.positions pos where pos.id = t.position_id and pos.name = p.position))
               or (t.kind = 'sevens' and private.in_format(gp.club_id, p.user_id, '7'))))
     and not exists (
       select 1 from public.gym_plan_exclusions x
        where x.plan_id = gp.id and x.player_id = p.id and x.archived_at is null)
$$;
revoke all on function private.gym_plan_players(uuid) from public;

-- Sesiones asignadas en un rango de fechas: una fila por jugador, sesión y día.
-- Cuentan los planes publicados (o archivados después de publicarse), desde el día en
-- que se publicaron y hasta el día anterior al archivo, dentro de su vigencia, el día de
-- la semana de cada sesión. done_log_id: el registro de esa sesión ese día, si existe.
create function private.gym_assignments(p_club uuid, p_from date, p_to date, p_player uuid default null)
returns table (player_id uuid, plan_id uuid, plan_name text, plan_session_id uuid, label text,
               est_minutes smallint, day date, done_log_id uuid)
language sql stable security definer set search_path = ''
as $$
  select pp.player_id, gp.id, gp.name, s.id, s.label, s.est_minutes, d.day::date,
         (select l.id from public.gym_session_logs l
           where l.plan_session_id = s.id and l.player_id = pp.player_id and l.performed_on = d.day::date)
    from public.gym_plans gp
    join public.gym_plan_sessions s on s.plan_id = gp.id and s.archived_at is null
    cross join lateral generate_series(
      greatest(gp.starts_on, p_from, (gp.published_at at time zone 'America/Santiago')::date)::timestamp,
      least(gp.ends_on, p_to, coalesce((gp.archived_at at time zone 'America/Santiago')::date - 1, gp.ends_on))::timestamp,
      interval '1 day') d(day)
    cross join lateral private.gym_plan_players(gp.id) pp
   where gp.club_id = p_club and gp.published_at is not null and gp.status <> 'borrador'
     and extract(isodow from d.day)::smallint = s.weekday
     and (p_player is null or pp.player_id = p_player)
$$;
revoke all on function private.gym_assignments(uuid, date, date, uuid) from public;

-- Kilos de un ejercicio con % del máximo: último resultado no anulado del test, × pct,
-- redondeado a 2,5 kg. Sin test, null.
create function private.gym_last_max(p_player uuid, p_test uuid)
returns numeric language sql stable security definer set search_path = ''
as $$
  select r.value from public.test_results r
   where r.player_id = p_player and r.test_id = p_test and r.voided_at is null
   order by r.measured_on desc, r.recorded_at desc limit 1
$$;
revoke all on function private.gym_last_max(uuid, uuid) from public;

create function private.gym_round_kg(p_max numeric, p_pct smallint)
returns numeric language sql immutable set search_path = ''
as $$ select round(p_max * p_pct / 100.0 / 2.5) * 2.5 $$;
revoke all on function private.gym_round_kg(numeric, smallint) from public;

-- Ejercicios vigentes de una sesión, con los kilos calculados para un jugador.
create function private.gym_session_exercises(p_session uuid, p_player uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'sort', e.sort, 'name', e.name, 'sets', e.sets, 'reps', e.reps,
           'intensity_type', e.intensity_type, 'pct', e.pct, 'rpe', e.rpe, 'kg', e.kg,
           'rest_seconds', e.rest_seconds, 'note', e.note,
           'test_id', e.test_id, 'test_name', td.name,
           'max', m.v,
           'calc_kg', case when e.intensity_type = 'pct' and m.v is not null
                           then private.gym_round_kg(m.v, e.pct) end)
           order by e.sort, e.name), '[]')
    from public.gym_plan_exercises e
    left join public.test_definitions td on td.id = e.test_id
    left join lateral (select private.gym_last_max(p_player, e.test_id) as v) m on e.test_id is not null
   where e.session_id = p_session and e.archived_at is null
$$;
revoke all on function private.gym_session_exercises(uuid, uuid) from public;

-- Head coach o preparador físico confirmados del plantel activo; si no, 42501.
create function private.gym_planner_club()
returns uuid language plpgsql stable security definer set search_path = ''
as $$
declare
  v_club uuid := private.current_club_id();
begin
  if v_club is null or not (private.has_role(v_club, 'head_coach') or private.has_role(v_club, 'preparador_fisico')) then
    raise exception 'No tienes permiso para esta acción' using errcode = '42501';
  end if;
  return v_club;
end $$;
revoke all on function private.gym_planner_club() from public;

-- Un test sirve para "% del máximo" si es del club, no está archivado y se mide en kilos.
create function private.gym_kg_test(p_club uuid, p_test uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.test_definitions t
                  where t.id = p_test and t.club_id = p_club and t.archived_at is null
                    and lower(btrim(t.unit)) in ('kg', 'kgs', 'kilos'))
$$;
revoke all on function private.gym_kg_test(uuid, uuid) from public;

-- ---------------------------------------------------------------------------
-- 4. Escritura de planes
-- ---------------------------------------------------------------------------
-- Crea o reemplaza el plan completo (sesiones, ejercicios, destinatarios y exclusiones)
-- en una transacción. p_plan:
--   { id?, name, starts_on, ends_on,
--     sessions: [{ id?, label, weekday, est_minutes,
--                  exercises: [{ id?, name, sets, reps, intensity_type, pct, test_id, rpe, kg,
--                                rest_seconds, note }] }],
--     targets: [{ kind, position_id?, player_id? }],
--     exclusions: [player_id, …] }
-- Sesiones y ejercicios con id del mismo plan se actualizan; los que faltan se archivan.
-- Un plan publicado se puede editar (sigue publicado); uno archivado, no.
create function public.save_gym_plan(p_plan jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_club    uuid := private.gym_planner_club();
  v_sport   text;
  v_id      uuid;
  v_status  text;
  v_name    text := btrim(coalesce(p_plan->>'name', ''));
  v_starts  date;
  v_ends    date;
  s         jsonb;
  e         jsonb;
  t         jsonb;
  x         text;
  v_sid     uuid;
  v_eid     uuid;
  v_ssort   int := 0;
  v_esort   int;
  v_keep_s  uuid[] := '{}';
  v_keep_e  uuid[] := '{}';
  v_type    text;
begin
  if jsonb_typeof(p_plan) is distinct from 'object' then raise exception 'Plan inválido'; end if;
  if char_length(v_name) not between 2 and 80 then
    raise exception 'El nombre debe tener entre 2 y 80 caracteres';
  end if;
  begin
    v_starts := (p_plan->>'starts_on')::date;
    v_ends := (p_plan->>'ends_on')::date;
  exception when others then
    raise exception 'Revisa las fechas de vigencia';
  end;
  if v_starts is null or v_ends is null then raise exception 'Elige la vigencia del plan'; end if;
  if v_ends < v_starts then raise exception 'La vigencia termina antes de empezar'; end if;
  if v_ends - v_starts > 366 then raise exception 'La vigencia no puede pasar de un año'; end if;
  if jsonb_typeof(coalesce(p_plan->'sessions', '[]')) <> 'array'
     or jsonb_array_length(coalesce(p_plan->'sessions', '[]')) > 14 then
    raise exception 'Revisa las sesiones del plan';
  end if;

  select c.sport into v_sport from public.clubs c where c.id = v_club;

  -- Plan
  v_id := nullif(p_plan->>'id', '')::uuid;
  if v_id is not null then
    select gp.status into v_status from public.gym_plans gp where gp.id = v_id and gp.club_id = v_club for update;
    if not found then raise exception 'not_found'; end if;
    if v_status = 'archivado' then raise exception 'El plan está archivado'; end if;
    update public.gym_plans
       set name = v_name, starts_on = v_starts, ends_on = v_ends, updated_at = now()
     where id = v_id;
  else
    insert into public.gym_plans (club_id, name, starts_on, ends_on, created_by)
    values (v_club, v_name, v_starts, v_ends, (select auth.uid()))
    returning id into v_id;
  end if;

  -- Sesiones y ejercicios
  for s in select value from jsonb_array_elements(coalesce(p_plan->'sessions', '[]')) loop
    v_ssort := v_ssort + 1;
    v_sid := nullif(s->>'id', '')::uuid;
    if v_sid is not null and not exists (
      select 1 from public.gym_plan_sessions gs where gs.id = v_sid and gs.plan_id = v_id) then
      v_sid := null;   -- id ajeno o de otro plan: se crea una sesión nueva
    end if;
    if char_length(btrim(coalesce(s->>'label', ''))) not between 1 and 40 then
      raise exception 'Cada sesión necesita un nombre (hasta 40 caracteres)';
    end if;
    if coalesce((s->>'weekday')::int, 0) not between 1 and 7 then
      raise exception 'Elige el día de cada sesión';
    end if;
    if coalesce((s->>'est_minutes')::int, 0) not between 10 and 240 then
      raise exception 'La duración de cada sesión va de 10 a 240 minutos';
    end if;
    if jsonb_typeof(coalesce(s->'exercises', '[]')) <> 'array'
       or jsonb_array_length(coalesce(s->'exercises', '[]')) > 30 then
      raise exception 'Revisa los ejercicios de la sesión';
    end if;

    if v_sid is null then
      insert into public.gym_plan_sessions (club_id, plan_id, label, weekday, est_minutes, sort)
      values (v_club, v_id, btrim(s->>'label'), (s->>'weekday')::smallint, (s->>'est_minutes')::smallint, v_ssort)
      returning id into v_sid;
    else
      update public.gym_plan_sessions
         set label = btrim(s->>'label'), weekday = (s->>'weekday')::smallint,
             est_minutes = (s->>'est_minutes')::smallint, sort = v_ssort, archived_at = null
       where id = v_sid;
    end if;
    v_keep_s := v_keep_s || v_sid;

    v_esort := 0;
    for e in select value from jsonb_array_elements(coalesce(s->'exercises', '[]')) loop
      v_esort := v_esort + 1;
      v_type := e->>'intensity_type';
      if char_length(btrim(coalesce(e->>'name', ''))) not between 2 and 60 then
        raise exception 'Cada ejercicio necesita un nombre de 2 a 60 caracteres';
      end if;
      if coalesce((e->>'sets')::int, 0) not between 1 and 10 then
        raise exception 'Las series van de 1 a 10 (%)', btrim(e->>'name');
      end if;
      if char_length(btrim(coalesce(e->>'reps', ''))) not between 1 and 12 then
        raise exception 'Revisa las repeticiones (%)', btrim(e->>'name');
      end if;
      if v_type is null or v_type not in ('pct', 'rpe', 'kg', 'bw') then
        raise exception 'Elige la intensidad (%)', btrim(e->>'name');
      end if;
      if v_type = 'pct' and (coalesce((e->>'pct')::int, 0) not between 30 and 110
                             or not private.gym_kg_test(v_club, nullif(e->>'test_id', '')::uuid)) then
        raise exception 'Elige el porcentaje (30 a 110) y un test en kilos (%)', btrim(e->>'name');
      end if;
      if v_type = 'rpe' and coalesce((e->>'rpe')::int, 0) not between 1 and 10 then
        raise exception 'El esfuerzo va de 1 a 10 (%)', btrim(e->>'name');
      end if;
      if v_type = 'kg' and (coalesce((e->>'kg')::numeric, 0) <= 0 or (e->>'kg')::numeric >= 10000) then
        raise exception 'Revisa los kilos (%)', btrim(e->>'name');
      end if;
      if nullif(e->>'rest_seconds', '') is not null and (e->>'rest_seconds')::int not between 0 and 900 then
        raise exception 'El descanso va de 0 a 15 minutos (%)', btrim(e->>'name');
      end if;
      if char_length(coalesce(e->>'note', '')) > 140 then
        raise exception 'La nota tiene hasta 140 caracteres (%)', btrim(e->>'name');
      end if;

      v_eid := nullif(e->>'id', '')::uuid;
      if v_eid is not null and not exists (
        select 1 from public.gym_plan_exercises ge
          join public.gym_plan_sessions gs on gs.id = ge.session_id
         where ge.id = v_eid and gs.plan_id = v_id) then
        v_eid := null;
      end if;

      if v_eid is null then
        insert into public.gym_plan_exercises
          (club_id, session_id, sort, name, sets, reps, intensity_type, pct, test_id, rpe, kg, rest_seconds, note)
        values (v_club, v_sid, v_esort, btrim(e->>'name'), (e->>'sets')::smallint, btrim(e->>'reps'), v_type,
                case when v_type = 'pct' then (e->>'pct')::smallint end,
                case when v_type = 'pct' then (e->>'test_id')::uuid end,
                case when v_type = 'rpe' then (e->>'rpe')::smallint end,
                case when v_type = 'kg' then (e->>'kg')::numeric end,
                nullif(e->>'rest_seconds', '')::smallint,
                nullif(btrim(coalesce(e->>'note', '')), ''))
        returning id into v_eid;
      else
        update public.gym_plan_exercises
           set session_id = v_sid, sort = v_esort, name = btrim(e->>'name'), sets = (e->>'sets')::smallint,
               reps = btrim(e->>'reps'), intensity_type = v_type,
               pct = case when v_type = 'pct' then (e->>'pct')::smallint end,
               test_id = case when v_type = 'pct' then (e->>'test_id')::uuid end,
               rpe = case when v_type = 'rpe' then (e->>'rpe')::smallint end,
               kg = case when v_type = 'kg' then (e->>'kg')::numeric end,
               rest_seconds = nullif(e->>'rest_seconds', '')::smallint,
               note = nullif(btrim(coalesce(e->>'note', '')), ''),
               archived_at = null
         where id = v_eid;
      end if;
      v_keep_e := v_keep_e || v_eid;
    end loop;
  end loop;

  -- Lo que ya no está en el plan se archiva (no se borra).
  update public.gym_plan_sessions set archived_at = now()
   where plan_id = v_id and archived_at is null and not (id = any (v_keep_s));
  update public.gym_plan_exercises ge set archived_at = now()
    from public.gym_plan_sessions gs
   where gs.id = ge.session_id and gs.plan_id = v_id and ge.archived_at is null and not (ge.id = any (v_keep_e));

  -- Destinatarios y exclusiones: se reemplazan completos.
  update public.gym_plan_targets set archived_at = now() where plan_id = v_id and archived_at is null;
  for t in select value from jsonb_array_elements(coalesce(p_plan->'targets', '[]')) loop
    case t->>'kind'
      when 'plantel' then
        insert into public.gym_plan_targets (club_id, plan_id, kind) values (v_club, v_id, 'plantel');
      when 'sevens' then
        if not exists (select 1 from public.clubs c where c.id = v_club and c.has_sevens) then
          raise exception 'El plantel no tiene Sevens';
        end if;
        insert into public.gym_plan_targets (club_id, plan_id, kind) values (v_club, v_id, 'sevens');
      when 'posicion' then
        if not exists (select 1 from public.positions pos
                        where pos.id = nullif(t->>'position_id', '')::uuid and pos.sport = v_sport and pos.format = '15') then
          raise exception 'Posición inválida';
        end if;
        insert into public.gym_plan_targets (club_id, plan_id, kind, position_id)
        values (v_club, v_id, 'posicion', (t->>'position_id')::uuid);
      when 'jugador' then
        if not exists (select 1 from public.players p
                        where p.id = nullif(t->>'player_id', '')::uuid and p.club_id = v_club) then
          raise exception 'Jugador inválido';
        end if;
        insert into public.gym_plan_targets (club_id, plan_id, kind, player_id)
        values (v_club, v_id, 'jugador', (t->>'player_id')::uuid);
      else
        raise exception 'Destinatario inválido';
    end case;
  end loop;

  update public.gym_plan_exclusions set archived_at = now() where plan_id = v_id and archived_at is null;
  for x in select value from jsonb_array_elements_text(coalesce(p_plan->'exclusions', '[]')) loop
    if not exists (select 1 from public.players p where p.id = nullif(x, '')::uuid and p.club_id = v_club) then
      raise exception 'Jugador inválido';
    end if;
    insert into public.gym_plan_exclusions (club_id, plan_id, player_id) values (v_club, v_id, x::uuid);
  end loop;

  return v_id;
end $$;
revoke all on function public.save_gym_plan(jsonb) from public, anon;
grant execute on function public.save_gym_plan(jsonb) to authenticated;

create function public.publish_gym_plan(p_plan_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_club   uuid := private.gym_planner_club();
  v_status text;
begin
  select gp.status into v_status from public.gym_plans gp where gp.id = p_plan_id and gp.club_id = v_club for update;
  if not found then raise exception 'not_found'; end if;
  if v_status = 'archivado' then raise exception 'El plan está archivado'; end if;
  if not exists (select 1 from public.gym_plan_sessions s
                   join public.gym_plan_exercises e on e.session_id = s.id and e.archived_at is null
                  where s.plan_id = p_plan_id and s.archived_at is null) then
    raise exception 'Agrega al menos un ejercicio antes de publicar';
  end if;
  if not exists (select 1 from public.gym_plan_targets t where t.plan_id = p_plan_id and t.archived_at is null) then
    raise exception 'Elige a quién va el plan antes de publicar';
  end if;
  update public.gym_plans
     set status = 'publicado', published_at = coalesce(published_at, now()), updated_at = now()
   where id = p_plan_id;
end $$;
revoke all on function public.publish_gym_plan(uuid) from public, anon;
grant execute on function public.publish_gym_plan(uuid) to authenticated;

create function public.archive_gym_plan(p_plan_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_club uuid := private.gym_planner_club();
begin
  update public.gym_plans
     set status = 'archivado', archived_at = coalesce(archived_at, now()), updated_at = now()
   where id = p_plan_id and club_id = v_club;
  if not found then raise exception 'not_found'; end if;
end $$;
revoke all on function public.archive_gym_plan(uuid) from public, anon;
grant execute on function public.archive_gym_plan(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Registro del jugador
-- ---------------------------------------------------------------------------
-- Plazo: el día de la sesión y hasta 48 h después de que termina ese día (Chile), o sea,
-- el mismo día y los 2 siguientes. Lo mismo para registrar el esfuerzo.
create function private.gym_in_window(p_day date)
returns boolean language sql stable set search_path = ''
as $$ select p_day between private.chile_today() - 2 and private.chile_today() $$;
revoke all on function private.gym_in_window(date) from public;

-- Marca una sesión del plan como hecha (o corrige lo marcado en el plazo). La fecha es el
-- día de esa sesión dentro del plazo (hoy o los 2 días anteriores). p_all = true marca
-- todos los ejercicios. minutes = duración estimada de la sesión.
create function public.complete_gym_session(p_plan_session_id uuid, p_exercise_ids uuid[], p_all boolean default false)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_club   uuid := private.current_club_id();
  v_player uuid;
  s        record;
  v_day    date;
  v_all    uuid[];
  v_ids    uuid[];
  v_log    uuid;
begin
  if v_club is null then raise exception 'forbidden' using errcode = '42501'; end if;
  v_player := private.my_active_player(v_club);
  if v_player is null then raise exception 'forbidden' using errcode = '42501'; end if;

  select gs.id, gs.weekday, gs.est_minutes, gp.id as plan_id, gp.status, gp.starts_on, gp.ends_on
    into s
    from public.gym_plan_sessions gs join public.gym_plans gp on gp.id = gs.plan_id
   where gs.id = p_plan_session_id and gs.club_id = v_club and gs.archived_at is null;
  if not found then raise exception 'not_found'; end if;
  if s.status <> 'publicado' then raise exception 'El plan no está publicado'; end if;
  if not exists (select 1 from private.gym_plan_players(s.plan_id) pp where pp.player_id = v_player) then
    raise exception 'Este plan no está asignado a ti';
  end if;

  -- Día de la sesión dentro del plazo (a lo más uno: el plazo dura 3 días).
  select d::date into v_day
    from generate_series((private.chile_today() - 2)::timestamp, private.chile_today()::timestamp, interval '1 day') d
   where extract(isodow from d)::smallint = s.weekday
   order by d desc limit 1;
  if v_day is null then raise exception 'Ya pasó el plazo para marcar esta sesión'; end if;
  if v_day not between s.starts_on and s.ends_on then raise exception 'El plan no está vigente ese día'; end if;

  select coalesce(array_agg(e.id), '{}') into v_all
    from public.gym_plan_exercises e where e.session_id = s.id and e.archived_at is null;
  if coalesce(p_all, false) then
    v_ids := v_all;
  else
    select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(coalesce(p_exercise_ids, '{}')) x;
    if cardinality(v_ids) = 0 then raise exception 'Marca al menos un ejercicio'; end if;
    if not (v_ids <@ v_all) then raise exception 'Hay ejercicios que no son de esta sesión'; end if;
  end if;

  insert into public.gym_session_logs (club_id, player_id, plan_session_id, performed_on, minutes, completed_all, exercise_ids)
  values (v_club, v_player, s.id, v_day, s.est_minutes, cardinality(v_ids) = cardinality(v_all), v_ids)
  on conflict (player_id, plan_session_id, performed_on) where plan_session_id is not null do update
    set exercise_ids = excluded.exercise_ids, completed_all = excluded.completed_all, updated_at = now()
  returning id into v_log;
  return v_log;
end $$;
revoke all on function public.complete_gym_session(uuid, uuid[], boolean) from public, anon;
grant execute on function public.complete_gym_session(uuid, uuid[], boolean) to authenticated;

-- Sesión de gimnasio por su cuenta (fuera del plan): hoy o hasta 2 días atrás.
create function public.log_own_gym_session(p_date date, p_minutes smallint, p_rpe smallint default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_club   uuid := private.current_club_id();
  v_player uuid;
  v_log    uuid;
begin
  if v_club is null then raise exception 'forbidden' using errcode = '42501'; end if;
  v_player := private.my_active_player(v_club);
  if v_player is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_date is null or not private.gym_in_window(p_date) then
    raise exception 'La fecha puede ser hoy o hasta 2 días atrás';
  end if;
  if p_minutes is null or p_minutes not between 10 and 240 then
    raise exception 'La duración va de 10 a 240 minutos';
  end if;
  if p_rpe is not null and p_rpe not between 0 and 10 then raise exception 'Elige un valor de 0 a 10'; end if;
  if char_length(coalesce(p_note, '')) > 140 then raise exception 'La nota tiene hasta 140 caracteres'; end if;

  insert into public.gym_session_logs (club_id, player_id, performed_on, minutes, rpe, note)
  values (v_club, v_player, p_date, p_minutes, p_rpe, nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_log;
  return v_log;
end $$;
revoke all on function public.log_own_gym_session(date, smallint, smallint, text) from public, anon;
grant execute on function public.log_own_gym_session(date, smallint, smallint, text) to authenticated;

-- Esfuerzo de una sesión de gimnasio: solo el dueño, en el plazo; se puede corregir.
create function public.submit_gym_rpe(p_log_id uuid, p_rpe smallint)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_club   uuid := private.current_club_id();
  v_player uuid;
  v_day    date;
begin
  if v_club is null then raise exception 'forbidden' using errcode = '42501'; end if;
  v_player := private.my_active_player(v_club);
  if v_player is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select l.performed_on into v_day from public.gym_session_logs l
   where l.id = p_log_id and l.club_id = v_club and l.player_id = v_player;
  if not found then raise exception 'not_found'; end if;
  if not private.gym_in_window(v_day) then raise exception 'Ya pasó el plazo para responder'; end if;
  if p_rpe is null or p_rpe not between 0 and 10 then raise exception 'Elige un valor de 0 a 10'; end if;
  update public.gym_session_logs set rpe = p_rpe, updated_at = now() where id = p_log_id;
end $$;
revoke all on function public.submit_gym_rpe(uuid, smallint) from public, anon;
grant execute on function public.submit_gym_rpe(uuid, smallint) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Lecturas del jugador
-- ---------------------------------------------------------------------------
-- Sesiones que le tocan hoy y las pendientes de los 2 días anteriores (dentro del plazo),
-- con sus ejercicios y kilos; también las ya hechas en ese plazo (con log_id, para
-- corregir). next: la próxima sesión de los siguientes 14 días.
create function public.my_gym_today()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_club   uuid := private.current_club_id();
  v_player uuid;
  v_today  date := private.chile_today();
  v_out    jsonb;
  v_next   jsonb;
begin
  if v_club is null then raise exception 'forbidden' using errcode = '42501'; end if;
  v_player := private.my_active_player(v_club);
  if v_player is null then raise exception 'forbidden' using errcode = '42501'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'plan_session_id', a.plan_session_id, 'plan_id', a.plan_id, 'plan_name', a.plan_name,
           'label', a.label, 'est_minutes', a.est_minutes, 'date', a.day, 'today', a.day = v_today,
           'log_id', a.done_log_id,
           'done_ids', (select l.exercise_ids from public.gym_session_logs l where l.id = a.done_log_id),
           'rpe', (select l.rpe from public.gym_session_logs l where l.id = a.done_log_id),
           'exercises', private.gym_session_exercises(a.plan_session_id, v_player))
           order by a.day desc, a.label), '[]')
    into v_out
    from private.gym_assignments(v_club, v_today - 2, v_today, v_player) a
    join public.gym_plans gp on gp.id = a.plan_id
   where gp.status = 'publicado';

  select jsonb_build_object('plan_session_id', a.plan_session_id, 'plan_name', a.plan_name, 'label', a.label,
                            'est_minutes', a.est_minutes, 'date', a.day,
                            'exercise_count', (select count(*) from public.gym_plan_exercises e
                                                where e.session_id = a.plan_session_id and e.archived_at is null))
    into v_next
    from private.gym_assignments(v_club, v_today + 1, v_today + 14, v_player) a
    join public.gym_plans gp on gp.id = a.plan_id
   where gp.status = 'publicado'
   order by a.day, a.label limit 1;

  return jsonb_build_object('today', v_today, 'sessions', v_out, 'next', v_next);
end $$;
revoke all on function public.my_gym_today() from public, anon;
grant execute on function public.my_gym_today() to authenticated;

-- Sesiones del plan por día de la semana que empieza en p_monday, con si están hechas.
create function public.my_gym_week(p_monday date)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_club   uuid := private.current_club_id();
  v_player uuid;
begin
  if v_club is null then raise exception 'forbidden' using errcode = '42501'; end if;
  v_player := private.my_active_player(v_club);
  if v_player is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_monday is null or extract(isodow from p_monday) <> 1 then raise exception 'La semana empieza un lunes'; end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'date', a.day, 'plan_session_id', a.plan_session_id, 'plan_name', a.plan_name, 'label', a.label,
             'est_minutes', a.est_minutes, 'done', a.done_log_id is not null, 'log_id', a.done_log_id)
             order by a.day, a.label), '[]')
      from private.gym_assignments(v_club, p_monday, p_monday + 6, v_player) a
      join public.gym_plans gp on gp.id = a.plan_id
     where gp.status = 'publicado');
end $$;
revoke all on function public.my_gym_week(date) from public, anon;
grant execute on function public.my_gym_week(date) to authenticated;

-- Pantalla "¡Felicidades!": un registro propio con ejercicios hechos, sesiones de la
-- semana (hechas de asignadas) y semanas seguidas cumpliendo el plan.
-- Racha: hacia atrás desde la semana actual; la semana en curso suma solo si ya está
-- completa (si no, se salta); las semanas sin sesiones asignadas se saltan; una semana
-- incompleta corta la racha.
create function public.my_gym_log_summary(p_log_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_club   uuid := private.current_club_id();
  v_player uuid;
  l        record;
  v_ws     date := date_trunc('week', private.chile_today())::date;
  v_total  int;
  v_wa     int;
  v_wd     int;
  v_streak int := 0;
  w        record;
begin
  if v_club is null then raise exception 'forbidden' using errcode = '42501'; end if;
  v_player := private.my_active_player(v_club);
  if v_player is null then raise exception 'forbidden' using errcode = '42501'; end if;

  select gl.*, gs.label, p.first_name, p.full_name into l
    from public.gym_session_logs gl
    join public.players p on p.id = gl.player_id
    left join public.gym_plan_sessions gs on gs.id = gl.plan_session_id
   where gl.id = p_log_id and gl.club_id = v_club and gl.player_id = v_player;
  if not found then raise exception 'not_found'; end if;

  if l.plan_session_id is not null then
    select count(*) into v_total from public.gym_plan_exercises e
     where e.session_id = l.plan_session_id and (e.archived_at is null or e.id = any (l.exercise_ids));
  end if;

  select count(*), count(a.done_log_id) into v_wa, v_wd
    from private.gym_assignments(v_club, v_ws, v_ws + 6, v_player) a;

  for w in
    select g.ws, count(a.plan_session_id) as assigned, count(a.done_log_id) as done
      from generate_series(0, 25) k
      cross join lateral (select (v_ws - 7 * k)::date as ws) g
      left join private.gym_assignments(v_club, v_ws - 7 * 25, v_ws + 6, v_player) a
        on a.day between g.ws and g.ws + 6
     group by g.ws order by g.ws desc
  loop
    if w.assigned = 0 then continue; end if;
    if w.done >= w.assigned then v_streak := v_streak + 1;
    elsif w.ws = v_ws then continue;
    else exit;
    end if;
  end loop;

  return jsonb_build_object(
    'log_id', l.id, 'first_name', coalesce(nullif(l.first_name, ''), split_part(l.full_name, ' ', 1)),
    'own', l.plan_session_id is null, 'label', l.label, 'performed_on', l.performed_on,
    'minutes', l.minutes, 'rpe', l.rpe, 'can_rate', private.gym_in_window(l.performed_on),
    'done_exercises', cardinality(l.exercise_ids), 'total_exercises', v_total,
    'week_done', v_wd, 'week_assigned', v_wa, 'streak', v_streak);
end $$;
revoke all on function public.my_gym_log_summary(uuid) from public, anon;
grant execute on function public.my_gym_log_summary(uuid) to authenticated;
