-- Recov · Ausencias avisadas (PR 1 de 2).
-- Un jugador (o el staff por él) avisa que no va a un evento o que estará ausente varios días
-- (vacaciones, viaje, estudios...). Un aviso NO escribe event_attendance: la lista oficial
-- sigue siendo del staff. Con aviso, el jugador no tiene sRPE ni bienestar por responder.
-- La nota (máx. 200) la ven solo el staff con lista_pasar y el propio jugador: por eso la
-- columna `note` no se lee directo (solo por las funciones de este archivo).

-- ---------------------------------------------------------------------------
-- 1. Permisos
-- ---------------------------------------------------------------------------
insert into private.permissions (key, delegable, delegation) values
  ('ausencias_declarar', true,  null),
  ('paron_declarar',     false, null);

insert into private.role_permissions (role, perm) values
  ('manager',    'ausencias_declarar'),
  ('entrenador', 'ausencias_declarar'),
  ('manager',    'paron_declarar');

-- ---------------------------------------------------------------------------
-- 2. Tabla
-- ---------------------------------------------------------------------------
create table public.absences (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  player_id  uuid,                       -- null = todo el plantel (solo períodos)
  scope      text not null check (scope in ('evento', 'periodo')),
  event_id   uuid,
  starts_on  date,
  ends_on    date,                       -- null = sin fecha de vuelta
  reason     text not null check (reason in ('vacaciones', 'viaje_trabajo', 'estudios', 'salud', 'otro')),
  note       text check (note is null or length(note) <= 200),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  ended_at   timestamptz,
  ended_by   uuid references auth.users(id),
  foreign key (player_id, club_id) references public.players(id, club_id),
  foreign key (event_id, club_id) references public.events(id, club_id),
  constraint absences_shape check (
    (scope = 'evento'  and player_id is not null and event_id is not null
                       and starts_on is null and ends_on is null)
    or
    (scope = 'periodo' and event_id is null and starts_on is not null
                       and (ends_on is null or ends_on >= starts_on)))
);
create unique index absences_event_uq on public.absences (event_id, player_id)
  where scope = 'evento' and ended_at is null;
create index absences_club_player_idx on public.absences (club_id, player_id) where ended_at is null;
create index absences_event_idx on public.absences (event_id) where event_id is not null;

alter table public.absences enable row level security;
revoke all on public.absences from anon, authenticated;
-- Todas las columnas menos `note`.
grant select (id, club_id, player_id, scope, event_id, starts_on, ends_on, reason,
              created_by, created_at, ended_at, ended_by)
  on public.absences to authenticated;

create policy absences_select on public.absences
  for select to authenticated
  using (private.is_confirmed_member(club_id)
         and (private.has_perm(club_id, 'lista_pasar')
              or player_id is null
              or player_id = private.current_player_id(club_id)));

-- ---------------------------------------------------------------------------
-- 3. Categorías de notificación
-- ---------------------------------------------------------------------------
create or replace function private.notification_category(p_kind text)
returns text language sql immutable set search_path = '' as $$
  select case p_kind
    when 'evento_cancelado'     then 'calendario'
    when 'evento_nuevo'         then 'calendario'
    when 'evento_modificado'    then 'calendario'
    when 'convocado'            then 'nomina'
    when 'quitado_nomina'       then 'nomina'
    when 'lesion_confirmada'    then 'lesion'
    when 'lesion_descartada'    then 'lesion'
    when 'fase_cambio'          then 'lesion'
    when 'alta'                 then 'lesion'
    when 'disponibilidad'       then 'lesion'
    when 'marcado_lesionado'    then 'lesion'
    when 'plan_gimnasio'        then 'gimnasio'
    when 'evaluacion_resultado' then 'evaluacion'
    when 'registro_aprobado'    then 'cuenta'
    when 'roles_cambio'         then 'cuenta'
    when 'sevens_agregado'      then 'sevens'
    when 'posicion_cambio'      then 'cuenta'
    when 'registro_pendiente'   then 'registros'
    when 'lesion_por_revisar'   then 'lesion'
    when 'documento_subido'     then 'lesion'
    when 'funcion_asignada'     then 'cuenta'
    when 'ausencias_evento'               then 'calendario'
    when 'ausencia_periodo'               then 'calendario'
    when 'paron_plantel'                  then 'calendario'
    when 'ausencia_registrada_por_staff'  then 'calendario'
  end
