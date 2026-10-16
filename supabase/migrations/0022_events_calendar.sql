-- Recov · 0022 · Calendario de eventos (entrenamientos y competencias)
-- Ejecutar DESPUÉS de 0021.
--
-- Eventos del club con la disponibilidad proyectada del plantel por evento.
--   Ven los eventos:    todos los confirmados del club (también los jugadores).
--   Crean/editan/anulan: head coach, manager y entrenador, vía funciones.
--   Disponibilidad por evento: solo el staff; devuelve 'ok' | 'duda' | 'no' por
--   jugador, sin fechas ni diagnóstico.
-- No hay escritura directa: authenticated solo tiene SELECT sobre events.

-- ---------------------------------------------------------------------
-- Tabla
-- ---------------------------------------------------------------------
create table public.events (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  type         text not null check (type in ('entrenamiento', 'competencia')),
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  location     text,
  opponent     text,
  notes        text,
  series_id    uuid,            -- mismo valor en los eventos creados juntos al repetir
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint events_range_chk check (ends_at > starts_at),
  constraint events_opponent_chk check (opponent is null or type = 'competencia'),
  constraint events_len_chk check (
    char_length(coalesce(location, '')) <= 120
    and char_length(coalesce(opponent, '')) <= 80
    and char_length(coalesce(notes, '')) <= 500)
);

create index events_club_starts_idx on public.events (club_id, starts_at);

alter table public.events enable row level security;
revoke all on table public.events from anon, authenticated;
grant select on table public.events to authenticated;

-- Lectura: los confirmados del club (staff y jugadores). Los pendientes no ven nada.
create policy events_select on public.events
  for select to authenticated
  using (club_id = private.current_club_id());

-- ---------------------------------------------------------------------
-- Helpers internos (no ejecutables por clientes)
-- ---------------------------------------------------------------------
-- Club de quien puede crear, editar y anular eventos: head coach, manager o entrenador.
create function private.events_actor_club()
returns uuid
language sql stable security definer set search_path to ''
as $$
  select case
    when private.has_role('head_coach') or private.has_role('manager') or private.has_role('entrenador')
      then private.current_club_id()
  end
$$;

-- Club de quien puede ver la disponibilidad por evento: cualquier rol de staff.
create function private.events_staff_club()
returns uuid
language sql stable security definer set search_path to ''
as $$
  select case when private.is_staff() then private.current_club_id() end
$$;

revoke all on function private.events_actor_club() from public, anon, authenticated;
revoke all on function private.events_staff_club() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Crear (con repetición semanal para entrenamientos)
-- ---------------------------------------------------------------------
-- p_weeks > 1 crea un evento por semana con el mismo series_id. La repetición se
-- calcula en hora local de Chile, así que la hora se mantiene aunque cambie el horario.
create function public.create_event(
  p_type text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_location text default null,
  p_opponent text default null,
  p_notes text default null,
  p_weeks int default 1
) returns setof uuid
language plpgsql security definer set search_path to ''
as $$
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
  if p_weeks > 1 then v_series := gen_random_uuid(); end if;

  for v_i in 0 .. p_weeks - 1 loop
    insert into public.events (club_id, type, starts_at, ends_at, location, opponent, notes, series_id, created_by)
    values (
      v_club, p_type,
      ((p_starts_at at time zone v_tz) + make_interval(days => 7 * v_i)) at time zone v_tz,
      ((p_ends_at   at time zone v_tz) + make_interval(days => 7 * v_i)) at time zone v_tz,
      nullif(trim(p_location), ''), nullif(trim(p_opponent), ''), nullif(trim(p_notes), ''),
      v_series, (select auth.uid()))
    returning id into v_id;
    return next v_id;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Editar y anular (solo eventos no anulados del propio club)
-- ---------------------------------------------------------------------
create function public.update_event(
  p_event_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_location text default null,
  p_opponent text default null,
  p_notes text default null
) returns void
language plpgsql security definer set search_path to ''
as $$
declare
  v_club uuid := private.events_actor_club();
begin
  if v_club is null then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.events set
    starts_at = p_starts_at,
    ends_at   = p_ends_at,
    location  = nullif(trim(p_location), ''),
    opponent  = nullif(trim(p_opponent), ''),
    notes     = nullif(trim(p_notes), ''),
    updated_at = now()
  where id = p_event_id and club_id = v_club and cancelled_at is null;
  if not found then raise exception 'not_found'; end if;
