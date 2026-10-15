-- 0020: funciones de agregados para el dashboard. Solo staff, aisladas por club.
-- club_id sale siempre de private.current_club_id(), nunca de un parámetro.
-- Filtros: tarjetas, serie de disponibilidad, recurrentes y próximas altas usan
-- jugadores confirmed + active; semana, lugar y posición usan todos los confirmados.

-- 1) Tarjetas
create function public.dash_summary()
returns table (total int, disponibles int, en_revision int, lesionados int, reintegro int)
language plpgsql
stable
security definer
set search_path to ''
as $function$
#variable_conflict use_column
declare
  cid uuid := private.current_club_id();
begin
  if (select auth.uid()) is null or cid is null or not private.is_staff() then
    raise exception 'No tienes permiso para esta acción';
  end if;

  return query
  select count(*)::int,
         (count(*) filter (where p.availability = 'disponible'))::int,
         (count(*) filter (where p.availability = 'en_revision'))::int,
         (count(*) filter (where p.availability = 'lesionado'))::int,
         (count(*) filter (where p.availability = 'reintegro'))::int
    from public.players p
   where p.club_id = cid and p.status = 'confirmado' and p.active;
end $function$;

-- 2) Disponibilidad en el tiempo (estado al cierre de cada semana; la actual, a hoy)
create function public.dash_availability_series(p_weeks int default 12)
returns table (week_start date, disponible int, en_revision int, lesionado int, reintegro int)
language plpgsql
stable
security definer
set search_path to ''
as $function$
#variable_conflict use_column
declare
  cid uuid := private.current_club_id();
begin
  if (select auth.uid()) is null or cid is null or not private.is_staff() then
    raise exception 'No tienes permiso para esta acción';
  end if;
  if p_weeks is null or p_weeks < 1 or p_weeks > 52 then
    raise exception 'Rango inválido (1 a 52 semanas)';
  end if;

  return query
  with weeks as (
    select (date_trunc('week', current_date::timestamp)::date - g * 7) as ws
      from generate_series(0, p_weeks - 1) as g
  ),
  cuts as (
    select w.ws, least((w.ws + 7)::timestamptz, now()) as cutoff
      from weeks w
  ),
  snap as (
    select c.ws, l.to_status
      from cuts c
      cross join public.players p
      cross join lateral (
        select al.to_status
          from public.availability_log al
         where al.player_id = p.id
           and al.club_id = cid
           and al.changed_at < c.cutoff
         order by al.changed_at desc, al.id desc
         limit 1
      ) l
     where p.club_id = cid and p.status = 'confirmado' and p.active
  )
  select w.ws,
         (count(s.to_status) filter (where s.to_status = 'disponible'))::int,
         (count(s.to_status) filter (where s.to_status = 'en_revision'))::int,
         (count(s.to_status) filter (where s.to_status = 'lesionado'))::int,
         (count(s.to_status) filter (where s.to_status = 'reintegro'))::int
    from weeks w
    left join snap s on s.ws = w.ws
   group by w.ws
   order by w.ws;
end $function$;

-- 3) Lesiones nuevas por semana (no descartadas; incluye semanas en cero)
create function public.dash_injuries_by_week(p_weeks int default 12)
returns table (week_start date, injuries_count int)
language plpgsql
stable
security definer
set search_path to ''
as $function$
#variable_conflict use_column
declare
  cid uuid := private.current_club_id();
begin
  if (select auth.uid()) is null or cid is null or not private.is_staff() then
    raise exception 'No tienes permiso para esta acción';
  end if;
  if p_weeks is null or p_weeks < 1 or p_weeks > 52 then
    raise exception 'Rango inválido (1 a 52 semanas)';
  end if;

  return query
  with weeks as (
    select (date_trunc('week', current_date::timestamp)::date - g * 7) as ws
      from generate_series(0, p_weeks - 1) as g
  ),
  inj as (
    select i.started_on
      from public.injuries i
      join public.players p on p.id = i.player_id and p.club_id = i.club_id
     where i.club_id = cid and i.status <> 'descartada' and p.status = 'confirmado'
  )
  select w.ws, count(inj.started_on)::int
    from weeks w
    left join inj on inj.started_on >= w.ws and inj.started_on < w.ws + 7
   group by w.ws
   order by w.ws;
end $function$;

-- 4) Lugar de la lesión (12 meses móviles; siempre devuelve las 4 claves)
create function public.dash_injuries_by_place()
returns table (place_key text, injuries_count int)
language plpgsql
stable
security definer
set search_path to ''
as $function$
#variable_conflict use_column
declare
  cid uuid := private.current_club_id();
