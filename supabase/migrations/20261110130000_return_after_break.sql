-- Recov · Vuelta tras parón (PR 2 de 2). Solo informativo; sin tablas nuevas: todo se calcula al leer.
-- Señal positiva de actividad (un día con alguna):
--   · sRPE con esfuerzo > 0 (el día del evento), · presente en una lista, · participación en un
--     partido (played), · sesión de gimnasio hecha (gym_session_logs).
-- Evidencia negativa (un día con alguna): ausencia declarada (aviso de evento, período o parón del
--   plantel), "No fui" en el sRPE, ausente en la lista, o lesión abierta (no descartada).
-- Sin respuesta NO cuenta como parón: un hueco de actividad solo es parón si tiene evidencia negativa.
--   Parón = break_days() días o más (sin contar el día de cada señal) entre dos señales positivas, con
--   evidencia negativa en el hueco. Vuelta = la señal positiva que lo cierra; el aviso dura
--   return_window_days() días desde ese día.
--   Causa: 'lesion' (hay lesión en el hueco), si no el motivo declarado más reciente ('vacaciones',
--   'viaje_trabajo', 'estudios', 'salud', 'otro') y si no 'ausencia' (solo "No fui" o lista).
--   Aviso de equipo: si el hueco incluyó un parón del plantel declarado, o si team_break_share() o más del
--   plantel (del formato) vuelve en la misma ventana, es un solo aviso de equipo, sin marcar jugador
--   por jugador. Si no, avisos individuales.
-- No cambia la regla de "Carga alta" (srpe_high_load_ratio).

-- ---------------------------------------------------------------------------
-- 1. Umbrales (provisorios, editables como srpe_high_load_ratio)
-- ---------------------------------------------------------------------------
create function private.break_days()
returns int language sql immutable set search_path = '' as $$ select 10 $$;
create function private.return_window_days()
returns int language sql immutable set search_path = '' as $$ select 14 $$;
create function private.team_break_share()
returns numeric language sql immutable set search_path = '' as $$ select 0.6::numeric $$;
revoke all on function private.break_days() from public;
revoke all on function private.return_window_days() from public;
revoke all on function private.team_break_share() from public;

-- ---------------------------------------------------------------------------
-- 2. Señales
-- ---------------------------------------------------------------------------
create function private.activity_days(p_club uuid, p_player uuid)
returns table (player_id uuid, day date)
language sql stable security definer set search_path = '' as $$
  select r.player_id, (e.starts_at at time zone 'America/Santiago')::date
    from public.session_rpe r
    join public.events e on e.id = r.event_id and e.club_id = r.club_id
   where r.club_id = p_club and not r.absent and coalesce(r.rpe, 0) > 0 and e.cancelled_at is null
     and (p_player is null or r.player_id = p_player)
  union
  select a.player_id, (e.starts_at at time zone 'America/Santiago')::date
    from public.event_attendance a
    join public.events e on e.id = a.event_id and e.club_id = a.club_id
   where a.club_id = p_club and a.present and e.cancelled_at is null
     and (p_player is null or a.player_id = p_player)
  union
  select ep.player_id, (e.starts_at at time zone 'America/Santiago')::date
    from public.event_participations ep
    join public.events e on e.id = ep.event_id and e.club_id = ep.club_id
   where ep.club_id = p_club and ep.played and e.cancelled_at is null
     and (p_player is null or ep.player_id = p_player)
  union
  select l.player_id, l.performed_on
    from public.gym_session_logs l
   where l.club_id = p_club and (p_player is null or l.player_id = p_player)
$$;
revoke all on function private.activity_days(uuid, uuid) from public;

