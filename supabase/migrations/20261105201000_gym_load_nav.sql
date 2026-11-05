-- Recov · Plan de gimnasio: carga, pendientes, cumplimiento y navegación.
-- El gimnasio suma a la carga sRPE (esfuerzo × minutos; un registro sin esfuerzo no suma)
-- y no tiene formato: cuenta igual en '15' y en '7'.
-- Sin DROP: las funciones que se reemplazan conservan su firma y su tipo de retorno.
--   · srpe_load_flag usa private.load_sessions (eventos + gimnasio), así team_srpe_load y
--     player_weekly_load suman el gimnasio sin cambiar de firma.
--   · player_weekly_load (jsonb) agrega el desglose cancha / gimnasio / partido.
--   · El desglose de team_srpe_load va en la función nueva team_load_breakdown (agregar
--     columnas a team_srpe_load obligaría a hacer DROP).
--   · my_pending_reports agrega filas kind = 'gym' (ver comentario abajo).

-- ---------------------------------------------------------------------------
-- 1. Sesiones con carga: eventos respondidos + gimnasio con esfuerzo
-- ---------------------------------------------------------------------------
-- kind: 'cancha' (entrenamiento), 'partido' (competencia) o 'gimnasio'.
-- source_id: el evento o el registro de gimnasio. starts_at del gimnasio: las 12:00 de
-- ese día en Chile (solo para ordenar).
create function private.load_sessions(p_club uuid, p_format text, p_player uuid)
returns table (player_id uuid, source_id uuid, kind text, label text, starts_at timestamptz, week_start date,
               rpe smallint, minutes int, estimated boolean, load int)
language sql stable security definer set search_path = ''
as $$
  select s.player_id, s.event_id,
         case when s.event_type = 'competencia' then 'partido' else 'cancha' end,
         s.event_type, s.starts_at, s.week_start, s.rpe, s.minutes, s.estimated, s.load
    from private.srpe_sessions(p_club, p_format, p_player) s
  union all
  select l.player_id, l.id, 'gimnasio', coalesce(gs.label, 'Por tu cuenta'),
         (l.performed_on::timestamp + time '12:00') at time zone 'America/Santiago',
         date_trunc('week', l.performed_on)::date, l.rpe, l.minutes::int, false, (l.rpe * l.minutes)::int
    from public.gym_session_logs l
    left join public.gym_plan_sessions gs on gs.id = l.plan_session_id
   where l.club_id = p_club and l.rpe is not null and (p_player is null or l.player_id = p_player)
$$;
revoke all on function private.load_sessions(uuid, text, uuid) from public;

-- Igual que en 20261105180000, pero con el gimnasio.
create or replace function private.srpe_load_flag(p_club uuid, p_player uuid, p_format text)
returns table (current_load int, current_sessions int, baseline numeric, prior_weeks int,
               high_load boolean, pct_over int)
language sql stable security definer set search_path = ''
as $$
  with cur as (select date_trunc('week', now() at time zone 'America/Santiago')::date as ws),
  w as (
    select s.week_start, sum(s.load)::numeric as l, count(*)::int as n
      from private.load_sessions(p_club, p_format, p_player) s, cur
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

-- Igual que en 20261105180000, con el gimnasio y el desglose por tipo:
-- weeks[].cancha / gimnasio / partido y current_sessions[].kind / label.
-- current_sessions[].event_id es el id del evento o del registro de gimnasio;
-- type es el tipo del evento o 'gimnasio'.
create or replace function public.player_weekly_load(p_player_id uuid, p_weeks int default 6, p_format text default '15')
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
               'estimated', coalesce(s.est, false),
               'cancha', coalesce(s.c, 0), 'gimnasio', coalesce(s.g, 0), 'partido', coalesce(s.p, 0))
               order by g.ws), '[]')
        from (select (v_cur - 7 * k)::date as ws from generate_series(0, p_weeks - 1) k) g
        left join (select ss.week_start, sum(ss.load)::int as l, count(*)::int as n, bool_or(ss.estimated) as est,
                          coalesce(sum(ss.load) filter (where ss.kind = 'cancha'), 0)::int as c,
                          coalesce(sum(ss.load) filter (where ss.kind = 'gimnasio'), 0)::int as g,
                          coalesce(sum(ss.load) filter (where ss.kind = 'partido'), 0)::int as p
                     from private.load_sessions(v_club, p_format, p_player_id) ss
                    group by ss.week_start) s on s.week_start = g.ws),
    'current_load', f.current_load,
    'baseline', f.baseline,
    'prior_weeks', f.prior_weeks,
    'high_load', f.high_load,
    'pct_over', f.pct_over,
    'ratio', private.srpe_high_load_ratio(),
    'current_sessions', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'event_id', ss.source_id, 'kind', ss.kind, 'label', ss.label,
               'type', case when ss.kind = 'gimnasio' then 'gimnasio' else ss.label end,
               'starts_at', ss.starts_at, 'rpe', ss.rpe,
               'minutes', ss.minutes, 'estimated', ss.estimated, 'load', ss.load) order by ss.starts_at), '[]')
        from private.load_sessions(v_club, p_format, p_player_id) ss
       where ss.week_start = v_cur));
