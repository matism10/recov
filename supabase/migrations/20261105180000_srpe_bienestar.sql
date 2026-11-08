-- Recov · sRPE (esfuerzo percibido por sesión) y check de bienestar del jugador.
-- sRPE: después de cada entrenamiento o partido, el jugador responde "¿Qué tan duro fue?" (0–10).
--   Carga = esfuerzo × minutos. Los minutos no se guardan: se calculan al leer
--   (private.session_minutes), porque la participación del partido puede cargarse después.
-- Bienestar: 5 preguntas de 1 a 5 (5 = mejor siempre), total sobre 25, los días que elige el club.
-- Lecturas por formato (events.format), como las métricas de 0046: p_format '15' o '7'.

-- ---------------------------------------------------------------------------
-- 1. Días del check de bienestar (ISO: 1 = lunes … 7 = domingo)
-- ---------------------------------------------------------------------------
create function private.valid_weekdays(p_days smallint[])
returns boolean language sql immutable set search_path = ''
as $$
  select p_days is not null
     and cardinality(p_days) between 1 and 7
     and not exists (select 1 from unnest(p_days) d where d is null or d not between 1 and 7)
     and (select count(distinct d) from unnest(p_days) d) = cardinality(p_days)
$$;
revoke all on function private.valid_weekdays(smallint[]) from public;
grant execute on function private.valid_weekdays(smallint[]) to authenticated;

alter table public.clubs
  add column wellness_days smallint[] not null default '{1}',
  add constraint clubs_wellness_days_check check (private.valid_weekdays(wellness_days));

-- Head coach, manager o preparador físico confirmados del plantel activo.
create function public.set_wellness_days(p_days smallint[])
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_club uuid := private.current_club_id();
begin
  if v_club is null or not (private.has_role(v_club, 'head_coach')
                            or private.has_role(v_club, 'manager')
                            or private.has_role(v_club, 'preparador_fisico')) then
    raise exception 'No tienes permiso para esta acción' using errcode = '42501';
  end if;
  if not private.valid_weekdays(p_days) then
    raise exception 'Elige entre 1 y 7 días, sin repetir';
  end if;
  update public.clubs
     set wellness_days = (select array_agg(d order by d) from unnest(p_days) d)
   where id = v_club;