$$;

-- ---------------------------------------------------------------------------
-- 4. Ayudantes privados
-- ---------------------------------------------------------------------------
-- Aviso vigente de un jugador para un evento: evento > período propio > parón del plantel.
create function private.event_absence(p_club uuid, p_player uuid, p_event uuid)
returns table (source text, reason text)
language sql stable security definer set search_path = '' as $$
  select x.source, x.reason from (
    select 'aviso'::text as source, a.reason, 1 as pri
      from public.absences a
     where a.club_id = p_club and a.scope = 'evento' and a.ended_at is null
       and a.event_id = p_event and a.player_id = p_player
    union all
    select case when a.player_id is null then 'plantel' else 'periodo' end, a.reason,
           case when a.player_id is null then 3 else 2 end
      from public.absences a
      join public.events e on e.id = p_event and e.club_id = p_club
     where a.club_id = p_club and a.scope = 'periodo' and a.ended_at is null
       and (a.player_id is null or a.player_id = p_player)
       and a.starts_on <= (e.starts_at at time zone 'America/Santiago')::date
       and (a.ends_on is null or a.ends_on >= (e.starts_at at time zone 'America/Santiago')::date)
  ) x order by x.pri limit 1
$$;
revoke all on function private.event_absence(uuid, uuid, uuid) from public;

-- Aviso de período (propio o del plantel) que cubre un día.
create function private.period_absence_on(p_club uuid, p_player uuid, p_day date)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.absences a
     where a.club_id = p_club and a.scope = 'periodo' and a.ended_at is null
       and (a.player_id is null or a.player_id = p_player)
       and a.starts_on <= p_day and (a.ends_on is null or a.ends_on >= p_day))
$$;
revoke all on function private.period_absence_on(uuid, uuid, date) from public;