end $$;

-- Desglose de la carga de la semana actual por tipo, por jugador del formato: solo staff.
-- (Complementa team_srpe_load, que ya suma el gimnasio.)
create function public.team_load_breakdown(p_format text default '15')
returns table (player_id uuid, cancha int, gimnasio int, partido int)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_club uuid := private.current_club_id();
  v_cur  date := date_trunc('week', now() at time zone 'America/Santiago')::date;
begin
  if p_format is null or p_format not in ('15', '7') then raise exception 'invalid_format'; end if;
  if v_club is null or not private.is_staff(v_club) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select p.id,
         coalesce(sum(s.load) filter (where s.kind = 'cancha'), 0)::int,
         coalesce(sum(s.load) filter (where s.kind = 'gimnasio'), 0)::int,
         coalesce(sum(s.load) filter (where s.kind = 'partido'), 0)::int
    from public.players p
    left join private.load_sessions(v_club, p_format, null) s on s.player_id = p.id and s.week_start = v_cur
   where p.club_id = v_club and p.status = 'confirmado' and p.active
     and private.in_format(v_club, p.user_id, p_format)
   group by p.id;
end $$;
revoke all on function public.team_load_breakdown(text) from public, anon;
grant execute on function public.team_load_breakdown(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Pendientes del jugador: también el esfuerzo del gimnasio
-- ---------------------------------------------------------------------------
-- Igual que en 20261105180000, más filas kind = 'gym': registros propios de gimnasio sin
-- esfuerzo dentro del plazo (hoy o 2 días atrás), de cualquier formato. En esas filas,
-- event_id = id del registro, location = nombre de la sesión ("Sesión A"; null si fue por
-- su cuenta), minutes = duración y report_date = el día.
create or replace function public.my_pending_reports(p_format text default '15')
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

  return query
  select 'gym'::text, l.id, null::text,
         (l.performed_on::timestamp + time '12:00') at time zone 'America/Santiago', null::timestamptz,
         null::text, gs.label, l.minutes::int, false, l.performed_on
    from public.gym_session_logs l
    left join public.gym_plan_sessions gs on gs.id = l.plan_session_id
   where l.club_id = v_club and l.player_id = v_player and l.rpe is null
     and private.gym_in_window(l.performed_on)
   order by l.performed_on, l.created_at;

  v_date := private.wellness_target_date(v_club);
  if v_date is not null and not exists (
    select 1 from public.wellness_reports w
     where w.club_id = v_club and w.player_id = v_player and w.report_date = v_date) then
    return query select 'wellness'::text, null::uuid, null::text, null::timestamptz, null::timestamptz,
                        null::text, null::text, null::int, null::boolean, v_date;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Cumplimiento del plan
-- ---------------------------------------------------------------------------
-- Por jugador: sesiones asignadas en el rango (según día, vigencia y exclusiones), las
-- que ya tocaban (hasta hoy) y las hechas. Solo staff. El % del plantel es
-- suma(done) / suma(due).
create function public.gym_adherence(p_from date, p_to date)
returns table (player_id uuid, full_name text, assigned int, due int, done int)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_club  uuid := private.current_club_id();
  v_today date := private.chile_today();
begin
  if v_club is null or not private.is_staff(v_club) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'Rango de fechas inválido';
  end if;
  return query
  select a.player_id, p.full_name, count(*)::int,
         count(*) filter (where a.day <= v_today)::int,
         count(a.done_log_id)::int
    from private.gym_assignments(v_club, p_from, p_to) a
    join public.players p on p.id = a.player_id
   group by a.player_id, p.full_name
   order by p.full_name;
end $$;
revoke all on function public.gym_adherence(date, date) from public, anon;
grant execute on function public.gym_adherence(date, date) to authenticated;

-- Pestaña "Gimnasio" de la ficha: planes vigentes asignados, cumplimiento de las últimas
-- 6 semanas y últimos 10 registros. Staff del plantel o el propio jugador.
create function public.player_gym_summary(p_player_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_club  uuid := private.current_club_id();
  v_today date := private.chile_today();
  v_ws    date := date_trunc('week', private.chile_today())::date;
begin
  if v_club is null or not private.is_confirmed_member(v_club)
     or not exists (select 1 from public.players p where p.id = p_player_id and p.club_id = v_club)
     or not (private.is_staff(v_club) or p_player_id = private.current_player_id(v_club)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'plans', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', gp.id, 'name', gp.name, 'starts_on', gp.starts_on, 'ends_on', gp.ends_on,
               'sessions', (select coalesce(jsonb_agg(jsonb_build_object(
                              'label', s.label, 'weekday', s.weekday, 'est_minutes', s.est_minutes,
                              'exercise_count', (select count(*) from public.gym_plan_exercises e
                                                  where e.session_id = s.id and e.archived_at is null))
                              order by s.weekday, s.sort), '[]')
                              from public.gym_plan_sessions s where s.plan_id = gp.id and s.archived_at is null))
               order by gp.starts_on), '[]')
        from public.gym_plans gp
       where gp.club_id = v_club and gp.status = 'publicado' and gp.ends_on >= v_today
         and exists (select 1 from private.gym_plan_players(gp.id) pp where pp.player_id = p_player_id)),
    'weeks', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'week_start', g.ws, 'assigned', coalesce(x.assigned, 0), 'done', coalesce(x.done, 0),
               'due', coalesce(x.due, 0)) order by g.ws), '[]')
        from (select (v_ws - 7 * k)::date as ws from generate_series(0, 5) k) g
        left join (select date_trunc('week', a.day)::date as ws, count(*)::int as assigned,
                          count(*) filter (where a.day <= v_today)::int as due,
                          count(a.done_log_id)::int as done
                     from private.gym_assignments(v_club, v_ws - 35, v_ws + 6, p_player_id) a
                    group by 1) x on x.ws = g.ws),
    'recent', (
      select coalesce(jsonb_agg(r order by r->>'performed_on' desc, r->>'created_at' desc), '[]')
        from (select jsonb_build_object(
                       'id', l.id, 'performed_on', l.performed_on, 'created_at', l.created_at,
                       'own', l.plan_session_id is null, 'label', gs.label, 'plan_name', gp.name,
                       'minutes', l.minutes, 'rpe', l.rpe, 'completed_all', l.completed_all,
                       'done_exercises', cardinality(l.exercise_ids),
                       'total_exercises', case when l.plan_session_id is not null then
                          (select count(*) from public.gym_plan_exercises e
                            where e.session_id = l.plan_session_id
                              and (e.archived_at is null or e.id = any (l.exercise_ids))) end) as r
                from public.gym_session_logs l
                left join public.gym_plan_sessions gs on gs.id = l.plan_session_id
                left join public.gym_plans gp on gp.id = gs.plan_id
               where l.club_id = v_club and l.player_id = p_player_id
               order by l.performed_on desc, l.created_at desc limit 10) z));
