-- Recov · Notificaciones del Resumen (1 de 2): tabla, creación, descarte y las de estado.
-- De evento: se guardan en public.notifications (una fila por persona) y se quedan hasta
-- descartarlas. Las crea solo private.notify*, llamada desde las funciones existentes
-- (migración 2). De estado: se calculan al leer (my_state_notifications y
-- my_staff_state_notifications) y no se guarda nada.

-- Tipo → categoría. NULL = tipo inválido (lo usa el check de la tabla).
create function private.notification_category(p_kind text)
returns text language sql immutable set search_path = '' as $$
  select case p_kind
    when 'evento_cancelado'     then 'calendario'  -- 1
    when 'evento_nuevo'         then 'calendario'  -- 2
    when 'evento_modificado'    then 'calendario'  -- 3
    when 'convocado'            then 'nomina'      -- 4
    when 'quitado_nomina'       then 'nomina'      -- 5
    when 'lesion_confirmada'    then 'lesion'      -- 6
    when 'lesion_descartada'    then 'lesion'      -- 7
    when 'fase_cambio'          then 'lesion'      -- 8
    when 'alta'                 then 'lesion'      -- 9
    when 'disponibilidad'       then 'lesion'      -- 10
    when 'marcado_lesionado'    then 'lesion'      -- 11
    when 'plan_gimnasio'        then 'gimnasio'    -- 12 (payload.change = nuevo | modificado)
    when 'evaluacion_resultado' then 'evaluacion'  -- 13
    when 'registro_aprobado'    then 'cuenta'      -- 14
    when 'roles_cambio'         then 'cuenta'      -- 15
    when 'sevens_agregado'      then 'sevens'      -- 16
    when 'posicion_cambio'      then 'cuenta'      -- 17
    when 'registro_pendiente'   then 'registros'   -- 20
    when 'lesion_por_revisar'   then 'lesion'      -- 21
    when 'documento_subido'     then 'lesion'      -- 22
    when 'funcion_asignada'     then 'cuenta'      -- 23
  end
$$;
revoke all on function private.notification_category(text) from public;

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (private.notification_category(kind) is not null),
  category     text generated always as (private.notification_category(kind)) stored,
  payload      jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at   timestamptz not null default now(),
  dismissed_at timestamptz,
  dedupe_key   text check (dedupe_key is null or length(dedupe_key) between 1 and 200)
);

-- Una sola notificación viva por clave y persona: lo que llega después la actualiza.
create unique index notifications_dedupe_idx on public.notifications (club_id, user_id, dedupe_key)
  where dismissed_at is null and dedupe_key is not null;
-- Bandeja de cada persona.
create index notifications_inbox_idx on public.notifications (user_id, club_id, created_at desc)
  where dismissed_at is null;
-- Descarte por clave para todos (registros y lesiones por revisar).
create index notifications_club_key_idx on public.notifications (club_id, dedupe_key)
  where dismissed_at is null and dedupe_key is not null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon;
revoke insert, update, delete, truncate on public.notifications from authenticated;

-- Cada uno lee solo las suyas, y solo de planteles donde sigue confirmado.
create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()) and private.is_confirmed_member(club_id));