-- Evidencia negativa por día. kind: 'aviso' (evento), 'periodo', 'plantel' (parón declarado),
-- 'no_fui', 'lista' (ausente en la lista) o 'lesion'. reason: motivo declarado (avisos).
create function private.inactivity_days(p_club uuid, p_player uuid)
returns table (player_id uuid, day date, kind text, reason text)
language sql stable security definer set search_path = '' as $$
  select a.player_id, (e.starts_at at time zone 'America/Santiago')::date, 'aviso'::text, a.reason
    from public.absences a
    join public.events e on e.id = a.event_id and e.club_id = a.club_id
   where a.club_id = p_club and a.scope = 'evento' and a.ended_at is null
     and (p_player is null or a.player_id = p_player)
  union all
  select a.player_id, d::date, 'periodo', a.reason
    from public.absences a
    cross join lateral generate_series(a.starts_on, least(coalesce(a.ends_on, private.chile_today()), private.chile_today()), interval '1 day') d
   where a.club_id = p_club and a.scope = 'periodo' and a.ended_at is null and a.player_id is not null
     and (p_player is null or a.player_id = p_player)
  union all
  select p.id, d::date, 'plantel', a.reason
    from public.absences a
    cross join lateral generate_series(a.starts_on, least(coalesce(a.ends_on, private.chile_today()), private.chile_today()), interval '1 day') d
    join public.players p on p.club_id = a.club_id and p.status = 'confirmado' and p.active
   where a.club_id = p_club and a.scope = 'periodo' and a.ended_at is null and a.player_id is null
     and (p_player is null or p.id = p_player)
  union all
  select r.player_id, (e.starts_at at time zone 'America/Santiago')::date, 'no_fui', null::text
    from public.session_rpe r
    join public.events e on e.id = r.event_id and e.club_id = r.club_id
   where r.club_id = p_club and r.absent and e.cancelled_at is null
     and (p_player is null or r.player_id = p_player)
  union all
  select a.player_id, (e.starts_at at time zone 'America/Santiago')::date, 'lista', null::text
    from public.event_attendance a
    join public.events e on e.id = a.event_id and e.club_id = a.club_id
   where a.club_id = p_club and not a.present and e.cancelled_at is null
     and (p_player is null or a.player_id = p_player)
  union all
  select i.player_id, d::date, 'lesion', null::text
    from public.injuries i
    cross join lateral generate_series(i.started_on, least(coalesce(i.closed_on, private.chile_today()), private.chile_today()), interval '1 day') d
   where i.club_id = p_club and i.status <> 'descartada'
     and (p_player is null or i.player_id = p_player)
$$;
revoke all on function private.inactivity_days(uuid, uuid) from public;

-- ---------------------------------------------------------------------------
-- 3. Vueltas vigentes (una por jugador: la más reciente dentro de la ventana)
-- ---------------------------------------------------------------------------
create function private.return_flags(p_club uuid, p_player uuid)
returns table (player_id uuid, returned_on date, last_active_on date, gap_days int, cause text, squad_break boolean)
language sql stable security definer set search_path = '' as $$
  with act as (
    select distinct a.player_id, a.day from private.activity_days(p_club, p_player) a),
  seq as (
    select a.player_id, a.day as ret, lag(a.day) over (partition by a.player_id order by a.day) as prev
      from act a),
  cand as (
    select s.player_id, s.ret, s.prev from seq s
     where s.prev is not null
       and s.ret - s.prev - 1 >= private.break_days()
       and s.ret >= private.chile_today() - private.return_window_days()),
  ev as (select i.player_id, i.day, i.kind, i.reason from private.inactivity_days(p_club, p_player) i),
  withev as (
    select c.player_id, c.ret, c.prev,
           bool_or(e.kind = 'lesion') as has_inj,
           bool_or(e.kind = 'plantel') as has_squad,
           (array_agg(e.reason order by e.day desc)
              filter (where e.kind in ('aviso', 'periodo', 'plantel') and e.reason is not null))[1] as reason
      from cand c
      join ev e on e.player_id = c.player_id and e.day > c.prev and e.day < c.ret
     group by c.player_id, c.ret, c.prev)
  select distinct on (w.player_id)
         w.player_id, w.ret, w.prev, w.ret - w.prev - 1,
         case when w.has_inj then 'lesion' when w.reason is not null then w.reason else 'ausencia' end,
         coalesce(w.has_squad, false)
    from withev w
   order by w.player_id, w.ret desc
$$;
revoke all on function private.return_flags(uuid, uuid) from public;

-- Vueltas del plantel del formato, con el aviso de equipo resuelto (in_team).
create function private.return_team(p_club uuid, p_format text)
returns table (player_id uuid, full_name text, returned_on date, last_active_on date, gap_days int, weeks int,
               cause text, squad_break boolean, in_team boolean, share numeric, roster int, flagged int)