begin
  if (select auth.uid()) is null or cid is null or not private.is_staff() then
    raise exception 'No tienes permiso para esta acción';
  end if;

  return query
  with places(k, ord) as (
    values ('entrenamiento', 1), ('competencia', 2), ('externo', 3), ('sin_dato', 4)
  ),
  inj as (
    select coalesce(i.occurred_during, 'sin_dato') as k
      from public.injuries i
      join public.players p on p.id = i.player_id and p.club_id = i.club_id
     where i.club_id = cid and i.status <> 'descartada' and p.status = 'confirmado'
       and i.started_on >= (current_date - interval '12 months')::date
  )
  select pl.k, count(inj.k)::int
    from places pl
    left join inj on inj.k = pl.k
   group by pl.k, pl.ord
   order by pl.ord;
end $function$;

-- 5) Lesiones por posición (posición actual del jugador; 12 meses móviles)
create function public.dash_injuries_by_position()
returns table (position_name text, injuries_count int, players_count int)
language plpgsql
stable
security definer
set search_path to ''
as $function$
#variable_conflict use_column
declare
  cid uuid := private.current_club_id();
begin
  if (select auth.uid()) is null or cid is null or not private.is_staff() then
    raise exception 'No tienes permiso para esta acción';
  end if;

  return query
  select coalesce(p.position, 'Sin posición'),
         count(*)::int,
         count(distinct p.id)::int
    from public.injuries i
    join public.players p on p.id = i.player_id and p.club_id = i.club_id
   where i.club_id = cid and i.status <> 'descartada' and p.status = 'confirmado'
     and i.started_on >= (current_date - interval '12 months')::date
   group by 1
   order by 2 desc, 1;
end $function$;

-- 6) Jugadores recurrentes (2+ lesiones no descartadas en 12 meses)
create function public.dash_recurring_players()
returns table (player_id uuid, full_name text, position_name text, injuries_count int, last_injury_on date)
language plpgsql
stable
security definer
set search_path to ''
as $function$
#variable_conflict use_column
declare
  cid uuid := private.current_club_id();
begin
  if (select auth.uid()) is null or cid is null or not private.is_staff() then
    raise exception 'No tienes permiso para esta acción';
  end if;

  return query
  select p.id, p.full_name, coalesce(p.position, 'Sin posición'),
         count(*)::int, max(i.started_on)
    from public.injuries i
    join public.players p on p.id = i.player_id and p.club_id = i.club_id
   where i.club_id = cid and i.status <> 'descartada'
     and p.status = 'confirmado' and p.active
     and i.started_on >= (current_date - interval '12 months')::date
   group by p.id, p.full_name, p.position
  having count(*) >= 2
   order by 4 desc, 5 desc
   limit 20;
end $function$;

-- 7) Próximas altas: activas con alta estimada en los próximos 30 días,
--    más las vencidas (days_left < 0). Primero las más atrasadas.
create function public.dash_upcoming_returns()
returns table (injury_id uuid, player_id uuid, full_name text, position_name text,
               return_on date, days_left int)
language plpgsql
stable
security definer
set search_path to ''
as $function$
#variable_conflict use_column
declare
  cid uuid := private.current_club_id();
begin
  if (select auth.uid()) is null or cid is null or not private.is_staff() then
    raise exception 'No tienes permiso para esta acción';
  end if;

  return query
  select i.id, p.id, p.full_name, coalesce(p.position, 'Sin posición'),
         i.expected_return_on, (i.expected_return_on - current_date)::int
    from public.injuries i
    join public.players p on p.id = i.player_id and p.club_id = i.club_id
   where i.club_id = cid and i.status = 'activa'
     and p.status = 'confirmado' and p.active
     and i.expected_return_on is not null
     and i.expected_return_on <= current_date + 30
   order by i.expected_return_on, p.full_name
   limit 50;
end $function$;

-- Privilegios: solo authenticated (el chequeo de staff va dentro de cada función).
revoke all on function public.dash_summary()                    from public, anon, authenticated;
revoke all on function public.dash_availability_series(int)     from public, anon, authenticated;
revoke all on function public.dash_injuries_by_week(int)        from public, anon, authenticated;
revoke all on function public.dash_injuries_by_place()          from public, anon, authenticated;
revoke all on function public.dash_injuries_by_position()       from public, anon, authenticated;
revoke all on function public.dash_recurring_players()          from public, anon, authenticated;
revoke all on function public.dash_upcoming_returns()           from public, anon, authenticated;

grant execute on function public.dash_summary()                 to authenticated;
grant execute on function public.dash_availability_series(int)  to authenticated;
grant execute on function public.dash_injuries_by_week(int)     to authenticated;
grant execute on function public.dash_injuries_by_place()       to authenticated;
grant execute on function public.dash_injuries_by_position()    to authenticated;
grant execute on function public.dash_recurring_players()       to authenticated;
grant execute on function public.dash_upcoming_returns()        to authenticated;