end $$;
revoke all on function public.set_wellness_days(smallint[]) from public, anon;
grant execute on function public.set_wellness_days(smallint[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Tablas
-- ---------------------------------------------------------------------------
create table public.session_rpe (
  event_id     uuid not null,
  player_id    uuid not null,
  club_id      uuid not null,
  rpe          smallint,
  absent       boolean not null default false,
  submitted_at timestamptz not null default now(),
  primary key (event_id, player_id),
  foreign key (event_id, club_id) references public.events(id, club_id) on delete cascade,
  foreign key (player_id, club_id) references public.players(id, club_id),
  constraint session_rpe_value_check
    check ((absent and rpe is null) or (not absent and rpe between 0 and 10))
);
create index session_rpe_club_player_idx on public.session_rpe (club_id, player_id);
alter table public.session_rpe enable row level security;
revoke all on public.session_rpe from anon;

create policy session_rpe_select on public.session_rpe
  for select to authenticated
  using (private.is_confirmed_member(club_id)
         and (private.is_staff(club_id) or player_id = private.current_player_id(club_id)));

create table public.wellness_reports (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null,
  player_id    uuid not null,
  report_date  date not null,
  fatigue      smallint not null check (fatigue  between 1 and 5),
  sleep        smallint not null check (sleep    between 1 and 5),
  soreness     smallint not null check (soreness between 1 and 5),
  stress       smallint not null check (stress   between 1 and 5),
  mood         smallint not null check (mood     between 1 and 5),
  total        smallint generated always as (fatigue + sleep + soreness + stress + mood) stored,
  submitted_at timestamptz not null default now(),
  unique (club_id, player_id, report_date),
  foreign key (player_id, club_id) references public.players(id, club_id)
);
alter table public.wellness_reports enable row level security;
revoke all on public.wellness_reports from anon;

create policy wellness_reports_select on public.wellness_reports
  for select to authenticated
  using (private.is_confirmed_member(club_id)
         and (private.is_staff(club_id) or player_id = private.current_player_id(club_id)));

-- ---------------------------------------------------------------------------
-- 3. Umbrales (provisorios)
-- ---------------------------------------------------------------------------
-- Provisorio: "Carga alta" si la semana actual supera 1,3 × el promedio de las 4 anteriores.
create function private.srpe_high_load_ratio()
returns numeric language sql immutable set search_path = '' as $$ select 1.3::numeric $$;
-- Provisorio: "Bajo lo habitual" si el total cae 4 puntos o más bajo el promedio de los 4 anteriores.
create function private.wellness_drop()
returns numeric language sql immutable set search_path = '' as $$ select 4::numeric $$;
revoke all on function private.srpe_high_load_ratio() from public;
revoke all on function private.wellness_drop() from public;

-- ---------------------------------------------------------------------------
-- 4. Minutos de una sesión y validez de una respuesta
-- ---------------------------------------------------------------------------
create function private.session_minutes(p_event_id uuid, p_player_id uuid)
returns table (minutes int, estimated boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare
  e     record;
  ep    record;
  v_mm  int;
begin
  select ev.type, ev.starts_at, ev.ends_at, ev.format, c.sport into e
    from public.events ev join public.clubs c on c.id = ev.club_id
   where ev.id = p_event_id;
  if not found then return; end if;

  if e.type = 'entrenamiento' then
    minutes := greatest(0, round(extract(epoch from (e.ends_at - e.starts_at)) / 60))::int;
    estimated := false;
    return next; return;
  end if;

  select f.match_minutes into v_mm from private.sport_format(e.sport, coalesce(e.format, '15')) f;
  select p.mode, p.minutes as m, p.played into ep
    from public.event_participations p
   where p.event_id = p_event_id and p.player_id = p_player_id;

  if not found then
    minutes := v_mm; estimated := true;            -- sin participación cargada: el partido completo
  elsif ep.mode = 'exacto' then
    minutes := case when ep.played then coalesce(ep.m, 0) else 0 end; estimated := false;
  elsif not ep.played then
    minutes := 0; estimated := false;
  else
    minutes := v_mm; estimated := true;            -- rango o jugó: el partido completo, estimado
  end if;
  return next;
end $$;
revoke all on function private.session_minutes(uuid, uuid) from public;

-- null = el jugador puede responder ese evento; si no, el motivo.
create function private.rpe_check(p_club uuid, p_player uuid, p_event uuid)
returns text language plpgsql stable security definer set search_path = ''
as $$
declare
  e      record;
  v_user uuid;
begin
  select ev.type, ev.starts_at, ev.ends_at, ev.cancelled_at, ev.format into e
    from public.events ev where ev.id = p_event and ev.club_id = p_club;
  if not found then return 'not_found'; end if;
  if e.cancelled_at is not null then return 'El evento fue cancelado'; end if;
  if e.starts_at > now() then return 'El evento todavía no empieza'; end if;
  if now() > e.ends_at + interval '48 hours' then return 'Ya pasó el plazo para responder'; end if;

  select p.user_id into v_user from public.players p where p.id = p_player and p.club_id = p_club;
  if e.format = '7' and not private.in_format(p_club, v_user, '7') then
    return 'No estás en el grupo Sevens';
  end if;
  if e.type = 'competencia' and not exists (
    select 1 from public.event_callups cu
     where cu.event_id = p_event and cu.player_id = p_player and cu.removed_at is null) then
    return 'No estuviste convocado a este partido';
  end if;
  if e.type = 'entrenamiento' and exists (
    select 1 from public.event_attendance a
     where a.event_id = p_event and a.player_id = p_player and not a.present) then
    return 'Figuras ausente en este entrenamiento';
  end if;
  return null;
end $$;
revoke all on function private.rpe_check(uuid, uuid, uuid) from public;

-- Ficha del jugador autenticado en el plantel activo (confirmado y activo) o null.
create function private.my_active_player(p_club uuid)
returns uuid language sql stable security definer set search_path = ''
as $$
  select p.id from public.players p
   where p.club_id = p_club and p.user_id = (select auth.uid())
     and p.status = 'confirmado' and p.active
     and private.is_confirmed_member(p_club)
$$;
revoke all on function private.my_active_player(uuid) from public;

-- Fecha del check de bienestar que corresponde hoy (Chile): hoy si toca; ayer si tocaba
-- ayer y hoy no (para quien responde al día siguiente); si no, null.
create function private.wellness_target_date(p_club uuid)
returns date language sql stable security definer set search_path = ''
as $$
  select case
           when extract(isodow from x.t)::smallint = any (c.wellness_days) then x.t
           when extract(isodow from x.t - 1)::smallint = any (c.wellness_days) then x.t - 1
         end
    from public.clubs c, (select (now() at time zone 'America/Santiago')::date as t) x
   where c.id = p_club
$$;
revoke all on function private.wellness_target_date(uuid) from public;

-- ---------------------------------------------------------------------------
-- 5. Escritura del jugador
-- ---------------------------------------------------------------------------
create function public.submit_session_rpe(p_event_id uuid, p_rpe smallint, p_absent boolean default false)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_club   uuid := private.current_club_id();
  v_player uuid;
  v_err    text;
  v_absent boolean := coalesce(p_absent, false);
begin
  if v_club is null then raise exception 'forbidden' using errcode = '42501'; end if;
  v_player := private.my_active_player(v_club);
  if v_player is null then raise exception 'forbidden' using errcode = '42501'; end if;

  v_err := private.rpe_check(v_club, v_player, p_event_id);
  if v_err is not null then raise exception '%', v_err; end if;

  if not v_absent and (p_rpe is null or p_rpe not between 0 and 10) then
    raise exception 'Elige un valor de 0 a 10';
  end if;

  insert into public.session_rpe (event_id, player_id, club_id, rpe, absent, submitted_at)
  values (p_event_id, v_player, v_club, case when v_absent then null else p_rpe end, v_absent, now())
  on conflict (event_id, player_id) do update
    set rpe = excluded.rpe, absent = excluded.absent, submitted_at = excluded.submitted_at;
end $$;
revoke all on function public.submit_session_rpe(uuid, smallint, boolean) from public, anon;
grant execute on function public.submit_session_rpe(uuid, smallint, boolean) to authenticated;

create function public.submit_wellness(p_fatigue smallint, p_sleep smallint, p_soreness smallint,
                                       p_stress smallint, p_mood smallint)
returns date language plpgsql security definer set search_path = ''
as $$
declare
  v_club   uuid := private.current_club_id();
  v_player uuid;
  v_date   date;
begin
  if v_club is null then raise exception 'forbidden' using errcode = '42501'; end if;
  v_player := private.my_active_player(v_club);
  if v_player is null then raise exception 'forbidden' using errcode = '42501'; end if;

  v_date := private.wellness_target_date(v_club);
  if v_date is null then raise exception 'Hoy no toca el check de bienestar'; end if;

  if exists (select 1 from unnest(array[p_fatigue, p_sleep, p_soreness, p_stress, p_mood]) v
              where v is null or v not between 1 and 5) then
    raise exception 'Responde las 5 preguntas con un valor de 1 a 5';
  end if;

  insert into public.wellness_reports (club_id, player_id, report_date, fatigue, sleep, soreness, stress, mood, submitted_at)
  values (v_club, v_player, v_date, p_fatigue, p_sleep, p_soreness, p_stress, p_mood, now())
  on conflict (club_id, player_id, report_date) do update
    set fatigue = excluded.fatigue, sleep = excluded.sleep, soreness = excluded.soreness,
        stress = excluded.stress, mood = excluded.mood, submitted_at = excluded.submitted_at;
  return v_date;
end $$;
revoke all on function public.submit_wellness(smallint, smallint, smallint, smallint, smallint) from public, anon;
grant execute on function public.submit_wellness(smallint, smallint, smallint, smallint, smallint) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Lecturas
-- ---------------------------------------------------------------------------
-- Pendientes del jugador autenticado: sesiones dentro del plazo sin respuesta y el check
-- de bienestar si toca y no respondió. Para quien no es jugador del plantel: vacío.
create function public.my_pending_reports(p_format text default '15')
returns table (kind text, event_id uuid, event_type text, starts_at timestamptz, ends_at timestamptz,
               opponent text, location text, minutes int, estimated boolean, report_date date)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_club   uuid := private.current_club_id();
  v_player uuid;
  v_date   date;
begin
  if p_format is null or p_format not in ('15', '7') then raise exception 'invalid_format'; end if;
  if v_club is null then return; end if;
  v_player := private.my_active_player(v_club);
  if v_player is null then return; end if;

  return query
  select 'session'::text, e.id, e.type, e.starts_at, e.ends_at, e.opponent, e.location,
         m.minutes, m.estimated, null::date
    from public.events e
    cross join lateral private.session_minutes(e.id, v_player) m
   where e.club_id = v_club and e.format = p_format and e.cancelled_at is null
     and e.starts_at <= now() and e.ends_at + interval '48 hours' >= now()
     and not exists (select 1 from public.session_rpe r where r.event_id = e.id and r.player_id = v_player)
     and private.rpe_check(v_club, v_player, e.id) is null
   order by e.starts_at;

  v_date := private.wellness_target_date(v_club);
  if v_date is not null and not exists (
    select 1 from public.wellness_reports w
     where w.club_id = v_club and w.player_id = v_player and w.report_date = v_date) then
    return query select 'wellness'::text, null::uuid, null::text, null::timestamptz, null::timestamptz,
                        null::text, null::text, null::int, null::boolean, v_date;
  end if;
end $$;
revoke all on function public.my_pending_reports(text) from public, anon;
grant execute on function public.my_pending_reports(text) to authenticated;

-- Sesiones respondidas (no ausentes) con minutos y carga calculados.
create function private.srpe_sessions(p_club uuid, p_format text, p_player uuid)
returns table (player_id uuid, event_id uuid, event_type text, starts_at timestamptz, week_start date,
               rpe smallint, minutes int, estimated boolean, load int)
language sql stable security definer set search_path = ''
as $$
  select r.player_id, e.id, e.type, e.starts_at,
         date_trunc('week', e.starts_at at time zone 'America/Santiago')::date,
         r.rpe, m.minutes, m.estimated, (r.rpe * m.minutes)::int
    from public.session_rpe r
    join public.events e on e.id = r.event_id and e.club_id = r.club_id
    cross join lateral private.session_minutes(r.event_id, r.player_id) m
   where r.club_id = p_club and not r.absent and e.cancelled_at is null
     and e.format = p_format and (p_player is null or r.player_id = p_player)
$$;
revoke all on function private.srpe_sessions(uuid, text, uuid) from public;

-- Carga de la semana actual (lunes a domingo, Chile) contra el promedio de las 4 semanas
-- anteriores con datos. "Carga alta" con al menos 3 de esas semanas.
create function private.srpe_load_flag(p_club uuid, p_player uuid, p_format text)
returns table (current_load int, current_sessions int, baseline numeric, prior_weeks int,
               high_load boolean, pct_over int)
language sql stable security definer set search_path = ''
as $$
  with cur as (select date_trunc('week', now() at time zone 'America/Santiago')::date as ws),
  w as (
    select s.week_start, sum(s.load)::numeric as l, count(*)::int as n
      from private.srpe_sessions(p_club, p_format, p_player) s, cur
     where s.week_start between cur.ws - 28 and cur.ws
     group by s.week_start),
  agg as (
    select coalesce((select w.l from w, cur where w.week_start = cur.ws), 0) as c,
           coalesce((select w.n from w, cur where w.week_start = cur.ws), 0) as cn,
           (select avg(w.l) from w, cur where w.week_start < cur.ws) as b,
           (select count(*) from w, cur where w.week_start < cur.ws)::int as pw)
  select agg.c::int, agg.cn, round(agg.b, 1), agg.pw,
         (agg.pw >= 3 and agg.b > 0 and agg.c > private.srpe_high_load_ratio() * agg.b),
         case when agg.b > 0 then round((agg.c / agg.b - 1) * 100)::int end
    from agg
$$;
revoke all on function private.srpe_load_flag(uuid, uuid, text) from public;

-- Resumen de respuestas de un evento: solo staff.
create function public.event_rpe_summary(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_club uuid := private.current_club_id();
  e      record;
  v_out  jsonb;
begin
  if v_club is null or not private.is_staff(v_club) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select ev.id, ev.type, ev.starts_at, ev.ends_at, ev.format, ev.opponent, ev.cancelled_at into e
    from public.events ev where ev.id = p_event_id and ev.club_id = v_club;
  if not found then raise exception 'not_found'; end if;

  with roster as (
    -- Entrenamiento: plantel confirmado y activo (en Sevens, el grupo), sin los ausentes de la lista.
    select p.id, p.full_name from public.players p
     where e.type = 'entrenamiento' and p.club_id = v_club and p.status = 'confirmado' and p.active
       and private.in_format(v_club, p.user_id, e.format)
       and not exists (select 1 from public.event_attendance a
                        where a.event_id = e.id and a.player_id = p.id and not a.present)
    union
    -- Partido: convocados (no quitados) confirmados y activos.
    select p.id, p.full_name from public.event_callups cu
      join public.players p on p.id = cu.player_id and p.club_id = cu.club_id
     where e.type = 'competencia' and cu.event_id = e.id and cu.removed_at is null
       and p.status = 'confirmado' and p.active),
  x as (
    select ro.id, ro.full_name, r.rpe, r.absent, r.event_id is not null as answered, m.minutes, m.estimated
      from roster ro
      left join public.session_rpe r on r.event_id = e.id and r.player_id = ro.id
      left join lateral private.session_minutes(e.id, ro.id) m on r.event_id is not null and not r.absent)
  select jsonb_build_object(
    'event_id', e.id, 'type', e.type, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
    'format', e.format, 'opponent', e.opponent, 'cancelled', e.cancelled_at is not null,
    'expected', count(*),
    'responded', count(*) filter (where x.answered),
    'avg_rpe', round(avg(x.rpe) filter (where x.answered and not x.absent), 1),
    'avg_load', round(avg(x.rpe * x.minutes) filter (where x.answered and not x.absent)),
    'estimated', coalesce(bool_or(x.estimated) filter (where x.answered and not x.absent), false),
    'responses', coalesce(jsonb_agg(jsonb_build_object('player_id', x.id, 'full_name', x.full_name,
                    'rpe', x.rpe, 'minutes', x.minutes, 'estimated', x.estimated, 'load', x.rpe * x.minutes)
                    order by x.rpe * x.minutes desc, x.full_name) filter (where x.answered and not x.absent), '[]'),
    'missing', coalesce(jsonb_agg(jsonb_build_object('player_id', x.id, 'full_name', x.full_name)
                    order by x.full_name) filter (where not x.answered), '[]'),
    'absent', coalesce(jsonb_agg(jsonb_build_object('player_id', x.id, 'full_name', x.full_name)
                    order by x.full_name) filter (where x.answered and x.absent), '[]'))
    into v_out
    from x;
  return v_out;
end $$;
revoke all on function public.event_rpe_summary(uuid) from public, anon;
grant execute on function public.event_rpe_summary(uuid) to authenticated;

-- Carga semanal sRPE de un jugador: staff del plantel o el propio jugador.
create function public.player_weekly_load(p_player_id uuid, p_weeks int default 6, p_format text default '15')
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_club uuid := private.current_club_id();
  v_cur  date := date_trunc('week', now() at time zone 'America/Santiago')::date;
  f      record;
begin
  if p_format is null or p_format not in ('15', '7') then raise exception 'invalid_format'; end if;
  if v_club is null or not private.is_confirmed_member(v_club)
     or not exists (select 1 from public.players p where p.id = p_player_id and p.club_id = v_club)
     or not (private.is_staff(v_club) or p_player_id = private.current_player_id(v_club)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_weeks is null or p_weeks not between 1 and 26 then raise exception 'Semanas fuera de rango'; end if;

  select * into f from private.srpe_load_flag(v_club, p_player_id, p_format);

  return jsonb_build_object(
    'weeks', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'week_start', g.ws, 'load', coalesce(s.l, 0), 'sessions', coalesce(s.n, 0),
               'estimated', coalesce(s.est, false)) order by g.ws), '[]')
        from (select (v_cur - 7 * k)::date as ws from generate_series(0, p_weeks - 1) k) g
        left join (select ss.week_start, sum(ss.load)::int as l, count(*)::int as n, bool_or(ss.estimated) as est
                     from private.srpe_sessions(v_club, p_format, p_player_id) ss
                    group by ss.week_start) s on s.week_start = g.ws),
    'current_load', f.current_load,
    'baseline', f.baseline,
    'prior_weeks', f.prior_weeks,
    'high_load', f.high_load,
    'pct_over', f.pct_over,
    'ratio', private.srpe_high_load_ratio(),
    'current_sessions', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'event_id', ss.event_id, 'type', ss.event_type, 'starts_at', ss.starts_at, 'rpe', ss.rpe,
               'minutes', ss.minutes, 'estimated', ss.estimated, 'load', ss.load) order by ss.starts_at), '[]')
        from private.srpe_sessions(v_club, p_format, p_player_id) ss
       where ss.week_start = v_cur));