-- Notificación "N jugadores avisaron que no van": una viva por evento, reconstruida desde
-- la tabla. Con 0 avisos (o evento cancelado o ya pasado) se descarta.
create function private.refresh_event_absence_notice(p_event uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_club uuid; v_n int; v_key text := 'ausencias-evento:' || p_event; v_payload jsonb;
begin
  select e.club_id into v_club from public.events e
   where e.id = p_event and e.cancelled_at is null and e.starts_at > now();
  if v_club is null then
    select e.club_id into v_club from public.events e where e.id = p_event;
    if v_club is not null then perform private.dismiss_notification_keys(v_club, array[v_key]); end if;
    return;
  end if;
  select count(distinct a.player_id) into v_n from public.absences a
   where a.event_id = p_event and a.scope = 'evento' and a.ended_at is null;
  if v_n = 0 then
    perform private.dismiss_notification_keys(v_club, array[v_key]);
    return;
  end if;
  v_payload := private.event_notice_payload(p_event) || jsonb_build_object('count', v_n);
  perform private.notify_perm(v_club, 'lista_pasar', 'ausencias_evento', v_payload, v_key);
  -- Quien hizo la acción no recibe aviso, pero si ya tenía uno vivo, que no quede desactualizado.
  update public.notifications set payload = v_payload
   where club_id = v_club and dedupe_key = v_key and dismissed_at is null;
end $$;
revoke all on function private.refresh_event_absence_notice(uuid) from public;

-- ---------------------------------------------------------------------------
-- 5. declare_absence / end_absence
-- ---------------------------------------------------------------------------
create function public.declare_absence(
  p_player uuid, p_scope text, p_event uuid, p_starts_on date, p_ends_on date,
  p_reason text, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_club    uuid := private.current_club_id();
  v_self    uuid;
  v_staff   boolean;
  v_paron   boolean;
  v_target  uuid;
  v_by_staff boolean := false;
  v_today   date := private.chile_today();
  v_note    text := nullif(btrim(coalesce(p_note, '')), '');
  v_id      uuid;
  ev        record;
  pl        record;
  v_pname   text;
  v_desc    jsonb;
begin
  if v_club is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_scope is null or p_scope not in ('evento', 'periodo') then raise exception 'Tipo de aviso inválido'; end if;
  if p_reason is null or p_reason not in ('vacaciones', 'viaje_trabajo', 'estudios', 'salud', 'otro') then
    raise exception 'Elige un motivo';
  end if;
  if v_note is not null and length(v_note) > 200 then raise exception 'La nota admite hasta 200 caracteres'; end if;

  v_self  := private.my_active_player(v_club);
  v_staff := private.has_perm(v_club, 'ausencias_declarar');
  v_paron := private.has_perm(v_club, 'paron_declarar');

  if p_player is null and p_scope = 'periodo' and v_paron then
    v_target := null; v_by_staff := true;
  elsif p_player is not null and v_staff then
    v_target := p_player; v_by_staff := true;
  elsif v_self is not null and not v_staff and not v_paron then
    v_target := v_self;            -- el jugador solo avisa por sí mismo
  elsif v_self is not null and p_player is not distinct from v_self then
    v_target := v_self;
  else
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_target is not null then
    select p.id, p.user_id, p.full_name into pl from public.players p
     where p.id = v_target and p.club_id = v_club and p.status = 'confirmado' and p.active;
    if not found then raise exception 'Jugador inválido'; end if;
    v_pname := pl.full_name;
  end if;

  if p_scope = 'evento' then
    if v_target is null or p_event is null then raise exception 'Un aviso de evento exige jugador y evento'; end if;
    select e.id, e.format, e.starts_at, e.cancelled_at into ev from public.events e
     where e.id = p_event and e.club_id = v_club;
    if not found then raise exception 'not_found'; end if;
    if ev.cancelled_at is not null then raise exception 'El evento fue cancelado'; end if;
    if ev.starts_at <= now() then raise exception 'El evento ya empezó'; end if;
    if not private.in_format(v_club, pl.user_id, ev.format) then
      raise exception 'El jugador no participa de este formato';
    end if;
    if exists (select 1 from public.absences a
                where a.event_id = p_event and a.player_id = v_target and a.scope = 'evento' and a.ended_at is null) then
      raise exception 'Ya hay un aviso para este evento';
    end if;
    insert into public.absences (club_id, player_id, scope, event_id, reason, note, created_by)
    values (v_club, v_target, 'evento', p_event, p_reason, v_note, (select auth.uid()))
    returning id into v_id;

    perform private.refresh_event_absence_notice(p_event);
    if v_by_staff then
      perform private.notify_players(v_club, array[v_target], 'ausencia_registrada_por_staff',
        private.event_notice_payload(p_event) || jsonb_build_object('scope', 'evento', 'reason', p_reason),
        'ausencia-staff:' || v_id);
    end if;
  else
    if p_event is not null then raise exception 'Un período no lleva evento'; end if;
    if p_starts_on is null then raise exception 'Indica desde cuándo'; end if;
    if p_starts_on < v_today - 60 then raise exception 'La fecha de inicio es demasiado antigua'; end if;
    if p_ends_on is not null and (p_ends_on < p_starts_on or p_ends_on > p_starts_on + 366) then
      raise exception 'Fechas inválidas';
    end if;
    insert into public.absences (club_id, player_id, scope, starts_on, ends_on, reason, note, created_by)
    values (v_club, v_target, 'periodo', p_starts_on, p_ends_on, p_reason, v_note, (select auth.uid()))
    returning id into v_id;

    v_desc := jsonb_build_object('absence_id', v_id, 'reason', p_reason,
                                 'starts_on', p_starts_on, 'ends_on', p_ends_on);
    if v_target is null then
      -- Parón del plantel: lo ven todos los confirmados.
      perform private.notify(v_club, m.user_id, 'paron_plantel', v_desc, 'paron-plantel:' || v_id)
        from public.club_members m where m.club_id = v_club and m.status = 'confirmado';
    else
      perform private.notify_perm(v_club, 'lista_pasar', 'ausencia_periodo',
        v_desc || jsonb_build_object('player_id', v_target, 'player_name', v_pname),
        'ausencia-periodo:' || v_id);
      if v_by_staff then
        perform private.notify_players(v_club, array[v_target], 'ausencia_registrada_por_staff',
          v_desc || jsonb_build_object('scope', 'periodo'), 'ausencia-staff:' || v_id);
      end if;
    end if;
  end if;
  return v_id;
end $$;
revoke all on function public.declare_absence(uuid, text, uuid, date, date, text, text) from public, anon;
grant execute on function public.declare_absence(uuid, text, uuid, date, date, text, text) to authenticated;

-- Quitar un aviso (autor, o staff con permiso) o, con p_returned, "Ya volví" en un período:
-- el aviso queda hasta hoy.
create function public.end_absence(p_id uuid, p_returned boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_club  uuid := private.current_club_id();
  a       public.absences%rowtype;
  v_self  uuid;
  v_today date := private.chile_today();
  v_ok    boolean;
begin
  if v_club is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into a from public.absences where id = p_id and club_id = v_club and ended_at is null;
  if not found then raise exception 'not_found'; end if;

  v_self := private.my_active_player(v_club);
  v_ok := a.created_by = (select auth.uid())
       or (a.player_id is not null and a.player_id = v_self)
       or (a.player_id is not null and private.has_perm(v_club, 'ausencias_declarar'))
       or (a.player_id is null and private.has_perm(v_club, 'paron_declarar'));
  if not v_ok then raise exception 'forbidden' using errcode = '42501'; end if;
  -- El jugador no puede quitar un parón del plantel (aunque sea su autor, no lo es).

  if p_returned then
    if a.scope <> 'periodo' or a.starts_on > v_today or (a.ends_on is not null and a.ends_on < v_today) then
      raise exception 'Este aviso no está en curso';
    end if;
    update public.absences set ends_on = v_today where id = a.id;
  else
    update public.absences set ended_at = now(), ended_by = (select auth.uid()) where id = a.id;
  end if;

  if a.scope = 'evento' then
    perform private.refresh_event_absence_notice(a.event_id);
  elsif not p_returned then
    perform private.dismiss_notification_keys(v_club,
      array['ausencia-periodo:' || a.id, 'paron-plantel:' || a.id, 'ausencia-staff:' || a.id]);
  end if;
end $$;
revoke all on function public.end_absence(uuid, boolean) from public, anon;
grant execute on function public.end_absence(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Lecturas
-- ---------------------------------------------------------------------------
-- Estado de un aviso: 'vigente' (en curso o próximo), 'pasado' o 'quitado'.
create function private.absence_state(p_ended_at timestamptz, p_scope text, p_ends_on date,
                                      p_event_ends timestamptz, p_event_cancelled timestamptz)
returns text language sql stable set search_path = '' as $$
  select case
    when p_ended_at is not null then 'quitado'
    when p_scope = 'evento' and (p_event_cancelled is not null or p_event_ends < now()) then 'pasado'
    when p_scope = 'periodo' and p_ends_on is not null and p_ends_on < (now() at time zone 'America/Santiago')::date then 'pasado'
    else 'vigente' end
$$;
revoke all on function private.absence_state(timestamptz, text, date, timestamptz, timestamptz) from public;

-- Mis avisos y los del plantel (sin la nota de estos). Solo jugador confirmado y activo.
create function public.my_absences()
returns table (id uuid, scope text, event_id uuid, event_type text, event_starts_at timestamptz,
               event_ends_at timestamptz, opponent text, starts_on date, ends_on date, reason text,
               note text, is_squad boolean, by_staff boolean, in_progress boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_club uuid := private.current_club_id();
  v_self uuid;
  v_today date := private.chile_today();
begin
  if v_club is null then return; end if;
  v_self := private.my_active_player(v_club);
  if v_self is null then return; end if;
  return query
  select a.id, a.scope, a.event_id, e.type, e.starts_at, e.ends_at, e.opponent, a.starts_on, a.ends_on,
         a.reason, case when a.player_id is null then null else a.note end, a.player_id is null,
         a.created_by <> (select auth.uid()),
         (a.scope = 'periodo' and a.starts_on <= v_today),
         a.created_at
    from public.absences a
    left join public.events e on e.id = a.event_id and e.club_id = a.club_id
   where a.club_id = v_club and (a.player_id = v_self or a.player_id is null)
     and private.absence_state(a.ended_at, a.scope, a.ends_on, e.ends_at, e.cancelled_at) = 'vigente'
   order by coalesce(e.starts_at, a.starts_on::timestamp at time zone 'America/Santiago'), a.created_at;
end $$;
revoke all on function public.my_absences() from public, anon;
grant execute on function public.my_absences() to authenticated;

-- Staff con lista_pasar: avisos del plantel. p_state: 'vigente' | 'historial' (pasados y
-- quitados) | null (todos). p_from/p_to (opcionales) acotan por fecha del evento o del período.
create function public.club_absences(p_from date default null, p_to date default null,
                                     p_state text default null)
returns table (id uuid, player_id uuid, player_name text, scope text, event_id uuid, event_type text,
               event_starts_at timestamptz, event_format text, opponent text, starts_on date,
               ends_on date, reason text, note text, state text, in_progress boolean,
               created_by_name text, created_at timestamptz, ended_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_club uuid := private.current_club_id();
  v_today date := private.chile_today();
begin
  if v_club is null or not private.has_perm(v_club, 'lista_pasar') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_state is not null and p_state not in ('vigente', 'historial') then raise exception 'Estado inválido'; end if;
  return query
  select * from (
    select a.id, a.player_id, p.full_name, a.scope, a.event_id, e.type, e.starts_at, e.format, e.opponent,
           a.starts_on, a.ends_on, a.reason, a.note,
           private.absence_state(a.ended_at, a.scope, a.ends_on, e.ends_at, e.cancelled_at) as st,
           (a.scope = 'periodo' and a.starts_on <= v_today
              and (a.ends_on is null or a.ends_on >= v_today) and a.ended_at is null) as inp,
           pr.full_name as cb, a.created_at, a.ended_at
      from public.absences a
      left join public.players p on p.id = a.player_id and p.club_id = a.club_id
      left join public.events e on e.id = a.event_id and e.club_id = a.club_id
      left join public.profiles pr on pr.id = a.created_by
     where a.club_id = v_club
       and (p_from is null or coalesce((e.starts_at at time zone 'America/Santiago')::date, a.ends_on, 'infinity'::date) >= p_from)
       and (p_to is null or coalesce((e.starts_at at time zone 'America/Santiago')::date, a.starts_on) <= p_to)
  ) r
  where p_state is null
     or (p_state = 'vigente' and r.st = 'vigente')
     or (p_state = 'historial' and r.st <> 'vigente')
  order by coalesce(r.starts_at, r.starts_on::timestamp at time zone 'America/Santiago') desc, r.created_at desc;
end $$;
revoke all on function public.club_absences(date, date, text) from public, anon;
grant execute on function public.club_absences(date, date, text) to authenticated;

-- Quiénes no van a un evento y por qué: aviso, periodo, plantel o lesionado (informativo,
-- como event_availability). La nota solo con lista_pasar. Solo staff.
create function public.event_absences(p_event_id uuid)
returns table (player_id uuid, full_name text, kind text, reason text, note text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_club uuid := private.current_club_id();
  v_notes boolean;
  e record;
begin
  if v_club is null or not private.is_staff(v_club) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select ev.id, ev.format into e from public.events ev where ev.id = p_event_id and ev.club_id = v_club;
  if not found then raise exception 'not_found'; end if;
  v_notes := private.has_perm(v_club, 'lista_pasar');

  return query
  with av as (
    select p.id as pid, p.full_name as pname, ab.source, ab.reason,
           (select a.note from public.absences a
             where a.club_id = v_club and a.scope = 'evento' and a.event_id = p_event_id
               and a.player_id = p.id and a.ended_at is null) as nt
      from public.players p
      cross join lateral private.event_absence(v_club, p.id, p_event_id) ab
     where p.club_id = v_club and p.status = 'confirmado' and p.active
       and private.in_format(v_club, p.user_id, e.format)),
  inj as (
    select ea.player_id as pid, ea.full_name as pname
      from public.event_availability(p_event_id) ea where ea.state = 'no')
  select av.pid, av.pname, av.source, av.reason, case when v_notes then av.nt end from av
  union all
  select inj.pid, inj.pname, 'lesionado', null::text, null::text from inj
   where not exists (select 1 from av where av.pid = inj.pid)
  order by 2;
end $$;
revoke all on function public.event_absences(uuid) from public, anon;
grant execute on function public.event_absences(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Con aviso no hay sRPE ni bienestar por responder (misma firma que antes)
-- ---------------------------------------------------------------------------
create or replace function public.my_pending_reports(p_format text default '15')
returns table (kind text, event_id uuid, event_type text, starts_at timestamptz, ends_at timestamptz,
               opponent text, location text, minutes integer, estimated boolean, report_date date)
language plpgsql stable security definer set search_path = '' as $$
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
     and not exists (select 1 from private.event_absence(v_club, v_player, e.id))
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
  if v_date is not null
     and not private.period_absence_on(v_club, v_player, v_date)
     and not exists (
       select 1 from public.wellness_reports w
        where w.club_id = v_club and w.player_id = v_player and w.report_date = v_date) then
    return query select 'wellness'::text, null::uuid, null::text, null::timestamptz, null::timestamptz,
                        null::text, null::text, null::int, null::boolean, v_date;
  end if;
end $$;

-- Resumen de un evento: los avisados no cuentan como "sin responder" (salen en 'avisados').
create or replace function public.event_rpe_summary(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_club uuid := private.current_club_id();
  e      record;
  v_out  jsonb;
begin
  if v_club is null or not private.has_perm(v_club, 'carga_ver') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select ev.id, ev.type, ev.starts_at, ev.ends_at, ev.format, ev.opponent, ev.cancelled_at into e
    from public.events ev where ev.id = p_event_id and ev.club_id = v_club;
  if not found then raise exception 'not_found'; end if;

  with roster as (
    select p.id, p.full_name from public.players p
     where e.type = 'entrenamiento' and p.club_id = v_club and p.status = 'confirmado' and p.active
       and private.in_format(v_club, p.user_id, e.format)
       and not exists (select 1 from public.event_attendance a
                        where a.event_id = e.id and a.player_id = p.id and not a.present)
    union
    select p.id, p.full_name from public.event_callups cu
      join public.players p on p.id = cu.player_id and p.club_id = cu.club_id
     where e.type = 'competencia' and cu.event_id = e.id and cu.removed_at is null
       and p.status = 'confirmado' and p.active),
  x as (
    select ro.id, ro.full_name, r.rpe, r.absent, r.event_id is not null as answered, m.minutes, m.estimated,
           (r.event_id is null and exists (select 1 from private.event_absence(v_club, ro.id, e.id))) as avisado
      from roster ro
      left join public.session_rpe r on r.event_id = e.id and r.player_id = ro.id
      left join lateral private.session_minutes(e.id, ro.id) m on r.event_id is not null and not r.absent)
  select jsonb_build_object(
    'event_id', e.id, 'type', e.type, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
    'format', e.format, 'opponent', e.opponent, 'cancelled', e.cancelled_at is not null,
    'expected', count(*) filter (where not x.avisado),
    'responded', count(*) filter (where x.answered),
    'avg_rpe', round(avg(x.rpe) filter (where x.answered and not x.absent), 1),
    'avg_load', round(avg(x.rpe * x.minutes) filter (where x.answered and not x.absent)),
    'estimated', coalesce(bool_or(x.estimated) filter (where x.answered and not x.absent), false),
    'responses', coalesce(jsonb_agg(jsonb_build_object('player_id', x.id, 'full_name', x.full_name,
                    'rpe', x.rpe, 'minutes', x.minutes, 'estimated', x.estimated, 'load', x.rpe * x.minutes)
                    order by x.rpe * x.minutes desc, x.full_name) filter (where x.answered and not x.absent), '[]'),
    'missing', coalesce(jsonb_agg(jsonb_build_object('player_id', x.id, 'full_name', x.full_name)
                    order by x.full_name) filter (where not x.answered and not x.avisado), '[]'),
    'avisados', coalesce(jsonb_agg(jsonb_build_object('player_id', x.id, 'full_name', x.full_name)
                    order by x.full_name) filter (where x.avisado), '[]'),
    'absent', coalesce(jsonb_agg(jsonb_build_object('player_id', x.id, 'full_name', x.full_name)
                    order by x.full_name) filter (where x.answered and x.absent), '[]'))
    into v_out
    from x;
  return v_out;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Descartes automáticos de "N jugadores avisaron": al cancelar el evento o guardar la lista
-- ---------------------------------------------------------------------------
create or replace function public.cancel_event(p_event_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
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
  perform private.dismiss_notification_keys(v_club, array['ausencias-evento:' || p_event_id]);
end $$;

create or replace function public.set_event_attendance(p_event_id uuid, p_absent uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_club uuid := private.current_club_id();
  v_absent uuid[] := coalesce(p_absent, '{}');
  v_format text;
  v_roster uuid[];
begin
  if v_club is null or not private.has_perm(v_club, 'lista_pasar') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform 1 from public.events e where e.id = p_event_id and e.club_id = v_club;
  if not found then raise exception 'not_found'; end if;
  perform 1 from public.events e
   where e.id = p_event_id and e.type = 'entrenamiento' and e.cancelled_at is null;
  if not found then raise exception 'Solo se pasa lista en entrenamientos no cancelados'; end if;
  perform 1 from public.events e where e.id = p_event_id and e.starts_at <= now();
  if not found then raise exception 'El entrenamiento todavía no empieza'; end if;
  select coalesce(e.format, '15') into v_format from public.events e where e.id = p_event_id;

  v_roster := array(
    select p.id from public.players p
     where p.club_id = v_club and p.active and p.status = 'confirmado'
       and (v_format <> '7' or exists (
             select 1 from public.sevens_group g
              where g.club_id = v_club and g.member_id = p.user_id and g.archived_at is null)));

  if exists (
    select 1 from unnest(v_absent) u(id) where not (u.id = any (v_roster))
  ) then raise exception 'Jugador inválido'; end if;

  insert into public.event_attendance (event_id, player_id, club_id, present, recorded_by, recorded_at)
  select p_event_id, r.id, v_club, not (r.id = any (v_absent)), (select auth.uid()), now()
    from unnest(v_roster) r(id)
  on conflict (event_id, player_id) do update
    set present = excluded.present, recorded_by = excluded.recorded_by, recorded_at = excluded.recorded_at;

  perform private.dismiss_notification_keys(v_club, array['ausencias-evento:' || p_event_id]);
end $$;
