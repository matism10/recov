-- Recov · Carga del plantel por semana y bienestar del plantel (Métricas → Carga).
-- Solo lecturas: sin tablas nuevas, sin políticas, sin DROP. Exigen carga_ver en el plantel
-- activo (private.has_perm) y respetan el formato (en '7', solo el grupo Sevens).
--   · team_load_weekly(p_weeks, p_format): por semana (lunes a domingo, Chile), la carga
--     sRPE sumada por tipo (cancha, gimnasio, partido; de private.load_sessions), cuántos
--     jugadores respondieron, la carga promedio por jugador que respondió y el promedio de
--     ese valor en las 4 semanas anteriores con datos. La semana actual va "en curso".
--   · team_wellness_summary(p_format): promedio del total /25 por semana (6 semanas),
--     cuántos respondieron y los 3 con el check más bajo de los últimos 7 días, con los
--     ítems en la orientación que ve el jugador (shown) y la guardada (stored, 5 = mejor).

-- ---------------------------------------------------------------------------
-- 1. Carga del plantel por semana
-- ---------------------------------------------------------------------------
create function public.team_load_weekly(p_weeks int default 6, p_format text default '15')
returns table (week_start date, in_progress boolean, cancha int, gimnasio int, partido int, total int,
               responded int, roster int, avg_load numeric, prior_avg numeric, prior_weeks int)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_club uuid := private.current_club_id();
  v_cur  date := date_trunc('week', now() at time zone 'America/Santiago')::date;
begin
  if p_format is null or p_format not in ('15', '7') then raise exception 'invalid_format'; end if;
  if v_club is null or not private.has_perm(v_club, 'carga_ver') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_weeks is null or p_weeks not between 1 and 26 then raise exception 'Semanas fuera de rango'; end if;

  return query
  with squad as (
    select p.id
      from public.players p
     where p.club_id = v_club and p.status = 'confirmado' and p.active
       and private.in_format(v_club, p.user_id, p_format)),
  -- p_weeks semanas más 4 antes, para el promedio de referencia de la más antigua.
  g as (select (v_cur - 7 * k)::date as ws from generate_series(0, p_weeks + 3) k),
  s as (
    select ls.week_start as ws,
           coalesce(sum(ls.load) filter (where ls.kind = 'cancha'), 0)::int as c,
           coalesce(sum(ls.load) filter (where ls.kind = 'gimnasio'), 0)::int as gy,
           coalesce(sum(ls.load) filter (where ls.kind = 'partido'), 0)::int as pa,
           count(distinct ls.player_id)::int as n
      from private.load_sessions(v_club, p_format, null) ls
      join squad q on q.id = ls.player_id
     where ls.week_start between v_cur - 7 * (p_weeks + 3) and v_cur
     group by ls.week_start),
  w as (
    select g.ws, coalesce(s.c, 0) as c, coalesce(s.gy, 0) as gy, coalesce(s.pa, 0) as pa,
           coalesce(s.n, 0) as n,
           case when s.n > 0 then round((s.c + s.gy + s.pa)::numeric / s.n, 1) end as avg_l
      from g left join s on s.ws = g.ws),
  ww as (
    select w.*,
           (select round(avg(x.avg_l), 1) from w x
             where x.ws < w.ws and x.ws >= w.ws - 28 and x.avg_l is not null) as prior,
           (select count(*)::int from w x
             where x.ws < w.ws and x.ws >= w.ws - 28 and x.avg_l is not null) as prior_n
      from w)
  select ww.ws, ww.ws = v_cur, ww.c, ww.gy, ww.pa, ww.c + ww.gy + ww.pa, ww.n,
         (select count(*)::int from squad), ww.avg_l, ww.prior, ww.prior_n
    from ww
   where ww.ws > v_cur - 7 * p_weeks
   order by ww.ws;
end $$;
revoke all on function public.team_load_weekly(int, text) from public, anon;
grant execute on function public.team_load_weekly(int, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Bienestar del plantel
-- ---------------------------------------------------------------------------
-- weeks: 6 semanas (la actual "en curso") con el promedio de los checks de la semana y
-- cuántos jugadores respondieron. recent_*: último check de cada jugador en los últimos
-- 7 días. lowest: los 3 de esos con el total más bajo; items en el orden de la app, con
-- shown (Fatiga, Dolor muscular y Estrés invertidos: 6 − v) y stored (5 = mejor).
create function public.team_wellness_summary(p_format text default '15')
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_club  uuid := private.current_club_id();
  v_cur   date := date_trunc('week', now() at time zone 'America/Santiago')::date;
  v_today date := (now() at time zone 'America/Santiago')::date;
  v_out   jsonb;
begin
  if p_format is null or p_format not in ('15', '7') then raise exception 'invalid_format'; end if;
  if v_club is null or not private.has_perm(v_club, 'carga_ver') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with squad as (
    select p.id, p.full_name
      from public.players p
     where p.club_id = v_club and p.status = 'confirmado' and p.active
       and private.in_format(v_club, p.user_id, p_format)),
  reports as (
    select w.player_id, q.full_name, w.report_date, w.total,
           w.fatigue, w.sleep, w.soreness, w.stress, w.mood
      from public.wellness_reports w
      join squad q on q.id = w.player_id
     where w.club_id = v_club and w.report_date between v_cur - 35 and v_today),
  latest as (
    select distinct on (r.player_id) r.*
      from reports r
     where r.report_date >= v_today - 6
     order by r.player_id, r.report_date desc),
  lowest as (
    select l.* from latest l order by l.total, l.report_date desc, l.full_name limit 3)
  select jsonb_build_object(
    'roster', (select count(*) from squad),
    'recent_avg', (select round(avg(l.total), 1) from latest l),
    'recent_responded', (select count(*) from latest),
    'weeks', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'week_start', g.ws, 'in_progress', g.ws = v_cur,
               'avg_total', x.a, 'responded', coalesce(x.n, 0)) order by g.ws), '[]'::jsonb)
        from (select (v_cur - 7 * k)::date as ws from generate_series(0, 5) k) g
        left join (select date_trunc('week', r.report_date)::date as ws,
                          round(avg(r.total), 1) as a, count(distinct r.player_id)::int as n
                     from reports r group by 1) x on x.ws = g.ws),
    'lowest', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'player_id', l.player_id, 'full_name', l.full_name,
               'report_date', l.report_date, 'total', l.total,
               'items', jsonb_build_array(
                 jsonb_build_object('key', 'fatigue',  'stored', l.fatigue,  'shown', 6 - l.fatigue),
                 jsonb_build_object('key', 'sleep',    'stored', l.sleep,    'shown', l.sleep),
                 jsonb_build_object('key', 'soreness', 'stored', l.soreness, 'shown', 6 - l.soreness),
                 jsonb_build_object('key', 'stress',   'stored', l.stress,   'shown', 6 - l.stress),
                 jsonb_build_object('key', 'mood',     'stored', l.mood,     'shown', l.mood)))
               order by l.total, l.report_date desc, l.full_name), '[]'::jsonb)
        from lowest l))
  into v_out;
  return v_out;
end $$;
revoke all on function public.team_wellness_summary(text) from public, anon;
grant execute on function public.team_wellness_summary(text) to authenticated;