language sql stable security definer set search_path = '' as $$
  with roster as (
    select p.id, p.full_name from public.players p
     where p.club_id = p_club and p.status = 'confirmado' and p.active
       and private.in_format(p_club, p.user_id, p_format)),
  f as (
    select r.full_name, x.* from private.return_flags(p_club, null) x join roster r on r.id = x.player_id),
  tot as (select (select count(*) from roster)::int as roster, (select count(*) from f)::int as flagged)
  select f.player_id, f.full_name, f.returned_on, f.last_active_on, f.gap_days,
         greatest(1, round(f.gap_days / 7.0))::int, f.cause, f.squad_break,
         ((tot.roster > 0 and tot.flagged::numeric / tot.roster >= private.team_break_share()) or f.squad_break),
         case when tot.roster > 0 then round(tot.flagged::numeric / tot.roster, 2) else 0 end,
         tot.roster, tot.flagged
    from f cross join tot
$$;
revoke all on function private.return_team(uuid, text) from public;

-- ---------------------------------------------------------------------------
-- 4. Lecturas
-- ---------------------------------------------------------------------------
-- Ficha: staff con carga_ver o el propio jugador. Sin vuelta vigente (o fuera del formato): 0 filas.
-- baseline: promedio de carga semanal de las (hasta 4) semanas con carga hasta la última actividad;
-- current_load: carga de la semana en curso.
create function public.player_return_flag(p_player_id uuid, p_format text default '15')
returns table (returned_on date, last_active_on date, gap_days int, weeks int, cause text,
               squad_break boolean, in_team boolean, baseline numeric, current_load int)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_club uuid := private.current_club_id();
  v_cur  date := date_trunc('week', now() at time zone 'America/Santiago')::date;
  t      record;
  v_ws   date;
begin
  if p_format is null or p_format not in ('15', '7') then raise exception 'invalid_format'; end if;
  if v_club is null or not private.is_confirmed_member(v_club)
     or not exists (select 1 from public.players p where p.id = p_player_id and p.club_id = v_club)
     or not (private.has_perm(v_club, 'carga_ver') or p_player_id = private.current_player_id(v_club)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into t from private.return_team(v_club, p_format) x where x.player_id = p_player_id;
  if not found then return; end if;

  v_ws := date_trunc('week', t.last_active_on)::date;
  return query
  select t.returned_on, t.last_active_on, t.gap_days, t.weeks, t.cause, t.squad_break, t.in_team,
         (select round(avg(w.l), 1) from (
            select sum(s.load)::numeric as l
              from private.load_sessions(v_club, p_format, p_player_id) s
             where s.week_start between v_ws - 21 and v_ws
             group by s.week_start) w),
         (select coalesce(sum(s.load), 0)::int
            from private.load_sessions(v_club, p_format, p_player_id) s
           where s.week_start = v_cur);
end $$;
revoke all on function public.player_return_flag(uuid, text) from public, anon;
grant execute on function public.player_return_flag(uuid, text) to authenticated;

-- Métricas: aviso de equipo (si hay) e individuales. Solo staff con carga_ver.
create function public.team_return_summary(p_format text default '15')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_club uuid := private.current_club_id();
  v_out  jsonb;
begin
  if p_format is null or p_format not in ('15', '7') then raise exception 'invalid_format'; end if;
  if v_club is null or not private.has_perm(v_club, 'carga_ver') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'window_days', private.return_window_days(),
    'break_days', private.break_days(),
    'team', (select case when count(*) = 0 then null else jsonb_build_object(
                'count', count(*), 'roster', max(t.roster), 'share', round(count(*)::numeric / nullif(max(t.roster), 0), 2),
                'weeks', greatest(1, round(avg(t.weeks)))::int,
                'squad_break', bool_or(t.squad_break),
                'returned_from', min(t.returned_on), 'returned_to', max(t.returned_on)) end
               from private.return_team(v_club, p_format) t where t.in_team),
    'individual', (select coalesce(jsonb_agg(jsonb_build_object(
                'player_id', t.player_id, 'full_name', t.full_name, 'returned_on', t.returned_on,
                'weeks', t.weeks, 'cause', t.cause) order by t.returned_on desc, t.full_name), '[]')
               from private.return_team(v_club, p_format) t where not t.in_team))
    into v_out;
  return v_out;
