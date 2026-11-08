-- Recov · Sesiones de gimnasio en el calendario (solo lectura).
-- No son events: el calendario las pide aparte. El gimnasio no tiene formato (cuenta en '15' y
-- en '7'), por eso p_format solo se valida y no filtra.
--   · Jugador confirmado y activo: solo sus sesiones (private.gym_assignments).
--   · Staff confirmado con gimnasio_planes o lesiones_ver: sesiones de los planes publicados del club.
-- Siempre del club activo, con planes y sesiones no archivados.

create function public.gym_calendar(p_from date, p_to date, p_format text default '15')
returns table (day date, session_id uuid, plan_id uuid, title text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_club   uuid := private.current_club_id();
  v_player uuid;
begin
  if v_club is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then
    raise exception 'Rango de fechas no válido';
  end if;
  if p_format is not null and p_format not in ('15', '7') then
    raise exception 'Formato no válido';
  end if;

  if private.has_perm(v_club, 'gimnasio_planes') or private.has_perm(v_club, 'lesiones_ver') then
    return query
      select d.d::date, s.id, gp.id, s.label
        from public.gym_plans gp
        join public.gym_plan_sessions s on s.plan_id = gp.id and s.archived_at is null
        cross join lateral generate_series(
          greatest(gp.starts_on, p_from, (gp.published_at at time zone 'America/Santiago')::date)::timestamp,
          least(gp.ends_on, p_to)::timestamp,
          interval '1 day') d(d)
       where gp.club_id = v_club and gp.status = 'publicado'
         and extract(isodow from d.d)::smallint = s.weekday
       order by 1, 4;
    return;
  end if;

  v_player := private.my_active_player(v_club);
  if v_player is null then raise exception 'forbidden' using errcode = '42501'; end if;

  return query
    select a.day, a.plan_session_id, a.plan_id, a.label
      from private.gym_assignments(v_club, p_from, p_to, v_player) a
      join public.gym_plans gp on gp.id = a.plan_id
     where gp.status = 'publicado' and gp.archived_at is null
     order by 1, 4;
end $$;
revoke all on function public.gym_calendar(date, date, text) from public, anon;
grant execute on function public.gym_calendar(date, date, text) to authenticated;
