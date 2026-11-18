-- Recov · Test de ausencias avisadas (20261110120000)
-- Autónomo: crea sus propios datos y termina en ROLLBACK. Si algo falla, lanza un error que empieza con "FAIL".

begin;

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end $$;
create function pg_temp.back() returns void language plpgsql as $$
begin execute 'reset role'; end $$;
create function pg_temp.expect_count(q text, expected int, label text) returns void language plpgsql as $$
declare n int;
begin
  execute 'select count(*) from (' || q || ') s' into n;
  if n <> expected then raise exception 'FAIL: % (esperado %, hay %)', label, expected, n; end if;
end $$;
create function pg_temp.expect_fail(q text, label text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then return; end;
  raise exception 'FAIL: % (debía fallar y no falló)', label;
end $$;
create function pg_temp.expect_ok(q text, label text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then raise exception 'FAIL: % (debía funcionar y falló: %)', label, sqlerrm; end;
end $$;
create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FAIL: %', label; end if; end $$;
create function pg_temp.n(u uuid, k text) returns int language sql as $$
  select count(*)::int from public.notifications where user_id = u and kind = k and dismissed_at is null $$;
create function pg_temp.p(u uuid, k text) returns jsonb language sql as $$
  select payload from public.notifications where user_id = u and kind = k and dismissed_at is null
   order by created_at desc limit 1 $$;

-- Datos -------------------------------------------------------------------
insert into public.clubs (id, name, sport, slug) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'Club A', 'rugby',  'club-a-abs'),
  ('bbbbbbbb-0000-0000-0000-0000000000a2', 'Club B', 'hockey', 'club-b-abs');
update public.clubs set has_sevens = true, wellness_days = '{1,2,3,4,5,6,7}'
 where id = 'aaaaaaaa-0000-0000-0000-0000000000a1';

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-0000000000a1', 'hc-a@abs.test'),
  ('20000000-0000-0000-0000-0000000000a1', 'manager-a@abs.test'),
  ('30000000-0000-0000-0000-0000000000a1', 'kine-a@abs.test'),
  ('40000000-0000-0000-0000-0000000000a1', 'coach-a@abs.test'),
  ('60000000-0000-0000-0000-0000000000a1', 'j1@abs.test'),
  ('61000000-0000-0000-0000-0000000000a1', 'j2@abs.test'),
  ('10000000-0000-0000-0000-0000000000a2', 'hc-b@abs.test'),
  ('60000000-0000-0000-0000-0000000000a2', 'jb@abs.test');
with v(id, club_id, roles, full_name) as (values
  ('10000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000a1', '{head_coach}',  'HC A'),
  ('20000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000a1', '{manager}',     'Manager A'),
  ('30000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000a1', '{kinesiologo}', 'Kine A'),
  ('40000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000a1', '{entrenador}',  'Entrenador A'),
  ('60000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000a1', '{jugador}',     'Jugador A1'),
  ('61000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000a1', '{jugador}',     'Jugador A2'),
  ('10000000-0000-0000-0000-0000000000a2', 'bbbbbbbb-0000-0000-0000-0000000000a2', '{head_coach}',  'HC B'),
  ('60000000-0000-0000-0000-0000000000a2', 'bbbbbbbb-0000-0000-0000-0000000000a2', '{jugador}',     'Jugador B')),
     p as (insert into public.profiles (id, full_name) select id::uuid, full_name from v)
insert into public.club_members (user_id, club_id, roles, status)
select id::uuid, club_id::uuid, roles::public.user_role[], 'confirmado' from v;

insert into public.players (id, club_id, full_name, position, status, availability, user_id) values
  ('c1000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'Jugador A1', 'Pilar',  'confirmado', 'disponible', '60000000-0000-0000-0000-0000000000a1'),
  ('c1000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'Jugador A2', 'Hooker', 'confirmado', 'disponible', '61000000-0000-0000-0000-0000000000a1'),
  ('c2000000-0000-0000-0000-0000000000a1', 'bbbbbbbb-0000-0000-0000-0000000000a2', 'Jugador B',  'Portero','confirmado', 'disponible', '60000000-0000-0000-0000-0000000000a2');
insert into public.sevens_group (club_id, member_id)
values ('aaaaaaaa-0000-0000-0000-0000000000a1', '61000000-0000-0000-0000-0000000000a1');

-- Eventos futuros (staff) y uno Sevens.
select pg_temp.as_user('10000000-0000-0000-0000-0000000000a1');
select set_config('t.e1', e::text, true) from public.create_event('entrenamiento', now() + interval '2 days', now() + interval '2 days 1 hour') e;
select set_config('t.e2', e::text, true) from public.create_event('entrenamiento', now() + interval '3 days', now() + interval '3 days 1 hour') e;
select set_config('t.e7', e::text, true) from public.create_event('entrenamiento', now() + interval '4 days', now() + interval '4 days 1 hour', null, null, null, 1, '7') e;
select pg_temp.back();
-- Eventos pasados (directo): entrenamiento terminado hace 1 h y otro empezado hace 1 h sin lista.
insert into public.events (id, club_id, type, starts_at, ends_at, created_by, format) values
  ('e0000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'entrenamiento', now() - interval '2 hours', now() - interval '1 hour', '10000000-0000-0000-0000-0000000000a1', '15'),
  ('e0000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'entrenamiento', now() - interval '1 hour', now() + interval '1 hour', '10000000-0000-0000-0000-0000000000a1', '15');

-- =======================================================================
-- 1. Permisos
-- =======================================================================
select pg_temp.as_user('20000000-0000-0000-0000-0000000000a1');
select pg_temp.check(private.has_perm('aaaaaaaa-0000-0000-0000-0000000000a1', 'ausencias_declarar')
                     and private.has_perm('aaaaaaaa-0000-0000-0000-0000000000a1', 'paron_declarar'), 'manager: ausencias y parón');
select pg_temp.as_user('40000000-0000-0000-0000-0000000000a1');
select pg_temp.check(private.has_perm('aaaaaaaa-0000-0000-0000-0000000000a1', 'ausencias_declarar')
                     and not private.has_perm('aaaaaaaa-0000-0000-0000-0000000000a1', 'paron_declarar'), 'entrenador: ausencias sí, parón no');
select pg_temp.as_user('30000000-0000-0000-0000-0000000000a1');
select pg_temp.check(not private.has_perm('aaaaaaaa-0000-0000-0000-0000000000a1', 'ausencias_declarar'), 'kine: sin ausencias_declarar');
select pg_temp.as_user('10000000-0000-0000-0000-0000000000a1');
select pg_temp.check(private.has_perm('aaaaaaaa-0000-0000-0000-0000000000a1', 'paron_declarar'), 'head coach: todo');
select pg_temp.back();

-- =======================================================================
-- 2. Jugador avisa que no va a un evento
-- =======================================================================
select pg_temp.as_user('60000000-0000-0000-0000-0000000000a1');
-- Pasa a A2 como p_player: se ignora y queda a su nombre.
select set_config('t.abs1', public.declare_absence('c1000000-0000-0000-0000-0000000000a2', 'evento', current_setting('t.e1')::uuid, null, null, 'viaje_trabajo', 'Viajo por trabajo')::text, true);
select pg_temp.check((select player_id from public.absences where id = current_setting('t.abs1')::uuid) = 'c1000000-0000-0000-0000-0000000000a1', 'el jugador solo avisa por sí mismo (ignora p_player)');
select pg_temp.expect_fail($q$select public.declare_absence(null, 'evento', current_setting('t.e1')::uuid, null, null, 'otro')$q$, 'ya hay un aviso para el evento');
select pg_temp.expect_fail($q$select public.declare_absence(null, 'evento', 'e0000000-0000-0000-0000-0000000000a1', null, null, 'otro')$q$, 'evento ya empezado');
select pg_temp.expect_fail($q$select public.declare_absence(null, 'evento', current_setting('t.e7')::uuid, null, null, 'otro')$q$, 'evento Sevens: A1 no está en el grupo');
select pg_temp.expect_fail($q$select public.declare_absence(null, 'evento', current_setting('t.e2')::uuid, null, null, 'inventado')$q$, 'motivo inválido');
select pg_temp.expect_fail($q$select public.declare_absence(null, 'evento', current_setting('t.e2')::uuid, null, null, 'otro', repeat('x', 201))$q$, 'nota de más de 200');
select pg_temp.back();

select pg_temp.check(pg_temp.n('10000000-0000-0000-0000-0000000000a1', 'ausencias_evento') = 1
                     and pg_temp.n('40000000-0000-0000-0000-0000000000a1', 'ausencias_evento') = 1
                     and pg_temp.n('30000000-0000-0000-0000-0000000000a1', 'ausencias_evento') = 1, 'el staff con lista_pasar recibe "N avisaron"');
select pg_temp.check((pg_temp.p('10000000-0000-0000-0000-0000000000a1', 'ausencias_evento')->>'count') = '1', 'cuenta 1');
select pg_temp.check(pg_temp.n('60000000-0000-0000-0000-0000000000a1', 'ausencias_evento') = 0
                     and pg_temp.n('61000000-0000-0000-0000-0000000000a1', 'ausencias_evento') = 0, 'los jugadores no reciben el aviso del staff');
select pg_temp.check(pg_temp.n('10000000-0000-0000-0000-0000000000a2', 'ausencias_evento') = 0, 'el club B no recibe nada');

-- A2 también avisa: sigue siendo una sola notificación, con 2.
select pg_temp.as_user('61000000-0000-0000-0000-0000000000a1');
select set_config('t.abs2', public.declare_absence(null, 'evento', current_setting('t.e1')::uuid, null, null, 'estudios')::text, true);
select public.declare_absence(null, 'evento', current_setting('t.e7')::uuid, null, null, 'otro');
select pg_temp.back();
select pg_temp.check(pg_temp.n('10000000-0000-0000-0000-0000000000a1', 'ausencias_evento') = 2
                     and (select count(*) from public.notifications where user_id = '10000000-0000-0000-0000-0000000000a1'
                           and kind = 'ausencias_evento' and dismissed_at is null and payload->>'event_id' = current_setting('t.e1')) = 1, 'una sola viva por evento');
select pg_temp.check((select payload->>'count' from public.notifications where user_id = '10000000-0000-0000-0000-0000000000a1'
                       and kind = 'ausencias_evento' and dismissed_at is null and payload->>'event_id' = current_setting('t.e1')) = '2', 'cuenta 2');

-- =======================================================================
-- 3. Lectura: RLS, nota y funciones
-- =======================================================================
select pg_temp.as_user('61000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_count($q$select 1 from public.absences$q$, 2, 'A2 ve solo las suyas (2 eventos), no las de A1');
select pg_temp.expect_fail($q$select note from public.absences$q$, 'la nota no se lee directo');
select pg_temp.expect_fail($q$insert into public.absences (club_id, player_id, scope, event_id, reason, created_by) values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'c1000000-0000-0000-0000-0000000000a2', 'evento', current_setting('t.e2')::uuid, 'otro', auth.uid())$q$, 'sin escritura directa');
select pg_temp.expect_count($q$select 1 from public.my_absences()$q$, 2, 'my_absences de A2: sus 2 avisos');
select pg_temp.expect_fail($q$select * from public.club_absences()$q$, 'un jugador no usa club_absences');
select pg_temp.expect_fail($q$select * from public.event_absences(current_setting('t.e1')::uuid)$q$, 'un jugador no usa event_absences');
select pg_temp.as_user('60000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select note from public.my_absences() where event_id = current_setting('t.e1')::uuid) = 'Viajo por trabajo', 'A1 ve su propia nota');
select pg_temp.as_user('40000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select note from public.event_absences(current_setting('t.e1')::uuid) where kind = 'aviso' and full_name = 'Jugador A1') = 'Viajo por trabajo', 'staff con lista_pasar ve la nota');
select pg_temp.check((select count(*) from public.event_absences(current_setting('t.e1')::uuid) where kind = 'aviso') = 2, 'event_absences: 2 avisos');
select pg_temp.check((select count(*) from public.club_absences(null, null, 'vigente')) >= 3, 'club_absences vigentes');
select pg_temp.as_user('10000000-0000-0000-0000-0000000000a2');
select pg_temp.expect_count($q$select 1 from public.absences$q$, 0, 'el club B no ve avisos del A');
select pg_temp.expect_fail($q$select public.declare_absence('c1000000-0000-0000-0000-0000000000a1', 'evento', current_setting('t.e2')::uuid, null, null, 'otro')$q$, 'el club B no declara en el A');
select pg_temp.back();

-- =======================================================================
-- 4. Staff declara por un jugador
-- =======================================================================
select pg_temp.as_user('30000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_fail($q$select public.declare_absence('c1000000-0000-0000-0000-0000000000a1', 'evento', current_setting('t.e2')::uuid, null, null, 'otro')$q$, 'el kine no tiene ausencias_declarar');
select pg_temp.as_user('40000000-0000-0000-0000-0000000000a1');
select set_config('t.abs3', public.declare_absence('c1000000-0000-0000-0000-0000000000a1', 'evento', current_setting('t.e2')::uuid, null, null, 'salud', 'Control médico')::text, true);
select pg_temp.expect_fail($q$select public.declare_absence(null, 'periodo', null, current_date, current_date + 7, 'vacaciones')$q$, 'el entrenador no declara el plantel');
select public.declare_absence('c1000000-0000-0000-0000-0000000000a2', 'periodo', null, (now() at time zone 'America/Santiago')::date + 40, (now() at time zone 'America/Santiago')::date + 50, 'vacaciones');
select pg_temp.back();
select pg_temp.check(pg_temp.n('60000000-0000-0000-0000-0000000000a1', 'ausencia_registrada_por_staff') = 1, 'A1 recibe "tu staff registró una ausencia"');
select pg_temp.check(pg_temp.n('61000000-0000-0000-0000-0000000000a1', 'ausencia_registrada_por_staff') = 1, 'A2 recibe el de su período');
select pg_temp.check(pg_temp.n('40000000-0000-0000-0000-0000000000a1', 'ausencia_registrada_por_staff') = 0, 'quien declara no se avisa a sí mismo');
select pg_temp.check(pg_temp.n('10000000-0000-0000-0000-0000000000a1', 'ausencia_periodo') = 1
                     and (pg_temp.p('10000000-0000-0000-0000-0000000000a1', 'ausencia_periodo')->>'player_name') = 'Jugador A2', 'el staff recibe "ausente por vacaciones"');
select pg_temp.check(pg_temp.n('40000000-0000-0000-0000-0000000000a1', 'ausencia_periodo') = 0, 'el autor no recibe el aviso de período');
select pg_temp.check(not (pg_temp.p('10000000-0000-0000-0000-0000000000a1', 'ausencia_periodo') ? 'note'), 'la notificación no lleva la nota');

-- =======================================================================
-- 5. Parón del plantel
-- =======================================================================
select pg_temp.as_user('20000000-0000-0000-0000-0000000000a1');
select set_config('t.paron', public.declare_absence(null, 'periodo', null, (now() at time zone 'America/Santiago')::date + 60, (now() at time zone 'America/Santiago')::date + 70, 'vacaciones')::text, true);
select pg_temp.back();
select pg_temp.check(pg_temp.n('60000000-0000-0000-0000-0000000000a1', 'paron_plantel') = 1
                     and pg_temp.n('61000000-0000-0000-0000-0000000000a1', 'paron_plantel') = 1
                     and pg_temp.n('10000000-0000-0000-0000-0000000000a1', 'paron_plantel') = 1
                     and pg_temp.n('20000000-0000-0000-0000-0000000000a1', 'paron_plantel') = 0
                     and pg_temp.n('10000000-0000-0000-0000-0000000000a2', 'paron_plantel') = 0, 'parón: todos los confirmados del club, menos quien lo declara');
select pg_temp.as_user('60000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select count(*) from public.my_absences() where is_squad and note is null) = 1, 'el jugador ve el parón del plantel, sin nota');
select pg_temp.expect_fail(format($q$select public.end_absence(%L)$q$, current_setting('t.paron')), 'el jugador no quita el parón del plantel');
select pg_temp.expect_fail(format($q$select public.end_absence(%L)$q$, current_setting('t.abs2')), 'un jugador no quita el aviso de otro');
select pg_temp.as_user('40000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_fail(format($q$select public.end_absence(%L)$q$, current_setting('t.paron')), 'sin paron_declarar no se quita el parón');
select pg_temp.back();

-- =======================================================================
-- 6. Un aviso no escribe la asistencia, y deja de haber pendientes
-- =======================================================================
select pg_temp.check((select count(*) from public.event_attendance where club_id = 'aaaaaaaa-0000-0000-0000-0000000000a1') = 0, 'un aviso no escribe event_attendance');

-- Aviso (directo) del evento pasado de A1: sin sRPE por responder; A2 sí.
insert into public.absences (club_id, player_id, scope, event_id, reason, created_by)
values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'c1000000-0000-0000-0000-0000000000a1', 'evento',
        'e0000000-0000-0000-0000-0000000000a1', 'otro', '60000000-0000-0000-0000-0000000000a1');
select pg_temp.as_user('60000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select count(*) from public.my_pending_reports('15') where kind = 'session' and event_id = 'e0000000-0000-0000-0000-0000000000a1') = 0, 'con aviso no hay sRPE pendiente');
select pg_temp.check((select count(*) from public.my_pending_reports('15') where kind = 'session' and event_id = 'e0000000-0000-0000-0000-0000000000a2') = 1, 'sin aviso, el otro evento sí queda pendiente');
select pg_temp.as_user('61000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select count(*) from public.my_pending_reports('15') where kind = 'session' and event_id = 'e0000000-0000-0000-0000-0000000000a1') = 1, 'A2 sin aviso sí tiene sRPE pendiente');
select pg_temp.check((select count(*) from public.my_pending_reports('15') where kind = 'wellness') = 1, 'A2 tiene bienestar pendiente');
select pg_temp.as_user('40000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select (public.event_rpe_summary('e0000000-0000-0000-0000-0000000000a1')->>'expected')::int) = 1, 'el resumen no espera a los avisados');
select pg_temp.check(jsonb_array_length(public.event_rpe_summary('e0000000-0000-0000-0000-0000000000a1')->'missing') = 1
                     and jsonb_array_length(public.event_rpe_summary('e0000000-0000-0000-0000-0000000000a1')->'avisados') = 1, 'avisados fuera de "sin responder"');
select pg_temp.back();

-- Período propio de A1 que cubre hoy: sin bienestar por responder.
insert into public.absences (club_id, player_id, scope, starts_on, ends_on, reason, created_by)
values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'c1000000-0000-0000-0000-0000000000a1', 'periodo',
        (now() at time zone 'America/Santiago')::date - 1, null, 'vacaciones', '60000000-0000-0000-0000-0000000000a1');
select set_config('t.per', (select id::text from public.absences where scope = 'periodo' and player_id = 'c1000000-0000-0000-0000-0000000000a1'), true);
select pg_temp.as_user('60000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select count(*) from public.my_pending_reports('15') where kind = 'wellness') = 0, 'con período activo no hay bienestar pendiente');
select pg_temp.check((select count(*) from public.my_pending_reports('15') where kind = 'session') = 0, 'ni sRPE (el período cubre los eventos de hoy)');
-- "Ya volví": ends_on = hoy.
select public.end_absence(current_setting('t.per')::uuid, true);
select pg_temp.back();
select pg_temp.check((select ends_on from public.absences where id = current_setting('t.per')::uuid) = (now() at time zone 'America/Santiago')::date
                     and (select ended_at from public.absences where id = current_setting('t.per')::uuid) is null, '"Ya volví" cierra el período hoy');

-- =======================================================================
-- 7. Quitar avisos y descartes de la notificación
-- =======================================================================
select pg_temp.as_user('60000000-0000-0000-0000-0000000000a1');
select public.end_absence(current_setting('t.abs1')::uuid);
select pg_temp.back();
select pg_temp.check((pg_temp.p('10000000-0000-0000-0000-0000000000a1', 'ausencias_evento')->>'count') = '1'
                     or pg_temp.n('10000000-0000-0000-0000-0000000000a1', 'ausencias_evento') >= 1, 'al quitar uno, la cuenta baja');
select pg_temp.check((select count(*) from public.notifications where user_id = '10000000-0000-0000-0000-0000000000a1'
                       and kind = 'ausencias_evento' and dismissed_at is null and payload->>'event_id' = current_setting('t.e1')
                       and payload->>'count' = '1') = 1, 'la notificación del evento 1 queda con 1');
-- El staff con permiso quita el aviso de A2 en el evento 1: queda en 0 y se descarta.
select pg_temp.as_user('40000000-0000-0000-0000-0000000000a1');
select public.end_absence(current_setting('t.abs2')::uuid);
select pg_temp.back();
select pg_temp.check((select count(*) from public.notifications where kind = 'ausencias_evento' and dismissed_at is null
                       and payload->>'event_id' = current_setting('t.e1')) = 0, 'con 0 avisos se descarta la notificación');
select pg_temp.check((select count(*) from public.notifications where kind = 'ausencias_evento' and dismissed_at is null
                       and user_id = '10000000-0000-0000-0000-0000000000a1' and payload->>'event_id' = current_setting('t.e7')) = 1, 'queda la del evento Sevens');

-- Cancelar el evento descarta la suya.
select pg_temp.as_user('10000000-0000-0000-0000-0000000000a1');
select public.cancel_event(current_setting('t.e7')::uuid);
select pg_temp.back();
select pg_temp.check((select count(*) from public.notifications where kind = 'ausencias_evento' and dismissed_at is null
                       and payload->>'event_id' = current_setting('t.e7')) = 0, 'al cancelar el evento se descarta');

-- Guardar la asistencia descarta la del evento (entrenamiento ya empezado).
insert into public.absences (club_id, player_id, scope, event_id, reason, created_by)
values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'c1000000-0000-0000-0000-0000000000a2', 'evento',
        'e0000000-0000-0000-0000-0000000000a2', 'otro', '61000000-0000-0000-0000-0000000000a1');
select private.notify_perm('aaaaaaaa-0000-0000-0000-0000000000a1', 'lista_pasar', 'ausencias_evento',
  jsonb_build_object('event_id', 'e0000000-0000-0000-0000-0000000000a2', 'count', 1), 'ausencias-evento:e0000000-0000-0000-0000-0000000000a2');
select pg_temp.check((select count(*) from public.notifications where kind = 'ausencias_evento' and dismissed_at is null
                       and payload->>'event_id' = 'e0000000-0000-0000-0000-0000000000a2') > 0, 'preparado: notificación viva del evento en curso');
select pg_temp.as_user('40000000-0000-0000-0000-0000000000a1');
select public.set_event_attendance('e0000000-0000-0000-0000-0000000000a2', array['c1000000-0000-0000-0000-0000000000a2']::uuid[]);
select pg_temp.back();
select pg_temp.check((select count(*) from public.notifications where kind = 'ausencias_evento' and dismissed_at is null
                       and payload->>'event_id' = 'e0000000-0000-0000-0000-0000000000a2') = 0, 'al guardar la asistencia se descarta');

-- =======================================================================
-- 8. Anon y categoría
-- =======================================================================
select pg_temp.as_anon();
select pg_temp.expect_fail($q$select public.declare_absence(null, 'evento', current_setting('t.e2')::uuid, null, null, 'otro')$q$, 'anon no declara');
select pg_temp.expect_fail($q$select * from public.my_absences()$q$, 'anon no lee my_absences');
select pg_temp.back();
select pg_temp.check((select category from public.notifications where kind = 'paron_plantel' limit 1) = 'calendario', 'categoría calendario');

rollback;