end $$;
revoke all on function public.player_gym_summary(uuid) from public, anon;
grant execute on function public.player_gym_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Navegación: 'planes' (head coach y preparador físico) y 'mi_plan' (jugador)
-- ---------------------------------------------------------------------------
-- Las barras ya guardadas no cambian; la nueva barra por defecto del jugador vive en la
-- app (src/lib/nav-slots.ts) y solo aplica a quien no guardó la suya (slots NULL).
create or replace function private.nav_screen_keys()
returns text[]
language sql immutable set search_path to ''
as $$
  select array[
    'resumen', 'calendario', 'plantel', 'lesiones', 'nominas', 'evaluaciones',
    'metricas', 'registros', 'staff', 'mis_lesiones', 'mis_evaluaciones', 'planes', 'mi_plan'
  ]::text[]
$$;

create or replace function private.nav_allowed_screens(p_club uuid)
returns text[]
language sql stable security definer set search_path to ''
as $$
  select case when not private.is_confirmed_member(p_club) then '{}'::text[] else
    array['resumen', 'calendario', 'plantel', 'nominas']
    || case when private.is_staff(p_club) then array['lesiones', 'metricas'] else '{}' end
    || case when private.has_role(p_club, 'head_coach') or private.has_role(p_club, 'kinesiologo')
              or private.has_role(p_club, 'entrenador') or private.has_role(p_club, 'nutricionista')
              or private.has_role(p_club, 'preparador_fisico')
            then array['evaluaciones'] else '{}' end
    || case when private.is_direction(p_club) then array['registros', 'staff'] else '{}' end
    || case when private.has_role(p_club, 'head_coach') or private.has_role(p_club, 'preparador_fisico')
            then array['planes'] else '{}' end
    || case when private.has_role(p_club, 'jugador') and not private.is_staff(p_club)
            then array['mis_lesiones'] else '{}' end
    || case when private.has_role(p_club, 'jugador') and private.current_player_id(p_club) is not null
            then array['mis_evaluaciones', 'mi_plan'] else '{}' end
  end
$$;