end $$;

create function public.cancel_event(p_event_id uuid)
returns void
language plpgsql security definer set search_path to ''
as $$
declare
  v_club uuid := private.events_actor_club();
begin
  if v_club is null then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.events
     set cancelled_at = now(), cancelled_by = (select auth.uid()), updated_at = now()
   where id = p_event_id and club_id = v_club and cancelled_at is null;
  if not found then raise exception 'not_found'; end if;
end $$;

-- ---------------------------------------------------------------------
-- Disponibilidad proyectada por evento: 'ok' | 'duda' | 'no'. Solo staff.
-- ---------------------------------------------------------------------
-- Evento pasado: el estado de cada jugador en availability_log al momento de
-- starts_at (disponible → ok, lesionado → no, resto → duda); sin registro previo,
-- el jugador queda fuera.
-- Evento futuro (día del evento en hora de Chile, "d"):
--   · lesión abierta con alta estimada: d < alta → no; d = alta o alta vencida → duda; d > alta → ok.
--   · sin lesión abierta, o con alguna sin fecha: según la disponibilidad actual
--     (disponible → ok; lesionado → no hasta 14 días y duda después; resto → duda).
--   Gana el estado más restrictivo. Nunca devuelve fechas ni diagnóstico.
create function public.event_availability(p_event_id uuid)
returns table (player_id uuid, full_name text, player_position text, state text)
language plpgsql stable security definer set search_path to ''
as $$
#variable_conflict use_column
declare
  v_club  uuid := private.events_staff_club();
  v_ev    public.events%rowtype;
  v_tz constant text := 'America/Santiago';
  v_day   date;
  v_today date;
begin
  if v_club is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_ev from public.events e where e.id = p_event_id and e.club_id = v_club;
  if not found then raise exception 'not_found'; end if;

  v_day   := (v_ev.starts_at at time zone v_tz)::date;
  v_today := (now() at time zone v_tz)::date;

  if v_ev.starts_at < now() then
    return query
      select pl.id, pl.full_name, pl.position,
             case l.to_status when 'disponible' then 'ok'
                              when 'lesionado'  then 'no'
                              else 'duda' end
        from public.players pl
        join lateral (
          select a.to_status from public.availability_log a
           where a.player_id = pl.id and a.club_id = v_club and a.changed_at <= v_ev.starts_at
           order by a.changed_at desc, a.id desc
           limit 1) l on true
       where pl.club_id = v_club and pl.status = 'confirmado' and pl.active;
  else
    return query
      with inj as (
        select i.player_id as pid,
               max(case
                     when i.expected_return_on is null then 0
                     when i.expected_return_on < v_today then 1
                     when v_day < i.expected_return_on then 2
                     when v_day = i.expected_return_on then 1
                     else 0 end) as sev,
               bool_or(i.expected_return_on is null) as undated
          from public.injuries i
         where i.club_id = v_club and i.status in ('en_evaluacion', 'activa')
         group by i.player_id)
      select pl.id, pl.full_name, pl.position,
             (array['ok', 'duda', 'no'])[1 + greatest(
               coalesce(inj.sev, 0),
               case when inj.pid is null or inj.undated then
                      case pl.availability
                        when 'disponible' then 0
                        when 'lesionado' then case when v_day > v_today + 14 then 1 else 2 end
                        else 1 end
                    else 0 end)]
        from public.players pl
        left join inj on inj.pid = pl.id
       where pl.club_id = v_club and pl.status = 'confirmado' and pl.active;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Permisos: solo authenticated (cada función valida rol y club por dentro)
-- ---------------------------------------------------------------------
revoke all on function public.create_event(text, timestamptz, timestamptz, text, text, text, int) from public, anon, authenticated;
revoke all on function public.update_event(uuid, timestamptz, timestamptz, text, text, text) from public, anon, authenticated;
revoke all on function public.cancel_event(uuid) from public, anon, authenticated;
revoke all on function public.event_availability(uuid) from public, anon, authenticated;
grant execute on function public.create_event(text, timestamptz, timestamptz, text, text, text, int) to authenticated;
grant execute on function public.update_event(uuid, timestamptz, timestamptz, text, text, text) to authenticated;
grant execute on function public.cancel_event(uuid) to authenticated;
grant execute on function public.event_availability(uuid) to authenticated;
