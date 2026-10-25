-- Recov · Test de evaluaciones físicas (migración 0044)
-- Correr DESPUÉS de las migraciones 0001 a 0044. Autónomo: crea sus propios datos y termina en ROLLBACK.
-- Si algo falla, lanza un error que empieza con "FAIL".

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
begin
  execute 'reset role';
end $$;
create function pg_temp.expect_count(q text, expected int, label text) returns void language plpgsql as $$
declare n int;
begin
  execute 'select count(*) from (' || q || ') s' into n;
  if n <> expected then raise exception 'FAIL: % (esperado %, hay %)', label, expected, n; end if;
end $$;
create function pg_temp.expect_ok(q text, label text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    raise exception 'FAIL: % (debía funcionar y falló: %)', label, sqlerrm;
  end;
end $$;
create function pg_temp.expect_fail(q text, label text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    return;
  end;
  raise exception 'FAIL: % (debía fallar y no falló)', label;
end $$;
-- Falla con un código SQLSTATE dado (42501 = sin permiso).
create function pg_temp.expect_state(q text, state text, label text) returns void language plpgsql as $$
declare got text;
begin
  begin
    execute q;
  exception when others then
    got := sqlstate;
  end;
  if got is null then raise exception 'FAIL: % (debía fallar y no falló)', label; end if;
  if got <> state then raise exception 'FAIL: % (esperado %, llegó %)', label, state, got; end if;
end $$;
create function pg_temp.expect_no_rows(q text, label text) returns void language plpgsql as $$
declare n int;
begin
  begin
    execute q;
    get diagnostics n = row_count;
  exception when others then
    return;
  end;
  if n <> 0 then raise exception 'FAIL: % (afectó % filas)', label, n; end if;
end $$;

-- =======================================================================
-- Datos ficticios: plantel A (rugby) con cada rol y plantel B (hockey).
-- =======================================================================
insert into public.clubs (id, name, sport, slug) values
  ('aaaaaaaa-0000-0000-0000-0000000000e1', 'Eval A', 'rugby',  'eval-a'),
  ('bbbbbbbb-0000-0000-0000-0000000000e1', 'Eval B', 'hockey', 'eval-b');
insert into auth.users (id, email) values
  ('e1000000-0000-0000-0000-000000000001', 'hc@eval.test'),
  ('e1000000-0000-0000-0000-000000000002', 'manager@eval.test'),
  ('e1000000-0000-0000-0000-000000000003', 'kine@eval.test'),
  ('e1000000-0000-0000-0000-000000000004', 'coach@eval.test'),
  ('e1000000-0000-0000-0000-000000000005', 'nutri@eval.test'),
  ('e1000000-0000-0000-0000-000000000006', 'pf@eval.test'),
  ('e1000000-0000-0000-0000-000000000007', 'j1@eval.test'),
  ('e1000000-0000-0000-0000-000000000008', 'j2@eval.test'),
  ('e1000000-0000-0000-0000-000000000009', 'pend-staff@eval.test'),
  ('e1000000-0000-0000-0000-000000000010', 'pend-jug@eval.test'),
  ('e2000000-0000-0000-0000-000000000001', 'hc-b@eval.test'),
  ('e2000000-0000-0000-0000-000000000002', 'j-b@eval.test');
insert into public.profiles (id, full_name)
select id, email from auth.users where email like '%@eval.test';
insert into public.club_members (user_id, club_id, roles, status) values
  ('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000e1', '{head_coach}',        'confirmado'),
  ('e1000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-0000000000e1', '{manager}',           'confirmado'),
  ('e1000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-0000000000e1', '{kinesiologo}',       'confirmado'),
  ('e1000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-0000000000e1', '{entrenador}',        'confirmado'),
  ('e1000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-0000000000e1', '{nutricionista}',     'confirmado'),
  ('e1000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-0000000000e1', '{preparador_fisico}', 'confirmado'),
  ('e1000000-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-0000000000e1', '{jugador}',           'confirmado'),
  ('e1000000-0000-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-0000000000e1', '{jugador}',           'confirmado'),
  ('e1000000-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-0000000000e1', '{preparador_fisico}', 'pendiente'),
  ('e1000000-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-0000000000e1', '{jugador}',           'pendiente'),
  ('e2000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-0000000000e1', '{head_coach}',        'confirmado'),
  ('e2000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-0000000000e1', '{jugador}',           'confirmado');
insert into public.players (id, club_id, full_name, position, status, user_id) values
  ('e3000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000e1', 'Jugador Uno',   'Pilar',  'confirmado', 'e1000000-0000-0000-0000-000000000007'),
  ('e3000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-0000000000e1', 'Jugador Dos',   'Hooker', 'confirmado', 'e1000000-0000-0000-0000-000000000008'),
  ('e3000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-0000000000e1', 'Jugador Tres',  'Wing',   'confirmado', null),
  ('e3000000-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-0000000000e1', 'Jugador Pend',  'Centro', 'pendiente',  'e1000000-0000-0000-0000-000000000010'),
  ('e4000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-0000000000e1', 'Jugador B',     'Portero','confirmado', 'e2000000-0000-0000-0000-000000000002');
create temp table d as select (now() at time zone 'America/Santiago')::date as today;
grant select on d to authenticated;

-- =======================================================================
-- 1. Catálogo: crean head coach, kine y preparador físico; nadie más.
-- =======================================================================
select pg_temp.as_user('e1000000-0000-0000-0000-000000000001'); -- head coach A
select pg_temp.expect_ok($q$select public.create_test_definition('aaaaaaaa-0000-0000-0000-0000000000e1', ' Sentadilla 1RM ', 'kg')$q$, 'head coach crea un test');
select pg_temp.expect_fail($q$select public.create_test_definition('aaaaaaaa-0000-0000-0000-0000000000e1', 'sentadilla 1rm', 'kg')$q$, 'nombre repetido (sin importar mayúsculas)');
select pg_temp.expect_state($q$select public.create_test_definition('bbbbbbbb-0000-0000-0000-0000000000e1', 'Sprint', 's')$q$, '42501', 'head coach A crea en el club B');
select pg_temp.expect_fail($q$select public.create_test_definition('aaaaaaaa-0000-0000-0000-0000000000e1', 'X', 'kg')$q$, 'nombre de 1 carácter');
select pg_temp.expect_fail($q$select public.create_test_definition('aaaaaaaa-0000-0000-0000-0000000000e1', 'Bronco', 's', false, 'hms')$q$, 'formato inválido');
select pg_temp.back();
select pg_temp.as_user('e1000000-0000-0000-0000-000000000003'); -- kine
select pg_temp.expect_ok($q$select public.create_test_definition('aaaaaaaa-0000-0000-0000-0000000000e1', 'Sprint 20 m', 's', false)$q$, 'kine crea un test (menos es mejor)');
select pg_temp.back();
select pg_temp.as_user('e1000000-0000-0000-0000-000000000006'); -- preparador físico
select pg_temp.expect_ok($q$select public.create_test_definition('aaaaaaaa-0000-0000-0000-0000000000e1', 'Bronco test', 's', false, 'mmss')$q$, 'preparador físico crea un test mm:ss');
select pg_temp.back();
create function pg_temp.expect_no_write(uid uuid, who text) returns void language plpgsql as $$
begin
  perform pg_temp.as_user(uid);
  perform pg_temp.expect_state($q$select public.create_test_definition('aaaaaaaa-0000-0000-0000-0000000000e1', 'Otro test', 'cm')$q$, '42501', who || ' crea un test');
  perform pg_temp.expect_state(format($q$select public.record_test_results(%L, (select today - 1 from d), '[{"player_id":"e3000000-0000-0000-0000-000000000001","value":100}]')$q$,
    (select id from public.test_definitions where name = 'Sentadilla 1RM')), '42501', who || ' registra resultados');
  perform pg_temp.expect_state(format($q$select public.archive_test_definition(%L)$q$,
    (select id from public.test_definitions where name = 'Sentadilla 1RM')), '42501', who || ' archiva un test');
  perform pg_temp.back();
end $$;
select pg_temp.expect_no_write('e1000000-0000-0000-0000-000000000002', 'manager');
select pg_temp.expect_no_write('e1000000-0000-0000-0000-000000000004', 'entrenador');
select pg_temp.expect_no_write('e1000000-0000-0000-0000-000000000005', 'nutricionista');
select pg_temp.expect_no_write('e1000000-0000-0000-0000-000000000007', 'jugador');
select pg_temp.expect_no_write('e1000000-0000-0000-0000-000000000009', 'preparador físico pendiente');
select pg_temp.expect_no_write('e2000000-0000-0000-0000-000000000001', 'head coach de otro club');
select pg_temp.as_anon();
select pg_temp.expect_fail($q$select public.create_test_definition('aaaaaaaa-0000-0000-0000-0000000000e1', 'Anon', 'kg')$q$, 'anónimo crea un test');
select pg_temp.expect_fail($q$select 1 from public.test_definitions$q$, 'anónimo lee el catálogo');
select pg_temp.back();

create temp table t as select
  (select id from public.test_definitions where name = 'Sentadilla 1RM') squat,
  (select id from public.test_definitions where name = 'Sprint 20 m') sprint,
  (select id from public.test_definitions where name = 'Bronco test') bronco;
grant select on t to authenticated;

-- =======================================================================
-- 2. Resultados: registro, fecha futura, jugadores ajenos, uno por día.
-- =======================================================================
select pg_temp.as_user('e1000000-0000-0000-0000-000000000001'); -- head coach A
select pg_temp.expect_count($q$select 1 where public.record_test_results((select squat from t), (select today - 14 from d), '[
  {"player_id":"e3000000-0000-0000-0000-000000000001","value":120},
  {"player_id":"e3000000-0000-0000-0000-000000000002","value":100,"note":"Molestia leve en la rodilla"},
  {"player_id":"e3000000-0000-0000-0000-000000000003","value":90}]') = 3$q$, 1, 'head coach registra 3 resultados');
select pg_temp.expect_fail($q$select public.record_test_results((select squat from t), (select today + 1 from d),
  '[{"player_id":"e3000000-0000-0000-0000-000000000001","value":125}]')$q$, 'fecha futura');
select pg_temp.expect_fail($q$select public.record_test_results((select squat from t), (select today from d),
  '[{"player_id":"e4000000-0000-0000-0000-000000000001","value":125}]')$q$, 'jugador del club B');
select pg_temp.expect_fail($q$select public.record_test_results((select squat from t), (select today from d),
  '[{"player_id":"e3000000-0000-0000-0000-000000000009","value":125}]')$q$, 'jugador pendiente');
select pg_temp.expect_fail($q$select public.record_test_results((select squat from t), (select today from d),
  '[{"player_id":"e3000000-0000-0000-0000-000000000001","value":0}]')$q$, 'valor 0');
select pg_temp.expect_fail($q$select public.record_test_results((select squat from t), (select today from d), '[]')$q$, 'lote vacío');
select pg_temp.expect_fail($q$select public.record_test_results((select squat from t), (select today from d),
  '[{"player_id":"e3000000-0000-0000-0000-000000000001","value":130},{"player_id":"e4000000-0000-0000-0000-000000000001","value":1}]')$q$, 'lote con un jugador ajeno');
select pg_temp.expect_fail($q$select public.record_test_results((select squat from t), (select today - 14 from d),
  '[{"player_id":"e3000000-0000-0000-0000-000000000001","value":121}]')$q$, 'segundo resultado activo el mismo día');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.test_results where measured_on = (select today from d)$q$, 0, 'los lotes inválidos no guardan nada');

select pg_temp.as_user('e1000000-0000-0000-0000-000000000006'); -- preparador físico: segunda evaluación
select pg_temp.expect_ok($q$select public.record_test_results((select squat from t), (select today - 2 from d), '[
  {"player_id":"e3000000-0000-0000-0000-000000000001","value":130},
  {"player_id":"e3000000-0000-0000-0000-000000000002","value":95,"note":"Venía de lesión"}]')$q$, 'preparador físico registra la segunda evaluación');
select pg_temp.back();
select pg_temp.as_user('e1000000-0000-0000-0000-000000000003'); -- kine: tiempos
select pg_temp.expect_ok($q$select public.record_test_results((select sprint from t), (select today - 2 from d), '[
  {"player_id":"e3000000-0000-0000-0000-000000000001","value":3.05},
  {"player_id":"e3000000-0000-0000-0000-000000000002","value":2.90}]')$q$, 'kine registra un test de tiempo');
select pg_temp.back();

-- Anular y volver a registrar el mismo día.
select pg_temp.as_user('e1000000-0000-0000-0000-000000000004'); -- entrenador
select pg_temp.expect_state(format($q$select public.void_test_result(%L)$q$, (select id from public.test_results
  where player_id = 'e3000000-0000-0000-0000-000000000003')), '42501', 'entrenador anula un resultado');
select pg_temp.back();
select pg_temp.as_user('e1000000-0000-0000-0000-000000000001');
select pg_temp.expect_ok(format($q$select public.void_test_result(%L)$q$, (select id from public.test_results
  where player_id = 'e3000000-0000-0000-0000-000000000003')), 'head coach anula un resultado');
select pg_temp.expect_fail(format($q$select public.void_test_result(%L)$q$, (select id from public.test_results
  where player_id = 'e3000000-0000-0000-0000-000000000003')), 'anular dos veces');
select pg_temp.expect_ok($q$select public.record_test_results((select squat from t), (select today - 14 from d),
  '[{"player_id":"e3000000-0000-0000-0000-000000000003","value":92}]')$q$, 'se vuelve a registrar el mismo día');
select pg_temp.expect_no_rows($q$update public.test_results set value = 999$q$, 'head coach edita resultados directo');
select pg_temp.expect_fail($q$insert into public.test_results (club_id, test_id, player_id, value, measured_on, recorded_by)
  values ('aaaaaaaa-0000-0000-0000-0000000000e1', (select squat from t), 'e3000000-0000-0000-0000-000000000001', 1, current_date - 30, 'e1000000-0000-0000-0000-000000000001')$q$, 'head coach inserta resultados directo');
select pg_temp.expect_no_rows($q$delete from public.test_results$q$, 'head coach borra resultados directo');
select pg_temp.expect_no_rows($q$update public.test_definitions set name = 'x'$q$, 'head coach edita el catálogo directo');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.test_results where player_id = 'e3000000-0000-0000-0000-000000000003'
  and ((value = 90 and voided_at is not null and voided_by is not null) or (value = 92 and voided_at is null))$q$, 2, 'queda el anulado con su autor y el nuevo vigente');

-- =======================================================================
-- 3. Lectura directa: staff (sin manager) todo el club; jugador solo lo suyo.
-- =======================================================================
create function pg_temp.expect_reads(uid uuid, n_results int, n_tests int, who text) returns void language plpgsql as $$
begin
  perform pg_temp.as_user(uid);
  perform pg_temp.expect_count('select 1 from public.test_results', n_results, who || ' lee resultados');
  perform pg_temp.expect_count('select 1 from public.test_definitions', n_tests, who || ' lee el catálogo');
  perform pg_temp.back();
end $$;
select pg_temp.expect_reads('e1000000-0000-0000-0000-000000000001', 8, 3, 'head coach');
select pg_temp.expect_reads('e1000000-0000-0000-0000-000000000003', 8, 3, 'kine');
select pg_temp.expect_reads('e1000000-0000-0000-0000-000000000004', 8, 3, 'entrenador');
select pg_temp.expect_reads('e1000000-0000-0000-0000-000000000005', 8, 3, 'nutricionista');
select pg_temp.expect_reads('e1000000-0000-0000-0000-000000000006', 8, 3, 'preparador físico');
select pg_temp.expect_reads('e1000000-0000-0000-0000-000000000002', 0, 3, 'manager (sin resultados)');
select pg_temp.expect_reads('e1000000-0000-0000-0000-000000000007', 3, 3, 'jugador Uno (solo los suyos)');
select pg_temp.expect_reads('e1000000-0000-0000-0000-000000000009', 0, 0, 'preparador físico pendiente');
select pg_temp.expect_reads('e1000000-0000-0000-0000-000000000010', 0, 0, 'jugador pendiente');
select pg_temp.expect_reads('e2000000-0000-0000-0000-000000000001', 0, 0, 'head coach B (otro club)');
select pg_temp.expect_reads('e2000000-0000-0000-0000-000000000002', 0, 0, 'jugador B (otro club)');
select pg_temp.as_user('e1000000-0000-0000-0000-000000000007'); -- jugador Uno
select pg_temp.expect_count($q$select 1 from public.test_results where player_id <> 'e3000000-0000-0000-0000-000000000001'$q$, 0, 'jugador Uno no lee filas ajenas');
select pg_temp.expect_count($q$select 1 from public.test_results where note is not null$q$, 0, 'jugador Uno no lee notas ajenas');
select pg_temp.back();
select pg_temp.as_user('e1000000-0000-0000-0000-000000000008'); -- jugador Dos lee sus notas
select pg_temp.expect_count($q$select 1 from public.test_results where note is not null$q$, 2, 'jugador Dos lee sus propias notas');
select pg_temp.back();

-- =======================================================================
-- 4. Ranking: todo el club confirmado, sin nota; nadie más.
-- =======================================================================
select pg_temp.as_user('e1000000-0000-0000-0000-000000000007'); -- jugador Uno
select pg_temp.expect_count($q$select 1 from public.get_test_ranking((select squat from t))$q$, 3, 'el jugador ve el ranking completo');
select pg_temp.expect_count($q$select 1 from (select player_id, row_number() over () rn from public.get_test_ranking((select squat from t))) r
  where (rn, player_id) in ((1, 'e3000000-0000-0000-0000-000000000001'::uuid), (2, 'e3000000-0000-0000-0000-000000000002'::uuid), (3, 'e3000000-0000-0000-0000-000000000003'::uuid))$q$, 3, 'más es mejor: orden descendente');
select pg_temp.expect_count($q$select 1 from public.get_test_ranking((select squat from t))
  where player_id = 'e3000000-0000-0000-0000-000000000001' and value = 130 and previous_value = 120 and full_name = 'Jugador Uno'$q$, 1, 'último valor y el anterior');
select pg_temp.expect_count($q$select 1 from public.get_test_ranking((select squat from t))
  where player_id = 'e3000000-0000-0000-0000-000000000003' and value = 92 and previous_value is null$q$, 1, 'el anulado no cuenta como anterior');
select pg_temp.expect_count($q$select 1 from (select player_id, row_number() over () rn from public.get_test_ranking((select sprint from t))) r
  where rn = 1 and player_id = 'e3000000-0000-0000-0000-000000000002'$q$, 1, 'menos es mejor: el tiempo menor primero');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from pg_proc where oid = 'public.get_test_ranking(uuid)'::regprocedure
  and pg_get_function_result(oid) = 'TABLE(player_id uuid, full_name text, value numeric, measured_on date, previous_value numeric)'$q$, 1, 'el ranking no devuelve la nota');
select pg_temp.as_user('e1000000-0000-0000-0000-000000000002'); -- manager
select pg_temp.expect_count($q$select 1 from public.get_test_ranking((select squat from t))$q$, 3, 'manager ve el ranking (miembro confirmado)');
select pg_temp.back();
select pg_temp.as_user('e1000000-0000-0000-0000-000000000010'); -- jugador pendiente
select pg_temp.expect_state($q$select 1 from public.get_test_ranking((select squat from t))$q$, '42501', 'jugador pendiente pide el ranking');
select pg_temp.back();
select pg_temp.as_user('e1000000-0000-0000-0000-000000000009'); -- staff pendiente
select pg_temp.expect_state($q$select 1 from public.get_test_ranking((select squat from t))$q$, '42501', 'staff pendiente pide el ranking');
select pg_temp.back();
select pg_temp.as_user('e2000000-0000-0000-0000-000000000002'); -- jugador B
select pg_temp.expect_state($q$select 1 from public.get_test_ranking((select squat from t))$q$, '42501', 'jugador de otro club pide el ranking');
select pg_temp.back();
select pg_temp.as_anon();
select pg_temp.expect_fail($q$select 1 from public.get_test_ranking((select squat from t))$q$, 'anónimo pide el ranking');
select pg_temp.back();

-- =======================================================================
-- 5. Archivar: el test archivado no recibe resultados y libera el nombre.
-- =======================================================================
select pg_temp.as_user('e1000000-0000-0000-0000-000000000006'); -- preparador físico
select pg_temp.expect_ok($q$select public.archive_test_definition((select sprint from t))$q$, 'preparador físico archiva un test');
select pg_temp.expect_fail($q$select public.record_test_results((select sprint from t), (select today from d),
  '[{"player_id":"e3000000-0000-0000-0000-000000000001","value":3}]')$q$, 'registrar en un test archivado');
select pg_temp.expect_ok($q$select public.create_test_definition('aaaaaaaa-0000-0000-0000-0000000000e1', 'Sprint 20 m', 's', false)$q$, 'el nombre de un test archivado se puede volver a usar');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.test_results where test_id = (select sprint from t)$q$, 2, 'archivar no borra resultados');

-- =======================================================================
-- 6. Permisos de las funciones.
-- =======================================================================
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('create_test_definition', 'archive_test_definition', 'record_test_results', 'void_test_result', 'get_test_ranking')
    and p.prosecdef and p.proconfig = array['search_path=""']
    and has_function_privilege('authenticated', p.oid, 'EXECUTE') and not has_function_privilege('anon', p.oid, 'EXECUTE')$q$, 5,
  'las 5 funciones: SECURITY DEFINER, search_path vacío, authenticated sí y anon no');
select pg_temp.expect_count($q$select 1 where has_function_privilege('anon', 'private.has_any_role(uuid, public.user_role[])', 'EXECUTE')$q$, 0, 'anon no ejecuta has_any_role');
select pg_temp.expect_count($q$select 1 where has_table_privilege('authenticated', 'public.test_results', 'INSERT')
  or has_table_privilege('authenticated', 'public.test_results', 'UPDATE') or has_table_privilege('authenticated', 'public.test_results', 'DELETE')
  or has_table_privilege('authenticated', 'public.test_definitions', 'INSERT') or has_table_privilege('authenticated', 'public.test_definitions', 'UPDATE')
  or has_table_privilege('anon', 'public.test_results', 'SELECT') or has_table_privilege('anon', 'public.test_definitions', 'SELECT')$q$, 0, 'sin escritura directa ni lectura anónima');

select 'evaluaciones_test: OK' as resultado;
rollback;