end $$;
revoke all on function public.player_weekly_load(uuid, int, text) from public, anon;
grant execute on function public.player_weekly_load(uuid, int, text) to authenticated;

-- Carga sRPE de la semana de todo el plantel (para la tarjeta de Métricas): solo staff.
create function public.team_srpe_load(p_format text default '15')
returns table (player_id uuid, full_name text, current_load int, current_sessions int, baseline numeric,
               prior_weeks int, high_load boolean, pct_over int)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_club uuid := private.current_club_id();
begin
  if p_format is null or p_format not in ('15', '7') then raise exception 'invalid_format'; end if;
  if v_club is null or not private.is_staff(v_club) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select p.id, p.full_name, f.current_load, f.current_sessions, f.baseline, f.prior_weeks, f.high_load, f.pct_over
    from public.players p
    cross join lateral private.srpe_load_flag(v_club, p.id, p_format) f
   where p.club_id = v_club and p.status = 'confirmado' and p.active
     and private.in_format(v_club, p.user_id, p_format)
   order by f.high_load desc, f.pct_over desc nulls last, p.full_name;
end $$;
revoke all on function public.team_srpe_load(text) from public, anon;
grant execute on function public.team_srpe_load(text) to authenticated;

-- Último check de bienestar (últimos 7 días) de cada jugador del formato: solo staff.
-- low = total ≤ promedio de sus 4 reportes anteriores − 4 (con al menos 3 previos) o algún ítem en 1.
-- low_items: los ítems con 1 o 2.
create function public.wellness_flags(p_format text default '15')
returns table (player_id uuid, full_name text, report_date date, total smallint,
               fatigue smallint, sleep smallint, soreness smallint, stress smallint, mood smallint,
               baseline numeric, prior_reports int, low boolean, low_items text[])
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_club  uuid := private.current_club_id();
  v_today date := (now() at time zone 'America/Santiago')::date;
