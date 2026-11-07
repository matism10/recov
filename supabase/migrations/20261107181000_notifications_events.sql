-- Recov · Notificaciones (2a): eventos y nóminas (1 a 5).
-- Cada función se copia de su definición actual en la base (misma firma) y solo se le
-- agrega el aviso al final. Destinatarios de un evento: jugadores confirmados y activos
-- con cuenta; si el evento es Sevens, solo el grupo. Solo se avisa de eventos futuros.

-- Datos del evento que viajan en el payload.
create function private.event_notice_payload(p_event_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('event_id', e.id, 'event_type', e.type, 'starts_at', e.starts_at,
                            'ends_at', e.ends_at, 'location', e.location, 'opponent', e.opponent,
                            'format', e.format)
    from public.events e where e.id = p_event_id
$$;
revoke all on function private.event_notice_payload(uuid) from public;

-- Aviso a todo el público del evento (plantel o grupo Sevens).
create function private.notify_event_audience(p_event_id uuid, p_kind text, p_extra jsonb, p_dedupe text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_e public.events%rowtype;
begin
  select * into v_e from public.events where id = p_event_id;
  if not found then return; end if;
  perform private.notify_players(
    v_e.club_id,
    array(select p.id from public.players p
           where p.club_id = v_e.club_id and p.status = 'confirmado' and p.active
             and p.user_id is not null and private.in_format(v_e.club_id, p.user_id, v_e.format)),
    p_kind, private.event_notice_payload(p_event_id) || coalesce(p_extra, '{}'::jsonb), p_dedupe);
end $$;
revoke all on function private.notify_event_audience(uuid, text, jsonb, text) from public;

-- Aviso de nómina a un jugador: titular o banca según sport_format, y el puesto (la app
-- arma el código con src/lib/pitch.ts).
create function private.notify_callup(p_event_id uuid, p_player_id uuid, p_kind text, p_slot int)
returns void language plpgsql security definer set search_path = '' as $$
declare v_club uuid; v_sport text; v_starters int;
begin
  select e.club_id, c.sport, f.starters into v_club, v_sport, v_starters
    from public.events e
    join public.clubs c on c.id = e.club_id
    cross join lateral private.sport_format(c.sport, e.format) f
   where e.id = p_event_id;
  if v_club is null then return; end if;
  perform private.notify_players(
    v_club, array[p_player_id], p_kind,
    private.event_notice_payload(p_event_id) || jsonb_build_object(
      'sport', v_sport, 'slot', p_slot,
      'role', case when p_slot is null then null
                   when p_slot <= v_starters then 'titular' else 'banca' end),
    'callup:' || p_event_id);
end $$;
revoke all on function private.notify_callup(uuid, uuid, text, int) from public;

-- 1 · Evento cancelado
CREATE OR REPLACE FUNCTION public.cancel_event(p_event_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_club uuid := case when private.has_perm('eventos_cancelar') then private.current_club_id() end;
  v_starts timestamptz;
begin
  if v_club is null then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.events
     set cancelled_at = now(), cancelled_by = (select auth.uid()), updated_at = now()
   where id = p_event_id and club_id = v_club and cancelled_at is null
  returning starts_at into v_starts;
  if not found then raise exception 'not_found'; end if;

  if v_starts > now() then
    perform private.notify_event_audience(p_event_id, 'evento_cancelado', null, 'event:' || p_event_id);
  end if;
end $function$;

-- 2 · Evento nuevo (una notificación por serie si se repite)
CREATE OR REPLACE FUNCTION public.create_event(p_type text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_location text DEFAULT NULL::text, p_opponent text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_weeks integer DEFAULT 1, p_format text DEFAULT '15'::text)
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_club   uuid := private.events_actor_club();
  v_series uuid;
  v_id     uuid;
  v_first  uuid;
  v_i      int;
  v_tz constant text := 'America/Santiago';
begin
  if v_club is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_type is null or p_type not in ('entrenamiento', 'competencia') then raise exception 'invalid_type'; end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then raise exception 'invalid_range'; end if;
  if p_weeks is null or p_weeks < 1 or p_weeks > 12 then raise exception 'invalid_weeks'; end if;
  if p_weeks > 1 and p_type <> 'entrenamiento' then raise exception 'repeat_only_training'; end if;
  if p_format is null or p_format not in ('15', '7') then raise exception 'invalid_format'; end if;
  if p_weeks > 1 then v_series := gen_random_uuid(); end if;

  for v_i in 0 .. p_weeks - 1 loop
    insert into public.events (club_id, type, starts_at, ends_at, location, opponent, notes, series_id, created_by, format)
    values (
      v_club, p_type,
      ((p_starts_at at time zone v_tz) + make_interval(days => 7 * v_i)) at time zone v_tz,
      ((p_ends_at   at time zone v_tz) + make_interval(days => 7 * v_i)) at time zone v_tz,
      nullif(trim(p_location), ''), nullif(trim(p_opponent), ''), nullif(trim(p_notes), ''),
      v_series, (select auth.uid()), p_format)
    returning id into v_id;
    if v_first is null then v_first := v_id; end if;
    return next v_id;
  end loop;

  if p_starts_at > now() then
    perform private.notify_event_audience(
      v_first, 'evento_nuevo', jsonb_build_object('weeks', p_weeks, 'series_id', v_series),
      case when v_series is null then 'event:' || v_first else 'series:' || v_series end);
  end if;
end $function$;

-- 3 · Evento modificado (solo si cambian inicio, término o lugar)
CREATE OR REPLACE FUNCTION public.update_event(p_event_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_location text DEFAULT NULL::text, p_opponent text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_club uuid := private.events_actor_club();
  v_old  public.events%rowtype;
begin
  if v_club is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_old from public.events
   where id = p_event_id and club_id = v_club and cancelled_at is null
   for update;
  if not found then raise exception 'not_found'; end if;

  update public.events set
    starts_at = p_starts_at,
    ends_at   = p_ends_at,
    location  = nullif(trim(p_location), ''),
    opponent  = nullif(trim(p_opponent), ''),
    notes     = nullif(trim(p_notes), ''),
    updated_at = now()
  where id = p_event_id and club_id = v_club and cancelled_at is null;
  if not found then raise exception 'not_found'; end if;

  if (v_old.starts_at, v_old.ends_at, coalesce(v_old.location, ''))
       is distinct from (p_starts_at, p_ends_at, coalesce(nullif(trim(p_location), ''), ''))
     and greatest(v_old.starts_at, p_starts_at) > now() then
    perform private.notify_event_audience(
      p_event_id, 'evento_modificado',
      jsonb_build_object('prev_starts_at', v_old.starts_at, 'prev_ends_at', v_old.ends_at,
                         'prev_location', v_old.location),
      'event:' || p_event_id);
  end if;
end $function$;

-- 4 y 5 · Convocado o quitado (lista)
CREATE OR REPLACE FUNCTION public.set_event_callups(p_event_id uuid, p_player_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_club uuid := private.current_club_id();
  v_ids  uuid[] := coalesce(p_player_ids, '{}');
  v_before uuid[];
  v_future boolean;
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

  select coalesce(array_agg(c.player_id), '{}') into v_before
    from public.event_callups c
   where c.event_id = p_event_id and c.club_id = v_club and c.removed_at is null;
  select e.starts_at > now() into v_future from public.events e where e.id = p_event_id;

  update public.event_callups c
     set removed_at = now(), removed_by = (select auth.uid()), slot = null
   where c.event_id = p_event_id and c.club_id = v_club and c.removed_at is null
     and not (c.player_id = any (v_ids));

  insert into public.event_callups (club_id, event_id, player_id, created_by)
  select distinct v_club, p_event_id, x.id, (select auth.uid())
    from unnest(v_ids) as x(id)
  on conflict (event_id, player_id) do update
    set removed_at = null, removed_by = null
    where public.event_callups.removed_at is not null;

  if v_future then
    perform private.notify_callup(p_event_id, x.id, 'convocado', null)
       from (select distinct id from unnest(v_ids) as u(id)) x
      where not (x.id = any (v_before));
    perform private.notify_callup(p_event_id, x.id, 'quitado_nomina', null)
       from unnest(v_before) as x(id)
      where not (x.id = any (v_ids));
  end if;
end $function$;

-- 4 y 5 · Convocado (con titular o banca y puesto), cambio de puesto o quitado (cancha)
CREATE OR REPLACE FUNCTION public.set_event_lineup(p_event_id uuid, p_lineup jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_club    uuid := private.current_club_id();
  v_max     int;
  v_item    jsonb;
  v_player  uuid;
  v_slot    int;
  v_players uuid[] := '{}';
  v_slots   int[] := '{}';
  v_before  jsonb;
  v_future  boolean;
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

  if p_lineup is null or jsonb_typeof(p_lineup) <> 'array' then
    raise exception 'Formato de nómina inválido';
  end if;

  select f.starters + f.bench_size into v_max
    from public.events e
    join public.clubs c on c.id = e.club_id
    cross join lateral private.sport_format(c.sport, e.format) f
   where e.id = p_event_id;

  if jsonb_array_length(p_lineup) > v_max then
    raise exception 'La nómina admite hasta % jugadores', v_max;
  end if;

  for v_item in select * from jsonb_array_elements(p_lineup) loop
    if jsonb_typeof(v_item) <> 'object' then raise exception 'Formato de nómina inválido'; end if;

    begin
      v_player := (v_item ->> 'player_id')::uuid;
    exception when others then
      raise exception 'Jugador inválido';
    end;
    if v_player is null then raise exception 'Jugador inválido'; end if;
    if v_player = any (v_players) then raise exception 'Un jugador aparece dos veces en la nómina'; end if;
    if not exists (
      select 1 from public.players p
       where p.id = v_player and p.club_id = v_club and p.status = 'confirmado' and p.active)
    then
      raise exception 'Solo se puede convocar a jugadores confirmados del club';
    end if;
    v_players := v_players || v_player;

    if coalesce(jsonb_typeof(v_item -> 'slot'), 'null') <> 'null' then
      if jsonb_typeof(v_item -> 'slot') <> 'number' or (v_item ->> 'slot') !~ '^[0-9]+$' then
        raise exception 'Puesto inválido';
      end if;
      v_slot := (v_item ->> 'slot')::int;
      if v_slot < 1 or v_slot > v_max then
        raise exception 'El puesto debe estar entre 1 y %', v_max;
      end if;
      if v_slot = any (v_slots) then raise exception 'Hay dos jugadores en el puesto %', v_slot; end if;
      v_slots := v_slots || v_slot;
    end if;
  end loop;

  -- Nómina antes del cambio (jugador → puesto), para avisar solo lo que cambió.
  select coalesce(jsonb_object_agg(c.player_id::text, c.slot), '{}'::jsonb) into v_before
    from public.event_callups c
   where c.event_id = p_event_id and c.club_id = v_club and c.removed_at is null;
  select e.starts_at > now() into v_future from public.events e where e.id = p_event_id;

  -- Archiva a los que salen y libera todos los puestos antes de reasignarlos.
  update public.event_callups c
     set removed_at = now(), removed_by = (select auth.uid()), slot = null
   where c.event_id = p_event_id and c.club_id = v_club and c.removed_at is null
     and not (c.player_id = any (v_players));
  update public.event_callups c
     set slot = null
   where c.event_id = p_event_id and c.club_id = v_club and c.removed_at is null;

  insert into public.event_callups (club_id, event_id, player_id, created_by, slot)
  select v_club, p_event_id, x.player_id, (select auth.uid()), x.slot
    from jsonb_to_recordset(p_lineup) as x(player_id uuid, slot smallint)
  on conflict (event_id, player_id) do update
    set removed_at = null, removed_by = null, slot = excluded.slot;

  if v_future then
    perform private.notify_callup(p_event_id, x.player_id, 'convocado', x.slot)
       from jsonb_to_recordset(p_lineup) as x(player_id uuid, slot smallint)
      where not (v_before ? x.player_id::text)
         or (v_before ->> x.player_id::text)::int is distinct from x.slot::int;
    perform private.notify_callup(p_event_id, k.id::uuid, 'quitado_nomina', null)
       from jsonb_object_keys(v_before) as k(id)
      where not (k.id::uuid = any (v_players));
  end if;
end $function$;