-- Crea (o actualiza por dedupe_key) una notificación. No avisa a quien hace la acción ni a
-- quien no es miembro confirmado del plantel. "Nuevo" seguido de "modificado" sigue siendo
-- "nuevo" (con los datos al día).
create function private.notify(p_club uuid, p_user uuid, p_kind text,
                               p_payload jsonb default '{}'::jsonb, p_dedupe text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_club is null or p_user is null or p_user = (select auth.uid()) then return; end if;
  if not exists (select 1 from public.club_members m
                  where m.club_id = p_club and m.user_id = p_user and m.status = 'confirmado') then
    return;
  end if;

  if p_dedupe is null then
    insert into public.notifications (club_id, user_id, kind, payload)
    values (p_club, p_user, p_kind, coalesce(p_payload, '{}'::jsonb));
  else
    insert into public.notifications (club_id, user_id, kind, payload, dedupe_key)
    values (p_club, p_user, p_kind, coalesce(p_payload, '{}'::jsonb), p_dedupe)
    on conflict (club_id, user_id, dedupe_key) where dismissed_at is null and dedupe_key is not null
    do update set
      kind = case when public.notifications.kind = 'evento_nuevo' and excluded.kind = 'evento_modificado'
                  then 'evento_nuevo' else excluded.kind end,
      payload = excluded.payload,
      created_at = now();
  end if;
end $$;
revoke all on function private.notify(uuid, uuid, text, jsonb, text) from public;

-- A las cuentas de estos jugadores (confirmados y con cuenta; un jugador sin cuenta no recibe nada).
create function private.notify_players(p_club uuid, p_players uuid[], p_kind text,
                                       p_payload jsonb default '{}'::jsonb, p_dedupe text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in
    select p.user_id from public.players p
     where p.club_id = p_club and p.id = any (coalesce(p_players, '{}'))
       and p.user_id is not null and p.status = 'confirmado'
  loop
    perform private.notify(p_club, r.user_id, p_kind, p_payload, p_dedupe);
  end loop;
end $$;
revoke all on function private.notify_players(uuid, uuid[], text, jsonb, text) from public;

-- A todo el staff confirmado que tenga el permiso.
create function private.notify_perm(p_club uuid, p_perm text, p_kind text,
                                    p_payload jsonb default '{}'::jsonb, p_dedupe text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in
    select m.user_id from public.club_members m
     where m.club_id = p_club and m.status = 'confirmado'
       and private.member_has_perm(p_club, m.user_id, p_perm)
  loop
    perform private.notify(p_club, r.user_id, p_kind, p_payload, p_dedupe);
  end loop;
end $$;
revoke all on function private.notify_perm(uuid, text, text, jsonb, text) from public;

-- El sistema descarta, para todos, las notificaciones con estas claves (cuando dejan de tener sentido).
create function private.dismiss_notification_keys(p_club uuid, p_keys text[])
returns void language sql security definer set search_path = '' as $$
  update public.notifications set dismissed_at = now()
   where club_id = p_club and dismissed_at is null and dedupe_key = any (coalesce(p_keys, '{}'))
$$;
revoke all on function private.dismiss_notification_keys(uuid, text[]) from public;

-- Descartar una notificación propia.
create function public.dismiss_notification(p_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.notifications n set dismissed_at = now()
   where n.id = p_id and n.user_id = (select auth.uid()) and n.dismissed_at is null
     and private.is_confirmed_member(n.club_id)
$$;
revoke all on function public.dismiss_notification(uuid) from public, anon;
grant execute on function public.dismiss_notification(uuid) to authenticated;

-- Descartar todas las propias del plantel activo.
create function public.dismiss_all_notifications()
returns void language sql security definer set search_path = '' as $$
  update public.notifications n set dismissed_at = now()
   where n.club_id = private.current_club_id() and n.user_id = (select auth.uid())
     and n.dismissed_at is null and private.is_confirmed_member(n.club_id)
$$;
revoke all on function public.dismiss_all_notifications() from public, anon;
grant execute on function public.dismiss_all_notifications() to authenticated;

-- Jugador, de estado (18, 19 y el esfuerzo del gimnasio): lo mismo que my_pending_reports
-- con su vencimiento. sRPE: término + 48 h; gimnasio: fin del 2.º día después de la sesión;
-- bienestar: fin del día siguiente al que toca (hora de Chile). urgent = vence en menos de 12 h.
create function public.my_state_notifications(p_format text default '15')
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
      from public.my_pending_reports(p_format) r)
  select d.kind, d.event_id, d.event_type, d.starts_at, d.ends_at, d.opponent, d.location,
         d.minutes, d.estimated, d.report_date, d.dl, d.dl - now() < interval '12 hours'
    from d
   order by d.dl
$$;
revoke all on function public.my_state_notifications(text) from public, anon;
grant execute on function public.my_state_notifications(text) to authenticated;

-- Staff, de estado (24 a 29), cada una con su permiso y en el formato activo (el gimnasio
-- no tiene formato). Nada se guarda.
--   carga_alta / bienestar_bajo (carga_ver): team_srpe_load y wellness_flags.
--   sin_lista (lista_pasar): entrenamiento empezado en los últimos 7 días sin lista.
--   sin_nomina (nomina_armar): partido en los próximos 7 días sin convocados.
--   sin_participacion (participacion_cargar): partido empezado en los últimos 7 días con
--     convocados y sin participación cargada.
--   alta_estimada (lesiones_revisar): lesión activa revisada con alta estimada en 3 días
--     o menos, o vencida (payload.vencida).
--   plan_sin_test (gimnasio_planes): plan publicado vigente con ejercicios en % del máximo
--     y jugadores sin resultado de ese test.
create function public.my_staff_state_notifications(p_format text default '15')
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
revoke all on function public.my_staff_state_notifications(text) from public, anon;
grant execute on function public.my_staff_state_notifications(text) to authenticated;