begin
  if p_format is null or p_format not in ('15', '7') then raise exception 'invalid_format'; end if;
  if v_club is null or not private.is_staff(v_club) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  with latest as (
    select distinct on (w.player_id) w.*, p.full_name
      from public.wellness_reports w
      join public.players p on p.id = w.player_id and p.club_id = w.club_id
     where w.club_id = v_club and w.report_date >= v_today - 6
       and p.status = 'confirmado' and p.active and private.in_format(v_club, p.user_id, p_format)
     order by w.player_id, w.report_date desc),
  prev as (
    select l.player_id, avg(x.total) as b, count(*)::int as n
      from latest l
      cross join lateral (select w2.total from public.wellness_reports w2
                           where w2.club_id = v_club and w2.player_id = l.player_id
                             and w2.report_date < l.report_date
                           order by w2.report_date desc limit 4) x
     group by l.player_id)
  select l.player_id, l.full_name, l.report_date, l.total,
         l.fatigue, l.sleep, l.soreness, l.stress, l.mood,
         round(pr.b, 1), coalesce(pr.n, 0),
         (coalesce(pr.n, 0) >= 3 and l.total <= pr.b - private.wellness_drop())
           or least(l.fatigue, l.sleep, l.soreness, l.stress, l.mood) = 1,
         array_remove(array[
           case when l.fatigue  <= 2 then 'fatigue'  end,
           case when l.sleep    <= 2 then 'sleep'    end,
           case when l.soreness <= 2 then 'soreness' end,
           case when l.stress   <= 2 then 'stress'   end,
           case when l.mood     <= 2 then 'mood'     end], null)
    from latest l left join prev pr on pr.player_id = l.player_id
   order by l.full_name;
end $$;
revoke all on function public.wellness_flags(text) from public, anon;
grant execute on function public.wellness_flags(text) to authenticated;