end $$;
revoke all on function public.team_return_summary(text) from public, anon;
grant execute on function public.team_return_summary(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Notificaciones de estado (mismas firmas que en 20261107180000)
-- ---------------------------------------------------------------------------
-- Jugador: además de sRPE, gimnasio y bienestar, kind = 'return' (si volvió de un parón en la
-- ventana): minutes = semanas del parón, location = causa, opponent = 'equipo' o 'individual',
-- report_date = día de la vuelta; vence al terminar la ventana (nunca urgente). Sin números en el texto.
create or replace function public.my_state_notifications(p_format text default '15')
returns table(kind text, ref_id uuid, event_type text, starts_at timestamptz, ends_at timestamptz,
              opponent text, location text, minutes integer, estimated boolean, report_date date,
              deadline timestamptz, urgent boolean)
language sql stable security definer set search_path = '' as $$
  with d as (
    select r.*,
           case r.kind
             when 'session'  then r.ends_at + interval '48 hours'
             when 'gym'      then (r.report_date + 3)::timestamp at time zone 'America/Santiago'
             when 'wellness' then (r.report_date + 2)::timestamp at time zone 'America/Santiago'
           end as dl
      from public.my_pending_reports(p_format) r),
  s as (
    select d.kind, d.event_id as ref_id, d.event_type, d.starts_at, d.ends_at, d.opponent, d.location,
           d.minutes, d.estimated, d.report_date, d.dl as deadline, d.dl - now() < interval '12 hours' as urgent
      from d
    union all
    select 'return'::text, null::uuid, null::text, null::timestamptz, null::timestamptz,
           case when t.in_team then 'equipo' else 'individual' end, t.cause, t.weeks, null::boolean, t.returned_on,
           (t.returned_on + private.return_window_days() + 1)::timestamp at time zone 'America/Santiago', false
      from private.return_team(private.current_club_id(), p_format) t
     where t.player_id = private.my_active_player(private.current_club_id()))
  select s.kind, s.ref_id, s.event_type, s.starts_at, s.ends_at, s.opponent, s.location, s.minutes,
         s.estimated, s.report_date, s.deadline, s.urgent
    from s
   order by s.deadline
$$;

-- Staff (carga_ver): 'vuelta_equipo' (un solo aviso: count, roster, share, weeks, squad_break) y
-- 'vuelta_jugador' (uno por jugador fuera del aviso de equipo: player_name, weeks, cause, returned_on).
create or replace function public.my_staff_state_notifications(p_format text default '15')
returns table(kind text, ref_id uuid, occurs_at timestamptz, payload jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_club  uuid := private.current_club_id();
  v_today date := private.chile_today();
begin
  if p_format is null or p_format not in ('15', '7') then raise exception 'invalid_format'; end if;
  if v_club is null then return; end if;

  if private.has_perm(v_club, 'carga_ver') then
    return query
    select 'carga_alta'::text, t.player_id, null::timestamptz,
           jsonb_build_object('player_name', t.full_name, 'pct_over', t.pct_over,
                              'current_load', t.current_load)
      from public.team_srpe_load(p_format) t
     where t.high_load;

    return query
    select 'bienestar_bajo'::text, w.player_id,
           w.report_date::timestamp at time zone 'America/Santiago',
           jsonb_build_object('player_name', w.full_name, 'total', w.total, 'baseline', w.baseline,
                              'low_items', to_jsonb(w.low_items), 'report_date', w.report_date)
      from public.wellness_flags(p_format) w
     where w.low;

    return query
    select 'vuelta_equipo'::text, null::uuid,
           max(t.returned_on)::timestamp at time zone 'America/Santiago',
           jsonb_build_object('count', count(*), 'roster', max(t.roster),
                              'share', round(count(*)::numeric / nullif(max(t.roster), 0), 2),
                              'weeks', greatest(1, round(avg(t.weeks)))::int,
                              'squad_break', bool_or(t.squad_break))
      from private.return_team(v_club, p_format) t
     where t.in_team
    having count(*) > 0;

    return query
    select 'vuelta_jugador'::text, t.player_id,
           t.returned_on::timestamp at time zone 'America/Santiago',
           jsonb_build_object('player_name', t.full_name, 'weeks', t.weeks, 'cause', t.cause,
                              'returned_on', t.returned_on)
      from private.return_team(v_club, p_format) t
     where not t.in_team
     order by t.returned_on desc;
  end if;

  if private.has_perm(v_club, 'lista_pasar') then
    return query
    select 'sin_lista'::text, e.id, e.starts_at,
           jsonb_build_object('starts_at', e.starts_at, 'ends_at', e.ends_at, 'location', e.location)
      from public.events e
     where e.club_id = v_club and e.format = p_format and e.type = 'entrenamiento'
       and e.cancelled_at is null
       and e.starts_at <= now() and e.starts_at >= now() - interval '7 days'
       and not exists (select 1 from public.event_attendance a where a.event_id = e.id)
     order by e.starts_at desc;
  end if;

  if private.has_perm(v_club, 'nomina_armar') then
    return query
    select 'sin_nomina'::text, e.id, e.starts_at,
           jsonb_build_object('starts_at', e.starts_at, 'opponent', e.opponent, 'location', e.location)
      from public.events e
     where e.club_id = v_club and e.format = p_format and e.type = 'competencia'
       and e.cancelled_at is null
       and e.starts_at > now() and e.starts_at <= now() + interval '7 days'
       and not exists (select 1 from public.event_callups c
                        where c.event_id = e.id and c.removed_at is null)
     order by e.starts_at;
  end if;

  if private.has_perm(v_club, 'participacion_cargar') then
    return query
    select 'sin_participacion'::text, e.id, e.starts_at,
           jsonb_build_object('starts_at', e.starts_at, 'opponent', e.opponent, 'location', e.location)
      from public.events e
     where e.club_id = v_club and e.format = p_format and e.type = 'competencia'
       and e.cancelled_at is null
       and e.starts_at <= now() and e.starts_at >= now() - interval '7 days'
       and exists (select 1 from public.event_callups c
                    where c.event_id = e.id and c.removed_at is null)
       and not exists (select 1 from public.event_participations ep where ep.event_id = e.id)
     order by e.starts_at desc;
  end if;

  if private.has_perm(v_club, 'lesiones_revisar') then
    return query
    select 'alta_estimada'::text, i.id,
           i.expected_return_on::timestamp at time zone 'America/Santiago',
           jsonb_build_object('player_id', p.id, 'player_name', p.full_name, 'injury_type', i.type,
                              'expected_return_on', i.expected_return_on,
                              'days', i.expected_return_on - v_today,
                              'vencida', i.expected_return_on < v_today)
      from public.injuries i
      join public.players p on p.id = i.player_id and p.club_id = i.club_id
     where i.club_id = v_club and i.status = 'activa' and i.reviewed_at is not null
       and i.expected_return_on is not null and i.expected_return_on <= v_today + 3
       and p.status = 'confirmado' and p.active
       and private.in_format(v_club, p.user_id, p_format)
     order by i.expected_return_on;
  end if;

  if private.has_perm(v_club, 'gimnasio_planes') then
    return query
    with ex as (
      select distinct gp.id as plan_id, gp.name as plan_name, x.test_id
        from public.gym_plans gp
        join public.gym_plan_sessions s on s.plan_id = gp.id and s.archived_at is null
        join public.gym_plan_exercises x on x.session_id = s.id and x.archived_at is null
       where gp.club_id = v_club and gp.status = 'publicado'
         and (gp.ends_on is null or gp.ends_on >= v_today)
         and x.intensity_type = 'pct' and x.test_id is not null),
    miss as (
      select ex.plan_id, ex.plan_name, ex.test_id, count(*)::int as n
        from ex
        cross join lateral private.gym_plan_players(ex.plan_id) pp
       where private.gym_last_max(pp.player_id, ex.test_id) is null
       group by ex.plan_id, ex.plan_name, ex.test_id)
    select 'plan_sin_test'::text, m.plan_id, null::timestamptz,
           jsonb_build_object(
             'plan_name', m.plan_name,
             'players', max(m.n),
             'tests', jsonb_agg(jsonb_build_object('test_id', m.test_id, 'test_name', td.name,
                                                   'players', m.n) order by td.name))
      from miss m
      join public.test_definitions td on td.id = m.test_id
     group by m.plan_id, m.plan_name;
  end if;
end $$;
