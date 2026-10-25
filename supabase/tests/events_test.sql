-- Recov · Test del calendario de eventos (migración 0022)
-- Correr DESPUÉS de las migraciones 0001 a 0022. Autónomo: crea sus propios datos y termina en ROLLBACK.
-- Si algo falla, lanza un error que empieza con "FAIL".

begin;

-- Utilidades de prueba (viven solo durante esta sesión) -----------------
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
begin
  execute 'reset role';
end $$;

-- la consulta debe devolver exactamente N filas
create function pg_temp.expect_count(q text, expected int, label text) returns void language plpgsql as $$
declare n int;
begin
  execute 'select count(*) from (' || q || ') s' into n;
  if n <> expected then raise exception 'FAIL: % (esperado %, hay %)', label, expected, n; end if;
end $$;

-- la sentencia debe fallar (por RLS, por permisos o por validación)
create function pg_temp.expect_fail(q text, label text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    return;
  end;
  raise exception 'FAIL: % (debía fallar y no falló)', label;
end $$;

-- la sentencia debe fallar con exactamente este mensaje
create function pg_temp.expect_error(q text, msg text, label text) returns void language plpgsql as $$
declare got text;
begin
  begin
    execute q;
  exception when others then
    got := sqlerrm;
  end;
  if got is null then raise exception 'FAIL: % (debía fallar con "%" y no falló)', label, msg; end if;
  if got <> msg then raise exception 'FAIL: % (esperado "%", llegó "%")', label, msg, got; end if;
end $$;

-- la sentencia debe funcionar
create function pg_temp.expect_ok(q text, label text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    raise exception 'FAIL: % (debía funcionar y falló: %)', label, sqlerrm;
  end;
end $$;

-- Datos de prueba (como postgres) ---------------------------------------
-- Club A (rugby) y Club B (hockey)
insert into public.clubs (id, name, sport, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Club A', 'rugby',  'club-a'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Club B', 'hockey', 'club-b');

-- Primer dígito = rol (como en rls_isolation_test); 55… = preparador físico.
insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-00000000000a', 'hc-a@test.cl'),
  ('20000000-0000-0000-0000-00000000000a', 'manager-a@test.cl'),
  ('30000000-0000-0000-0000-00000000000a', 'kine-a@test.cl'),
  ('40000000-0000-0000-0000-00000000000a', 'coach-a@test.cl'),
  ('50000000-0000-0000-0000-00000000000a', 'nutri-a@test.cl'),
  ('55000000-0000-0000-0000-00000000000a', 'pf-a@test.cl'),
  ('60000000-0000-0000-0000-00000000000a', 'jugador-a1@test.cl'),
  ('80000000-0000-0000-0000-00000000000a', 'staff-pendiente-a@test.cl'),
  ('10000000-0000-0000-0000-00000000000b', 'hc-b@test.cl'),
  ('30000000-0000-0000-0000-00000000000b', 'kine-b@test.cl');

-- Desde 0043 profiles es solo identidad: el plantel, los roles y el estado van a club_members (preparación).
with v(id, club_id, roles, full_name, status) as (values
  ('10000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{head_coach}',        'Head Coach A',    'confirmado'),
  ('20000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{manager}',           'Manager A',       'confirmado'),
  ('30000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{kinesiologo}',       'Kine A',          'confirmado'),
  ('40000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{entrenador}',        'Entrenador A',    'confirmado'),
  ('50000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{nutricionista}',     'Nutri A',         'confirmado'),
  ('55000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{preparador_fisico}', 'PF A',            'confirmado'),
  ('60000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{jugador}',           'Jugador A1',      'confirmado'),
  ('80000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{entrenador}',        'Entrenador Pend', 'pendiente'),
  ('10000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', '{head_coach}',        'Head Coach B',    'confirmado'),
  ('30000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', '{kinesiologo}',       'Kine B',          'confirmado')),
     p as (insert into public.profiles (id, full_name) select id::uuid, full_name from v)
insert into public.club_members (user_id, club_id, roles, status)
select id::uuid, club_id::uuid, roles::public.user_role[], status::public.member_status from v;

-- Día de hoy en Chile: base de las fechas relativas.
create temp table d as select (now() at time zone 'America/Santiago')::date as today;

-- Jugadores del club A para la proyección (los inserts dejan su fila inicial de historial "ahora").
insert into public.players (id, club_id, full_name, position, status, availability) values
  ('a1000000-1111-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'P1 Alta d+3',    'Pilar',   'confirmado', 'lesionado'),
  ('a1000000-1111-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'P2 Vencida',     'Hooker',  'confirmado', 'lesionado'),
  ('a1000000-1111-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'P3 Evaluación',  'Flanker', 'confirmado', 'en_revision'),
  ('a1000000-1111-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'P4 Manual',      'Octavo',  'confirmado', 'lesionado'),
  ('a1000000-1111-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'P5 Disponible',  'Centro',  'confirmado', 'disponible'),
  ('b1000000-1111-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Jugador B1',     'Portero', 'confirmado', 'disponible');

-- P1: alta estimada en d+3. P2: alta vencida (d-2). P3: en evaluación sin fecha. P4 y P5: sin lesiones.
insert into public.injuries (club_id, player_id, type, severity, status, started_on, expected_return_on)
select 'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'a1000000-1111-0000-0000-000000000001'::uuid, 'Desgarro', 'moderada'::public.injury_severity, 'activa'::public.injury_status, d.today - 10, d.today + 3 from d
union all
select 'aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000002', 'Esguince', 'leve', 'activa', d.today - 20, d.today - 2 from d
union all
select 'aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000003', 'Golpe', null, 'en_evaluacion', d.today, null from d;

-- P5 estuvo lesionado hace 10 días (para el evento pasado: manda el historial, no el estado actual).
insert into public.availability_log (club_id, player_id, from_status, to_status, changed_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000005', null, 'lesionado', now() - interval '10 days');

-- Eventos del club A (d+1, d+3, d+4, d+20 y uno de hace 5 días) y uno del club B.
insert into public.events (id, club_id, type, starts_at, ends_at, created_by)
select 'e0000000-0000-0000-0000-000000000001'::uuid, 'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'entrenamiento',
       ((d.today + 1) + time '19:00') at time zone 'America/Santiago', ((d.today + 1) + time '20:30') at time zone 'America/Santiago',
       '10000000-0000-0000-0000-00000000000a'::uuid from d
union all
select 'e0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'entrenamiento',
       ((d.today + 3) + time '19:00') at time zone 'America/Santiago', ((d.today + 3) + time '20:30') at time zone 'America/Santiago',
       '10000000-0000-0000-0000-00000000000a' from d
union all
select 'e0000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'competencia',
       ((d.today + 4) + time '15:00') at time zone 'America/Santiago', ((d.today + 4) + time '17:00') at time zone 'America/Santiago',
       '10000000-0000-0000-0000-00000000000a' from d
union all
select 'e0000000-0000-0000-0000-000000000020', 'aaaaaaaa-0000-0000-0000-000000000001', 'entrenamiento',
       ((d.today + 20) + time '19:00') at time zone 'America/Santiago', ((d.today + 20) + time '20:30') at time zone 'America/Santiago',
       '10000000-0000-0000-0000-00000000000a' from d
union all
select 'e0000000-0000-0000-0000-0000000000a5', 'aaaaaaaa-0000-0000-0000-000000000001', 'entrenamiento',
       now() - interval '5 days', now() - interval '5 days' + interval '90 minutes',
       '10000000-0000-0000-0000-00000000000a' from d
union all
select 'e0000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000002', 'entrenamiento',
       ((d.today + 1) + time '19:00') at time zone 'America/Santiago', ((d.today + 1) + time '20:30') at time zone 'America/Santiago',
       '10000000-0000-0000-0000-00000000000b' from d;

-- =======================================================================
-- 1. Quién ve los eventos y aislamiento entre clubes
-- =======================================================================
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');   -- head coach A
select pg_temp.expect_count($q$select 1 from public.events$q$, 5, 'head coach A ve los 5 eventos de su club');
select pg_temp.expect_count($q$select 1 from public.events where club_id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$, 0, 'head coach A no ve eventos del club B');
select pg_temp.expect_error($q$select public.update_event('e0000000-0000-0000-0000-0000000000b1', now() + interval '1 day', now() + interval '1 day 1 hour')$q$,
  'not_found', 'head coach A edita un evento del club B');
select pg_temp.expect_error($q$select public.cancel_event('e0000000-0000-0000-0000-0000000000b1')$q$,
  'not_found', 'head coach A anula un evento del club B');
select pg_temp.back();

select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');   -- kine A
select pg_temp.expect_count($q$select 1 from public.events$q$, 5, 'kine A ve los eventos de su club');
select pg_temp.expect_error($q$select * from public.event_availability('e0000000-0000-0000-0000-0000000000b1')$q$,
  'not_found', 'kine A pide la disponibilidad de un evento del club B');
select pg_temp.back();

select pg_temp.as_user('30000000-0000-0000-0000-00000000000b');   -- kine B
select pg_temp.expect_count($q$select 1 from public.events$q$, 1, 'kine B ve solo el evento de su club');
select pg_temp.back();

select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');   -- jugador A1
select pg_temp.expect_count($q$select 1 from public.events$q$, 5, 'el jugador ve los eventos de su club');
select pg_temp.expect_error($q$select * from public.event_availability('e0000000-0000-0000-0000-000000000001')$q$,
  'forbidden', 'el jugador pide la disponibilidad por evento');
select pg_temp.back();

select pg_temp.as_user('80000000-0000-0000-0000-00000000000a');   -- entrenador pendiente
select pg_temp.expect_count($q$select 1 from public.events$q$, 0, 'un perfil pendiente no ve eventos');
select pg_temp.back();

select pg_temp.as_anon();
select pg_temp.expect_fail($q$select 1 from public.events$q$, 'anónimo lee eventos');
select pg_temp.expect_fail($q$select * from public.create_event('entrenamiento', now() + interval '1 day', now() + interval '1 day 1 hour')$q$,
  'anónimo crea un evento');
select pg_temp.back();

-- =======================================================================
-- 2. Disponibilidad proyectada (eventos futuros)
-- =======================================================================
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');   -- kine A (staff)
-- Evento en d+1
select pg_temp.expect_count($q$select 1 from public.event_availability('e0000000-0000-0000-0000-000000000001')$q$, 5, 'd+1: un estado por jugador del club A');
select pg_temp.expect_count($q$select 1 from public.event_availability('e0000000-0000-0000-0000-000000000001')
  where (full_name, state) in (('P1 Alta d+3', 'no'), ('P2 Vencida', 'duda'), ('P3 Evaluación', 'duda'),
                               ('P4 Manual', 'no'), ('P5 Disponible', 'ok'))$q$, 5,
  'd+1: alta en d+3 → no; vencida → duda; en evaluación sin fecha → duda; lesionado manual → no; disponible → ok');
-- Alta en d+3: el mismo día queda en duda y el día siguiente ok
select pg_temp.expect_count($q$select 1 from public.event_availability('e0000000-0000-0000-0000-000000000003')
  where full_name = 'P1 Alta d+3' and state = 'duda'$q$, 1, 'd+3 (día del alta): duda');
select pg_temp.expect_count($q$select 1 from public.event_availability('e0000000-0000-0000-0000-000000000004')
  where full_name = 'P1 Alta d+3' and state = 'ok'$q$, 1, 'd+4 (después del alta): ok');
select pg_temp.expect_count($q$select 1 from public.event_availability('e0000000-0000-0000-0000-000000000004')
  where full_name = 'P2 Vencida' and state = 'duda'$q$, 1, 'alta vencida sigue en duda');
-- Lesionado manual sin lesión: no dentro de 14 días, duda más allá
select pg_temp.expect_count($q$select 1 from public.event_availability('e0000000-0000-0000-0000-000000000020')
  where full_name = 'P4 Manual' and state = 'duda'$q$, 1, 'lesionado manual a más de 14 días: duda');
select pg_temp.expect_count($q$select 1 from public.event_availability('e0000000-0000-0000-0000-000000000020')
  where full_name = 'P1 Alta d+3' and state = 'ok'$q$, 1, 'd+20: el alta de P1 ya pasó');
select pg_temp.back();

-- El resultado nunca incluye fechas ni diagnóstico: solo jugador, nombre, posición y estado.
select pg_temp.expect_count($q$select 1 from pg_proc
  where oid = 'public.event_availability(uuid)'::regprocedure
    and pg_get_function_result(oid) = 'TABLE(player_id uuid, full_name text, player_position text, state text)'$q$, 1,
  'event_availability solo devuelve jugador, nombre, posición y estado');

-- =======================================================================
-- 3. Evento pasado: manda availability_log al momento de starts_at
-- =======================================================================
select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');   -- entrenador A (staff)
select pg_temp.expect_count($q$select 1 from public.event_availability('e0000000-0000-0000-0000-0000000000a5')$q$, 1,
  'evento pasado: solo los jugadores con registro previo');
select pg_temp.expect_count($q$select 1 from public.event_availability('e0000000-0000-0000-0000-0000000000a5')
  where full_name = 'P5 Disponible' and state = 'no'$q$, 1, 'evento pasado: P5 estaba lesionado (aunque hoy esté disponible)');
select pg_temp.back();

-- =======================================================================
-- 4. Permisos de escritura
-- =======================================================================
-- Sin permiso: kine, nutricionista, preparador físico, jugador y pendiente.
create function pg_temp.expect_forbidden(who text) returns void language plpgsql as $$
begin
  perform pg_temp.expect_error($q$select * from public.create_event('entrenamiento', now() + interval '2 days', now() + interval '2 days 1 hour')$q$,
    'forbidden', who || ' crea un evento');
  perform pg_temp.expect_error($q$select public.update_event('e0000000-0000-0000-0000-000000000020', now() + interval '21 days', now() + interval '21 days 1 hour')$q$,
    'forbidden', who || ' edita un evento');
  perform pg_temp.expect_error($q$select public.cancel_event('e0000000-0000-0000-0000-000000000020')$q$,
    'forbidden', who || ' anula un evento');
end $$;

select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_forbidden('kine A');
select pg_temp.back();
select pg_temp.as_user('50000000-0000-0000-0000-00000000000a');
select pg_temp.expect_forbidden('nutricionista A');
select pg_temp.back();
select pg_temp.as_user('55000000-0000-0000-0000-00000000000a');
select pg_temp.expect_forbidden('preparador físico A');
select pg_temp.back();
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
select pg_temp.expect_forbidden('jugador A1');
select pg_temp.back();
select pg_temp.as_user('80000000-0000-0000-0000-00000000000a');
select pg_temp.expect_forbidden('entrenador pendiente');
select pg_temp.expect_error($q$select * from public.event_availability('e0000000-0000-0000-0000-000000000001')$q$,
  'forbidden', 'un perfil pendiente pide la disponibilidad');
select pg_temp.back();

-- Con permiso: head coach, manager y entrenador crean, editan y anulan.
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select * from public.create_event('competencia', now() + interval '6 days', now() + interval '6 days 2 hours',
  'Cancha 1', 'Club Rival', 'Llevar camiseta alternativa')$q$, 'head coach crea una competencia con rival');
select pg_temp.expect_ok($q$select public.update_event('e0000000-0000-0000-0000-000000000020', now() + interval '21 days', now() + interval '21 days 2 hours', 'Gimnasio')$q$,
  'head coach edita un evento');
select pg_temp.back();
select pg_temp.as_user('20000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select * from public.create_event('entrenamiento', now() + interval '7 days', now() + interval '7 days 1 hour')$q$, 'manager crea un entrenamiento');
select pg_temp.expect_ok($q$select public.cancel_event('e0000000-0000-0000-0000-000000000003')$q$, 'manager anula un evento');
select pg_temp.expect_error($q$select public.cancel_event('e0000000-0000-0000-0000-000000000003')$q$, 'not_found', 'anular dos veces');
select pg_temp.expect_error($q$select public.update_event('e0000000-0000-0000-0000-000000000003', now() + interval '3 days', now() + interval '3 days 1 hour')$q$,
  'not_found', 'editar un evento anulado');
select pg_temp.back();
select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select * from public.create_event('entrenamiento', now() + interval '8 days', now() + interval '8 days 1 hour')$q$, 'entrenador crea un entrenamiento');
select pg_temp.expect_ok($q$select public.update_event('e0000000-0000-0000-0000-000000000004', now() + interval '4 days', now() + interval '4 days 2 hours', null, 'Otro rival')$q$,
  'entrenador edita una competencia');
select pg_temp.expect_ok($q$select public.cancel_event('e0000000-0000-0000-0000-000000000001')$q$, 'entrenador anula un evento');
select pg_temp.back();

select pg_temp.expect_count($q$select 1 from public.events where id = 'e0000000-0000-0000-0000-000000000003'
  and cancelled_at is not null and cancelled_by = '20000000-0000-0000-0000-00000000000a'$q$, 1, 'la anulación queda registrada con su autor');
select pg_temp.expect_count($q$select 1 from public.events where id = 'e0000000-0000-0000-0000-000000000020' and location = 'Gimnasio'$q$, 1,
  'la edición quedó guardada');
select pg_temp.expect_count($q$select 1 from public.events where club_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  and type = 'competencia' and opponent = 'Club Rival' and created_by = '10000000-0000-0000-0000-00000000000a'$q$, 1,
  'la competencia creada guarda el rival y su autor');

-- =======================================================================
-- 5. Sin escritura directa
-- =======================================================================
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$insert into public.events (club_id, type, starts_at, ends_at, created_by)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'entrenamiento', now(), now() + interval '1 hour', '10000000-0000-0000-0000-00000000000a')$q$,
  'head coach inserta un evento directo');
select pg_temp.expect_fail($q$update public.events set notes = 'x'$q$, 'head coach edita eventos directo');
select pg_temp.expect_fail($q$delete from public.events$q$, 'head coach borra eventos directo');
select pg_temp.back();

-- =======================================================================
-- 6. Repetición semanal
-- =======================================================================
-- Empieza el lunes 2026-08-31 a las 19:30 en Chile y cruza el cambio de horario de septiembre.
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select * from public.create_event(
  p_type => 'entrenamiento',
  p_starts_at => timestamp '2026-08-31 19:30' at time zone 'America/Santiago',
  p_ends_at   => timestamp '2026-08-31 21:00' at time zone 'America/Santiago',
  p_location  => 'Cancha 2',
  p_weeks     => 4)$q$, 'head coach repite un entrenamiento 4 semanas');
select pg_temp.expect_fail($q$select * from public.create_event(p_type => 'entrenamiento',
  p_starts_at => now() + interval '1 day', p_ends_at => now() + interval '1 day 1 hour', p_weeks => 13)$q$, 'repetir 13 semanas');
select pg_temp.expect_fail($q$select * from public.create_event(p_type => 'competencia',
  p_starts_at => now() + interval '1 day', p_ends_at => now() + interval '1 day 1 hour', p_weeks => 2)$q$, 'repetir una competencia');
select pg_temp.expect_fail($q$select * from public.create_event(p_type => 'entrenamiento',
  p_starts_at => now() + interval '1 day', p_ends_at => now() + interval '1 day 1 hour', p_opponent => 'Rival')$q$, 'entrenamiento con rival');
select pg_temp.expect_fail($q$select * from public.create_event(p_type => 'entrenamiento',
  p_starts_at => now() + interval '1 day', p_ends_at => now() + interval '1 day')$q$, 'evento que termina cuando empieza');
select pg_temp.back();

select pg_temp.expect_count($q$select 1 from public.events where location = 'Cancha 2' and series_id is not null$q$, 4,
  'la repetición crea 4 eventos');
select pg_temp.expect_count($q$select distinct series_id from public.events where location = 'Cancha 2'$q$, 1,
  'los 4 eventos comparten series_id');
select pg_temp.expect_count($q$select 1 from public.events where location = 'Cancha 2'
  and (starts_at at time zone 'America/Santiago')::time = time '19:30'
  and (ends_at at time zone 'America/Santiago')::time = time '21:00'$q$, 4,
  'los 4 eventos mantienen la hora local 19:30–21:00');
select pg_temp.expect_count($q$select distinct extract(hour from starts_at at time zone 'UTC') from public.events where location = 'Cancha 2'$q$, 2,
  'la serie cruza el cambio de horario (dos horas UTC distintas)');
select pg_temp.expect_count($q$select 1 from public.events where location = 'Cancha 2'
  and (starts_at at time zone 'America/Santiago')::date in (date '2026-08-31', date '2026-09-07', date '2026-09-14', date '2026-09-21')$q$, 4,
  'una por semana desde el 31 de agosto');

-- =======================================================================
-- 7. Permisos de las funciones
-- =======================================================================
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('create_event', 'update_event', 'cancel_event', 'event_availability')
    and not has_function_privilege('anon', p.oid, 'EXECUTE')
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    and p.proconfig = array['search_path=""']$q$, 4,
  'las 4 funciones: solo authenticated y search_path vacío');
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private' and p.proname in ('events_actor_club', 'events_staff_club')
    and not has_function_privilege('authenticated', p.oid, 'EXECUTE')$q$, 2,
  'los helpers internos no los ejecuta authenticated');

rollback;
