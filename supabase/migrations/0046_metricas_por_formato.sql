-- Recov · 0046 · Métricas del Resumen y de Métricas por formato (Rugby Sevens)
-- Versiones nuevas de las funciones dash_* (0020) con p_format: en '15' son iguales a
-- las de siempre; en '7' cuentan solo al grupo Sevens activo (cuentas con ficha de
-- jugador) y usan su posición de Sevens. Las de siempre no cambian (sin DROP).

-- ¿El jugador cuenta en este formato? En '15', todos; en '7', solo el grupo activo.
create function private.in_format(p_club uuid, p_user uuid, p_format text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_format = '15' or (p_format = '7' and p_user is not null and exists (
    select 1 from public.sevens_group g
     where g.club_id = p_club and g.member_id = p_user and g.archived_at is null))
$$;
revoke all on function private.in_format(uuid, uuid, text) from public;
grant execute on function private.in_format(uuid, uuid, text) to authenticated;

-- Posición que muestran las métricas: la de la ficha en '15'; la de Sevens en '7'.
create function private.format_position(p_club uuid, p_user uuid, p_position text, p_format text)
returns text language sql stable security definer set search_path = ''
as $$
  select coalesce(case when p_format = '7'
           then (select g.position from public.sevens_group g
                  where g.club_id = p_club and g.member_id = p_user and g.archived_at is null)
           else p_position end, 'Sin posición')
$$;
revoke all on function private.format_position(uuid, uuid, text, text) from public;
grant execute on function private.format_position(uuid, uuid, text, text) to authenticated;

create function private.check_dash(p_format text)
returns uuid language plpgsql stable security definer set search_path = ''
as $$
declare
  cid uuid := private.current_club_id();
begin
  if (select auth.uid()) is null or cid is null or not private.is_staff() then
    raise exception 'No tienes permiso para esta acción';
  end if;
  if p_format is null or p_format not in ('15', '7') then raise exception 'invalid_format'; end if;
  return cid;
end $$;
revoke all on function private.check_dash(text) from public;
grant execute on function private.check_dash(text) to authenticated;

create function public.dash_summary(p_format text)
returns table (total integer, disponibles integer, en_revision integer, lesionados integer, reintegro integer)
language plpgsql stable security definer set search_path = ''
as $function$
#variable_conflict use_column
declare
  cid uuid := private.check_dash(p_format);
begin
  return query
  select count(*)::int,
         (count(*) filter (where p.availability = 'disponible'))::int,
         (count(*) filter (where p.availability = 'en_revision'))::int,
         (count(*) filter (where p.availability = 'lesionado'))::int,
         (count(*) filter (where p.availability = 'reintegro'))::int
    from public.players p
   where p.club_id = cid and p.status = 'confirmado' and p.active
     and private.in_format(cid, p.user_id, p_format);
end $function$;

create function public.dash_availability_series(p_weeks integer, p_format text)
returns table (week_start date, disponible integer, en_revision integer, lesionado integer, reintegro integer)
language plpgsql stable security definer set search_path = ''
as $function$
#variable_conflict use_column
declare
  cid uuid := private.check_dash(p_format);
begin
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
       and private.in_format(cid, p.user_id, p_format)
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

create function public.dash_injuries_by_week(p_weeks integer, p_format text)
returns table (week_start date, injuries_count integer)
language plpgsql stable security definer set search_path = ''
as $function$
#variable_conflict use_column
declare
  cid uuid := private.check_dash(p_format);
begin
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
       and private.in_format(cid, p.user_id, p_format)
  )
  select w.ws, count(inj.started_on)::int
    from weeks w
    left join inj on inj.started_on >= w.ws and inj.started_on < w.ws + 7
   group by w.ws
   order by w.ws;
end $function$;

create function public.dash_injuries_by_place(p_format text)
returns table (place_key text, injuries_count integer)
language plpgsql stable security definer set search_path = ''
as $function$
#variable_conflict use_column
declare
  cid uuid := private.check_dash(p_format);
begin
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
       and private.in_format(cid, p.user_id, p_format)
  )
  select pl.k, count(inj.k)::int
    from places pl
    left join inj on inj.k = pl.k
   group by pl.k, pl.ord
   order by pl.ord;
end $function$;

create function public.dash_injuries_by_position(p_format text)
returns table (position_name text, injuries_count integer, players_count integer)
language plpgsql stable security definer set search_path = ''
as $function$
#variable_conflict use_column
declare
  cid uuid := private.check_dash(p_format);
begin
  return query
  select private.format_position(cid, p.user_id, p.position, p_format),
         count(*)::int,
         count(distinct p.id)::int
    from public.injuries i
    join public.players p on p.id = i.player_id and p.club_id = i.club_id
   where i.club_id = cid and i.status <> 'descartada' and p.status = 'confirmado'
     and i.started_on >= (current_date - interval '12 months')::date
     and private.in_format(cid, p.user_id, p_format)
   group by 1
   order by 2 desc, 1;
end $function$;

create function public.dash_recurring_players(p_format text)
returns table (player_id uuid, full_name text, position_name text, injuries_count integer, last_injury_on date)
language plpgsql stable security definer set search_path = ''
as $function$
#variable_conflict use_column
declare
  cid uuid := private.check_dash(p_format);
begin
  return query
  select p.id, p.full_name, private.format_position(cid, p.user_id, p.position, p_format),
         count(*)::int, max(i.started_on)
    from public.injuries i
    join public.players p on p.id = i.player_id and p.club_id = i.club_id
   where i.club_id = cid and i.status <> 'descartada'
     and p.status = 'confirmado' and p.active
     and i.started_on >= (current_date - interval '12 months')::date
     and private.in_format(cid, p.user_id, p_format)
   group by p.id, p.full_name, p.position, p.user_id
  having count(*) >= 2
   order by 4 desc, 5 desc
   limit 20;
end $function$;

create function public.dash_upcoming_returns(p_format text)
returns table (injury_id uuid, player_id uuid, full_name text, position_name text, return_on date, days_left integer)
language plpgsql stable security definer set search_path = ''
as $function$
#variable_conflict use_column
declare
  cid uuid := private.check_dash(p_format);
begin
  return query
  select i.id, p.id, p.full_name, private.format_position(cid, p.user_id, p.position, p_format),
         i.expected_return_on, (i.expected_return_on - current_date)::int
    from public.injuries i
    join public.players p on p.id = i.player_id and p.club_id = i.club_id
   where i.club_id = cid and i.status = 'activa'
     and p.status = 'confirmado' and p.active
     and i.expected_return_on is not null
     and i.expected_return_on <= current_date + 30
     and private.in_format(cid, p.user_id, p_format)
   order by i.expected_return_on, p.full_name
   limit 50;
end $function$;

revoke all on function
  public.dash_summary(text),
  public.dash_availability_series(integer, text),
  public.dash_injuries_by_week(integer, text),
  public.dash_injuries_by_place(text),
  public.dash_injuries_by_position(text),
  public.dash_recurring_players(text),
  public.dash_upcoming_returns(text)
from public, anon;
grant execute on function
  public.dash_summary(text),
  public.dash_availability_series(integer, text),
  public.dash_injuries_by_week(integer, text),
  public.dash_injuries_by_place(text),
  public.dash_injuries_by_position(text),
  public.dash_recurring_players(text),
  public.dash_upcoming_returns(text)
to authenticated, service_role;
