-- Recov · Test del plan de gimnasio (20261105200000, 20261105201000, 20261105202000 y 20261105210000)
-- Autónomo: crea sus propios datos y termina en ROLLBACK. Si algo falla, lanza un error que empieza con "FAIL".
-- Las sesiones se arman según el día de hoy en Chile (t.dow*: día ISO de hoy y de hace N días).

begin;

-- Utilidades de prueba ----------------------------------------------------
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

create function pg_temp.expect_fail(q text, label text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    return;
  end;
  raise exception 'FAIL: % (debía fallar y no falló)', label;
end $$;

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

create function pg_temp.expect_state(q text, state text, label text) returns void language plpgsql as $$
declare got text;
begin
  begin
    execute q;
  exception when others then
    got := sqlstate;
  end;
  if got is null then raise exception 'FAIL: % (debía fallar con % y no falló)', label, state; end if;
  if got <> state then raise exception 'FAIL: % (esperado %, llegó %)', label, state, got; end if;
end $$;

create function pg_temp.expect_ok(q text, label text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    raise exception 'FAIL: % (debía funcionar y falló: %)', label, sqlerrm;
  end;
end $$;

create function pg_temp.expect_eq(q text, expected text, label text) returns void language plpgsql as $$
declare got text;
begin
  execute q into got;
  if got is distinct from expected then raise exception 'FAIL: % (esperado %, llegó %)', label, expected, got; end if;
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
  if n > 0 then raise exception 'FAIL: % (afectó % filas)', label, n; end if;
end $$;

-- Datos de prueba (como postgres) ---------------------------------------
insert into public.clubs (id, name, sport, slug, has_sevens) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', 'Club A gym', 'rugby',  'club-a-gym', true),
  ('bbbbbbbb-0000-0000-0000-0000000000d2', 'Club B gym', 'hockey', 'club-b-gym', false);

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-0000000000d1', 'hc-a-gym@test.cl'),
  ('20000000-0000-0000-0000-0000000000d1', 'manager-a-gym@test.cl'),
  ('30000000-0000-0000-0000-0000000000d1', 'kine-a-gym@test.cl'),
  ('55000000-0000-0000-0000-0000000000d1', 'pf-a-gym@test.cl'),
  ('60000000-0000-0000-0000-0000000000d1', 'j1-a-gym@test.cl'),
  ('61000000-0000-0000-0000-0000000000d1', 'j2-a-gym@test.cl'),
  ('62000000-0000-0000-0000-0000000000d1', 'j3-a-gym@test.cl'),
  ('10000000-0000-0000-0000-0000000000d2', 'hc-b-gym@test.cl'),
  ('60000000-0000-0000-0000-0000000000d2', 'j1-b-gym@test.cl');

with v(id, club_id, roles, full_name, status) as (values
  ('10000000-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000d1', '{head_coach}',        'HC A',      'confirmado'),
  ('20000000-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000d1', '{manager}',           'Manager A', 'confirmado'),
  ('30000000-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000d1', '{kinesiologo}',       'Kine A',    'confirmado'),
  ('55000000-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000d1', '{preparador_fisico}', 'PF A',      'confirmado'),
  ('60000000-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000d1', '{jugador}',           'J1 A',      'confirmado'),
  ('61000000-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000d1', '{jugador}',           'J2 A',      'confirmado'),
  ('62000000-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000d1', '{jugador}',           'J3 A',      'confirmado'),
  ('10000000-0000-0000-0000-0000000000d2', 'bbbbbbbb-0000-0000-0000-0000000000d2', '{head_coach}',        'HC B',      'confirmado'),
  ('60000000-0000-0000-0000-0000000000d2', 'bbbbbbbb-0000-0000-0000-0000000000d2', '{jugador}',           'J1 B',      'confirmado')),
     p as (insert into public.profiles (id, full_name) select id::uuid, full_name from v)
insert into public.club_members (user_id, club_id, roles, status)
select id::uuid, club_id::uuid, roles::public.user_role[], status::public.member_status from v;

-- A1 Pilar (con test), A2 Wing del grupo Sevens (sin test), A3 Pilar lesionado, A4 Centro sin cuenta.
insert into public.players (id, club_id, full_name, first_name, position, status, availability, user_id, active) values
  ('a1d00000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'Ana Uno',    'Ana',  'Pilar',  'confirmado', 'disponible', '60000000-0000-0000-0000-0000000000d1', true),
  ('a1d00000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'Bea Dos',    'Bea',  'Wing',   'confirmado', 'disponible', '61000000-0000-0000-0000-0000000000d1', true),
  ('a1d00000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'Cata Tres',  'Cata', 'Pilar',  'confirmado', 'lesionado',  '62000000-0000-0000-0000-0000000000d1', true),
  ('a1d00000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'Dani Cuatro','Dani', 'Centro', 'confirmado', 'disponible', null, true),
  ('b1d00000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-0000000000d2', 'Beto B',     'Beto', null,     'confirmado', 'disponible', '60000000-0000-0000-0000-0000000000d2', true);

insert into public.sevens_group (club_id, member_id)
values ('aaaaaaaa-0000-0000-0000-0000000000d1', '61000000-0000-0000-0000-0000000000d1');

-- Tests: Sentadilla en kg (A1: 140 vigente y un 200 anulado más nuevo) y Bronco en segundos.
insert into public.test_definitions (id, club_id, name, unit, created_by) values
  ('7e570000-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'Sentadilla 1RM', 'kg', '10000000-0000-0000-0000-0000000000d1'),
  ('7e570000-0000-0000-0000-0000000000d2', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'Bronco', 's', '10000000-0000-0000-0000-0000000000d1'),
  ('7e570000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-0000000000d2', 'Sentadilla B', 'kg', '10000000-0000-0000-0000-0000000000d2');
insert into public.test_results (club_id, test_id, player_id, value, measured_on, recorded_by, voided_at, voided_by) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', '7e570000-0000-0000-0000-0000000000d1', 'a1d00000-0000-0000-0000-000000000001', 140, current_date - 20, '10000000-0000-0000-0000-0000000000d1', null, null),
  ('aaaaaaaa-0000-0000-0000-0000000000d1', '7e570000-0000-0000-0000-0000000000d1', 'a1d00000-0000-0000-0000-000000000001', 200, current_date - 5,  '10000000-0000-0000-0000-0000000000d1', now(), '10000000-0000-0000-0000-0000000000d1');

-- Días ISO de hoy y de hace 2 y 3 días (Chile), y fechas de vigencia.
select set_config('t.dow0', extract(isodow from private.chile_today())::text, true),
       set_config('t.dow2', extract(isodow from private.chile_today() - 2)::text, true),
       set_config('t.dow3', extract(isodow from private.chile_today() - 3)::text, true),
       set_config('t.from', (private.chile_today() - 7)::text, true),
       set_config('t.to',   (private.chile_today() + 30)::text, true),
       set_config('t.today', private.chile_today()::text, true),
       set_config('t.pilar', (select id::text from public.positions where sport = 'rugby' and format = '15' and name = 'Pilar'), true),
       set_config('t.pilar7', (select id::text from public.positions where sport = 'rugby' and format = '7' and name = 'Pilar'), true);

-- P1: Pilares; Sesión A hoy (sentadilla al 80 %, dominadas, peso muerto a esfuerzo 7),
-- Sesión B hace 2 días y Sesión C hace 3 días (fuera de plazo).
select set_config('t.p1', jsonb_build_object(
  'name', 'Fuerza pilares', 'starts_on', current_setting('t.from'), 'ends_on', current_setting('t.to'),
  'targets', jsonb_build_array(jsonb_build_object('kind', 'posicion', 'position_id', current_setting('t.pilar'))),
  'exclusions', '[]'::jsonb,
  'sessions', jsonb_build_array(
    jsonb_build_object('label', 'Sesión A', 'weekday', current_setting('t.dow0')::int, 'est_minutes', 60, 'exercises', jsonb_build_array(
      jsonb_build_object('name', 'Sentadilla trasera', 'sets', 4, 'reps', '5', 'intensity_type', 'pct', 'pct', 80, 'test_id', '7e570000-0000-0000-0000-0000000000d1', 'rest_seconds', 150, 'note', 'Bajar controlado'),
      jsonb_build_object('name', 'Dominadas', 'sets', 3, 'reps', 'máx', 'intensity_type', 'bw'),
      jsonb_build_object('name', 'Peso muerto rumano', 'sets', 3, 'reps', '8', 'intensity_type', 'rpe', 'rpe', 7))),
    jsonb_build_object('label', 'Sesión B', 'weekday', current_setting('t.dow2')::int, 'est_minutes', 45, 'exercises', jsonb_build_array(
      jsonb_build_object('name', 'Press banca', 'sets', 4, 'reps', '5', 'intensity_type', 'kg', 'kg', 60))),
    jsonb_build_object('label', 'Sesión C', 'weekday', current_setting('t.dow3')::int, 'est_minutes', 45, 'exercises', jsonb_build_array(
      jsonb_build_object('name', 'Plancha', 'sets', 3, 'reps', '20 s', 'intensity_type', 'bw'))))
)::text, true);

-- =======================================================================
-- 1. Permisos de creación
-- =======================================================================
select pg_temp.as_user('20000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_state($q$select public.save_gym_plan(current_setting('t.p1')::jsonb)$q$, '42501', 'manager crea un plan');
select pg_temp.back();
select pg_temp.as_user('30000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_state($q$select public.save_gym_plan(current_setting('t.p1')::jsonb)$q$, '42501', 'kine crea un plan');
select pg_temp.back();
select pg_temp.as_user('60000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_state($q$select public.save_gym_plan(current_setting('t.p1')::jsonb)$q$, '42501', 'jugador crea un plan');
select pg_temp.back();
select pg_temp.as_anon();
select pg_temp.expect_fail($q$select public.save_gym_plan(current_setting('t.p1')::jsonb)$q$, 'anónimo crea un plan');
select pg_temp.back();

-- Head coach: crea P1 (borrador).
select pg_temp.as_user('10000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_ok($q$select set_config('t.p1id', public.save_gym_plan(current_setting('t.p1')::jsonb)::text, true)$q$, 'head coach crea un plan');
select pg_temp.expect_eq($q$select status from public.gym_plans where id = current_setting('t.p1id')::uuid$q$, 'borrador', 'el plan nace en borrador');
select pg_temp.expect_count($q$select 1 from public.gym_plan_exercises e join public.gym_plan_sessions s on s.id = e.session_id where s.plan_id = current_setting('t.p1id')::uuid$q$, 5, 'P1 con 5 ejercicios');
-- Validaciones
select pg_temp.expect_error($q$select public.save_gym_plan(jsonb_set(current_setting('t.p1')::jsonb, '{name}', '"x"'))$q$,
  'El nombre debe tener entre 2 y 80 caracteres', 'nombre corto');
select pg_temp.expect_error($q$select public.save_gym_plan(jsonb_set(current_setting('t.p1')::jsonb, '{ends_on}', to_jsonb((current_setting('t.from')::date - 1)::text)))$q$,
  'La vigencia termina antes de empezar', 'vigencia al revés');
select pg_temp.expect_error($q$select public.save_gym_plan(jsonb_set(current_setting('t.p1')::jsonb, '{sessions,0,exercises,0,test_id}', '"7e570000-0000-0000-0000-0000000000d2"'))$q$,
  'Elige el porcentaje (30 a 110) y un test en kilos (Sentadilla trasera)', '% de un test que no es en kilos');
select pg_temp.expect_error($q$select public.save_gym_plan(jsonb_set(current_setting('t.p1')::jsonb, '{sessions,0,exercises,0,test_id}', '"7e570000-0000-0000-0000-0000000000b1"'))$q$,
  'Elige el porcentaje (30 a 110) y un test en kilos (Sentadilla trasera)', '% de un test de otro club');
select pg_temp.expect_error($q$select public.save_gym_plan(jsonb_set(current_setting('t.p1')::jsonb, '{targets}', '[{"kind":"jugador","player_id":"b1d00000-0000-0000-0000-000000000001"}]'))$q$,
  'Jugador inválido', 'destinatario de otro club');
select pg_temp.expect_error($q$select public.save_gym_plan(jsonb_set(current_setting('t.p1')::jsonb, '{exclusions}', '["b1d00000-0000-0000-0000-000000000001"]'))$q$,
  'Jugador inválido', 'exclusión de otro club');
select pg_temp.expect_error($q$select public.save_gym_plan(jsonb_set(current_setting('t.p1')::jsonb, '{targets}', jsonb_build_array(jsonb_build_object('kind', 'posicion', 'position_id', current_setting('t.pilar7')))))$q$,
  'Posición inválida', 'posición del catálogo de Sevens');
select pg_temp.expect_error($q$select public.save_gym_plan(jsonb_set(current_setting('t.p1')::jsonb, '{sessions,0,exercises,1,sets}', '11'))$q$,
  'Las series van de 1 a 10 (Dominadas)', 'series fuera de rango');
select pg_temp.back();

-- Con el borrador, el jugador todavía no ve nada.
select pg_temp.as_user('60000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_eq($q$select jsonb_array_length(public.my_gym_today()->'sessions')::text$q$, '0', 'borrador: el jugador no lo ve');
select pg_temp.expect_error($q$select public.complete_gym_session((select id from public.gym_plan_sessions where plan_id = current_setting('t.p1id')::uuid and label = 'Sesión A'), null, true)$q$,
  'not_found', 'el jugador no lee gym_plan_sessions directo');
select pg_temp.back();

-- Ids de las sesiones y ejercicios (como postgres).
select set_config('t.sA', (select id::text from public.gym_plan_sessions where plan_id = current_setting('t.p1id')::uuid and label = 'Sesión A'), true),
       set_config('t.sB', (select id::text from public.gym_plan_sessions where plan_id = current_setting('t.p1id')::uuid and label = 'Sesión B'), true),
       set_config('t.sC', (select id::text from public.gym_plan_sessions where plan_id = current_setting('t.p1id')::uuid and label = 'Sesión C'), true),
       set_config('t.eSq', (select e.id::text from public.gym_plan_exercises e join public.gym_plan_sessions s on s.id = e.session_id
                             where s.plan_id = current_setting('t.p1id')::uuid and e.name = 'Sentadilla trasera'), true),
       set_config('t.eBench', (select e.id::text from public.gym_plan_exercises e join public.gym_plan_sessions s on s.id = e.session_id
                             where s.plan_id = current_setting('t.p1id')::uuid and e.name = 'Press banca'), true);

select pg_temp.as_user('60000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_error($q$select public.complete_gym_session(current_setting('t.sA')::uuid, null, true)$q$,
  'El plan no está publicado', 'borrador: no se puede marcar');
select pg_temp.back();

-- Publicar: un plan sin destinatarios no se publica.
select pg_temp.as_user('55000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_ok($q$select set_config('t.pEmpty', public.save_gym_plan(jsonb_set(current_setting('t.p1')::jsonb, '{targets}', '[]'))::text, true)$q$, 'preparador físico crea un plan');
select pg_temp.expect_error($q$select public.publish_gym_plan(current_setting('t.pEmpty')::uuid)$q$, 'Elige a quién va el plan antes de publicar', 'publicar sin destinatarios');
select pg_temp.expect_ok($q$select public.publish_gym_plan(current_setting('t.p1id')::uuid)$q$, 'preparador físico publica el plan del head coach');
select pg_temp.back();

-- =======================================================================
-- 2. Destinatarios y exclusiones
-- =======================================================================
select pg_temp.expect_eq($q$select string_agg(player_id::text, ',' order by player_id) from private.gym_plan_players(current_setting('t.p1id')::uuid)$q$,
  'a1d00000-0000-0000-0000-000000000001,a1d00000-0000-0000-0000-000000000003', 'por posición: los dos pilares (también el lesionado)');

select pg_temp.as_user('55000000-0000-0000-0000-0000000000d1');
-- P2: todo el plantel menos el lesionado A3.
select pg_temp.expect_ok($q$select set_config('t.p2id', public.save_gym_plan(jsonb_build_object(
  'name', 'Plantel', 'starts_on', current_setting('t.from'), 'ends_on', current_setting('t.to'),
  'targets', '[{"kind":"plantel"}]'::jsonb, 'exclusions', '["a1d00000-0000-0000-0000-000000000003"]'::jsonb,
  'sessions', jsonb_build_array(jsonb_build_object('label', 'Sesión P', 'weekday', current_setting('t.dow0')::int, 'est_minutes', 30,
    'exercises', jsonb_build_array(jsonb_build_object('name', 'Sentadilla frontal', 'sets', 3, 'reps', '6', 'intensity_type', 'pct', 'pct', 70, 'test_id', '7e570000-0000-0000-0000-0000000000d1'))))))::text, true)$q$,
  'plan para todo el plantel con una exclusión');
-- P3: grupo Sevens y la jugadora A4.
select pg_temp.expect_ok($q$select set_config('t.p3id', public.save_gym_plan(jsonb_build_object(
  'name', 'Sevens', 'starts_on', current_setting('t.from'), 'ends_on', current_setting('t.to'),
  'targets', '[{"kind":"sevens"},{"kind":"jugador","player_id":"a1d00000-0000-0000-0000-000000000004"}]'::jsonb,
  'sessions', jsonb_build_array(jsonb_build_object('label', 'Sesión S', 'weekday', current_setting('t.dow0')::int, 'est_minutes', 40,
    'exercises', jsonb_build_array(jsonb_build_object('name', 'Saltos', 'sets', 3, 'reps', '5', 'intensity_type', 'bw'))))))::text, true)$q$,
  'plan para Sevens y un jugador');
select pg_temp.expect_ok($q$select public.publish_gym_plan(current_setting('t.p2id')::uuid)$q$, 'publica P2');
select pg_temp.expect_ok($q$select public.publish_gym_plan(current_setting('t.p3id')::uuid)$q$, 'publica P3');
select pg_temp.back();

select pg_temp.expect_eq($q$select string_agg(player_id::text, ',' order by player_id) from private.gym_plan_players(current_setting('t.p2id')::uuid)$q$,
  'a1d00000-0000-0000-0000-000000000001,a1d00000-0000-0000-0000-000000000002,a1d00000-0000-0000-0000-000000000004', 'plantel menos el excluido');
select pg_temp.expect_eq($q$select string_agg(player_id::text, ',' order by player_id) from private.gym_plan_players(current_setting('t.p3id')::uuid)$q$,
  'a1d00000-0000-0000-0000-000000000002,a1d00000-0000-0000-0000-000000000004', 'Sevens + un jugador');

-- Editar P2 sin la exclusión: A3 vuelve a recibirlo (la exclusión vieja queda archivada).
select pg_temp.as_user('10000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_ok($q$select public.save_gym_plan(jsonb_build_object(
  'id', current_setting('t.p2id'), 'name', 'Plantel', 'starts_on', current_setting('t.from'), 'ends_on', current_setting('t.to'),
  'targets', '[{"kind":"plantel"}]'::jsonb, 'exclusions', '[]'::jsonb,
  'sessions', (select jsonb_agg(jsonb_build_object('id', s.id, 'label', s.label, 'weekday', s.weekday, 'est_minutes', s.est_minutes,
                 'exercises', (select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name, 'sets', e.sets, 'reps', e.reps,
                                 'intensity_type', e.intensity_type, 'pct', e.pct, 'test_id', e.test_id)) from public.gym_plan_exercises e
                                where e.session_id = s.id and e.archived_at is null)))
                 from public.gym_plan_sessions s where s.plan_id = current_setting('t.p2id')::uuid and s.archived_at is null)))$q$,
  'head coach edita un plan publicado');
select pg_temp.expect_eq($q$select status from public.gym_plans where id = current_setting('t.p2id')::uuid$q$, 'publicado', 'sigue publicado al editarlo');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from private.gym_plan_players(current_setting('t.p2id')::uuid) where player_id = 'a1d00000-0000-0000-0000-000000000003'$q$, 1, 'sin exclusión, el lesionado lo recibe');
select pg_temp.expect_count($q$select 1 from public.gym_plan_exclusions where plan_id = current_setting('t.p2id')::uuid and archived_at is not null$q$, 1, 'la exclusión quitada queda archivada');
select pg_temp.expect_count($q$select 1 from public.gym_plan_sessions where plan_id = current_setting('t.p2id')::uuid$q$, 1, 'editar con el mismo id no duplica la sesión');

-- =======================================================================
-- 3. Kilos calculados
-- =======================================================================
select pg_temp.as_user('60000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_eq($q$select x->>'calc_kg' from jsonb_array_elements(public.my_gym_today()->'sessions') s, jsonb_array_elements(s->'exercises') x where x->>'name' = 'Sentadilla trasera'$q$,
  '112.5', 'A1: 80 % de 140 = 112,5 kg (ignora el resultado anulado)');
select pg_temp.expect_eq($q$select x->>'max' from jsonb_array_elements(public.my_gym_today()->'sessions') s, jsonb_array_elements(s->'exercises') x where x->>'name' = 'Sentadilla trasera'$q$,
  '140.00', 'A1: muestra el máximo usado');
select pg_temp.expect_eq($q$select x->>'calc_kg' from jsonb_array_elements(public.my_gym_today()->'sessions') s, jsonb_array_elements(s->'exercises') x where x->>'name' = 'Sentadilla frontal'$q$,
  '97.5', 'A1: 70 % de 140 = 98 → 97,5 kg');
select pg_temp.expect_count($q$select 1 from jsonb_array_elements(public.my_gym_today()->'sessions') s where s->>'label' = 'Sesión S'$q$, 0, 'A1 no ve el plan de Sevens');
select pg_temp.back();
select pg_temp.as_user('61000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_eq($q$select coalesce(x->>'calc_kg', 'null') from jsonb_array_elements(public.my_gym_today()->'sessions') s, jsonb_array_elements(s->'exercises') x where x->>'name' = 'Sentadilla frontal'$q$,
  'null', 'A2 sin test: sin kilos');
select pg_temp.expect_count($q$select 1 from jsonb_array_elements(public.my_gym_today()->'sessions') s where s->>'label' in ('Sesión S', 'Sesión P')$q$, 2, 'A2 ve P2 y el plan de Sevens');
select pg_temp.expect_count($q$select 1 from jsonb_array_elements(public.my_gym_today()->'sessions') s where s->>'label' = 'Sesión A'$q$, 0, 'A2 (wing) no ve el plan de pilares');
select pg_temp.back();

-- =======================================================================
-- 4. Registro: plazo, ejercicios sueltos, sesión completa y sesión propia
-- =======================================================================
select pg_temp.as_user('60000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_error($q$select public.complete_gym_session(current_setting('t.sA')::uuid, '{}'::uuid[], false)$q$, 'Marca al menos un ejercicio', 'sin ejercicios marcados');
select pg_temp.expect_error($q$select public.complete_gym_session(current_setting('t.sA')::uuid, array[current_setting('t.eBench')::uuid], false)$q$,
  'Hay ejercicios que no son de esta sesión', 'ejercicio de otra sesión');
select pg_temp.expect_ok($q$select set_config('t.logA', public.complete_gym_session(current_setting('t.sA')::uuid, array[current_setting('t.eSq')::uuid], false)::text, true)$q$,
  'A1 marca un ejercicio suelto');
select pg_temp.expect_eq($q$select completed_all || '/' || cardinality(exercise_ids) || '/' || minutes || '/' || (performed_on = current_setting('t.today')::date) from public.gym_session_logs where id = current_setting('t.logA')::uuid$q$,
  'false/1/60/true', 'ejercicios sueltos: no completa, 1 ejercicio, 60 min, hoy');
select pg_temp.expect_eq($q$select (public.complete_gym_session(current_setting('t.sA')::uuid, null, true) = current_setting('t.logA')::uuid)::text$q$,
  'true', '"Hice la sesión completa" corrige el mismo registro');
select pg_temp.expect_eq($q$select completed_all || '/' || cardinality(exercise_ids) from public.gym_session_logs where id = current_setting('t.logA')::uuid$q$,
  'true/3', 'sesión completa: los 3 ejercicios');
select pg_temp.expect_ok($q$select set_config('t.logB', public.complete_gym_session(current_setting('t.sB')::uuid, null, true)::text, true)$q$, 'sesión de hace 2 días: en plazo');
select pg_temp.expect_error($q$select public.complete_gym_session(current_setting('t.sC')::uuid, null, true)$q$, 'Ya pasó el plazo para marcar esta sesión', 'sesión de hace 3 días: fuera de plazo');
-- Sesión propia
select pg_temp.expect_ok($q$select set_config('t.logOwn', public.log_own_gym_session(current_setting('t.today')::date, 45::smallint, 6::smallint, 'Por mi cuenta')::text, true)$q$, 'sesión propia hoy');
select pg_temp.expect_ok($q$select public.log_own_gym_session(current_setting('t.today')::date - 2, 30::smallint, null, null)$q$, 'sesión propia hace 2 días');
select pg_temp.expect_error($q$select public.log_own_gym_session(current_setting('t.today')::date - 3, 30::smallint, null, null)$q$, 'La fecha puede ser hoy o hasta 2 días atrás', 'sesión propia hace 3 días');
select pg_temp.expect_error($q$select public.log_own_gym_session(current_setting('t.today')::date, 5::smallint, null, null)$q$, 'La duración va de 10 a 240 minutos', 'sesión propia de 5 min');
-- Pendientes: los registros sin esfuerzo (Sesión A, Sesión B y la propia de hace 2 días).
select pg_temp.expect_count($q$select 1 from public.my_pending_reports('15') where kind = 'gym'$q$, 3, 'pendientes: 3 sesiones de gimnasio sin esfuerzo');
select pg_temp.expect_count($q$select 1 from public.my_pending_reports('7') where kind = 'gym'$q$, 3, 'el gimnasio no tiene formato');
-- Esfuerzo
select pg_temp.expect_ok($q$select public.submit_gym_rpe(current_setting('t.logA')::uuid, 7::smallint)$q$, 'A1 registra el esfuerzo');
select pg_temp.expect_ok($q$select public.submit_gym_rpe(current_setting('t.logA')::uuid, 8::smallint)$q$, 'A1 corrige el esfuerzo');
select pg_temp.expect_error($q$select public.submit_gym_rpe(current_setting('t.logA')::uuid, 11::smallint)$q$, 'Elige un valor de 0 a 10', 'esfuerzo 11');
select pg_temp.expect_count($q$select 1 from public.my_pending_reports('15') where kind = 'gym'$q$, 2, 'con esfuerzo, sale de pendientes');
select pg_temp.expect_eq($q$select (public.my_gym_log_summary(current_setting('t.logA')::uuid)->>'done_exercises') || '/' || (public.my_gym_log_summary(current_setting('t.logA')::uuid)->>'total_exercises')$q$,
  '3/3', 'resumen: ejercicios hechos');
select pg_temp.expect_ok($q$select public.my_gym_week(date_trunc('week', current_setting('t.today')::date)::date)$q$, 'mi semana');
select pg_temp.expect_error($q$select public.my_gym_week(date_trunc('week', current_setting('t.today')::date)::date + 1)$q$, 'La semana empieza un lunes', 'mi semana desde un martes');
select pg_temp.expect_no_rows($q$update public.gym_session_logs set rpe = 0$q$, 'A1 cambia su registro directo');
select pg_temp.back();

-- Fuera de plazo para el esfuerzo (como postgres, se mueve un registro 3 días atrás).
update public.gym_session_logs set performed_on = current_setting('t.today')::date - 3 where id = current_setting('t.logB')::uuid;
select pg_temp.as_user('60000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_error($q$select public.submit_gym_rpe(current_setting('t.logB')::uuid, 5::smallint)$q$, 'Ya pasó el plazo para responder', 'esfuerzo fuera de plazo');
select pg_temp.back();
update public.gym_session_logs set performed_on = current_setting('t.today')::date - 2 where id = current_setting('t.logB')::uuid;

-- Otro jugador no puede marcar ni responder lo de A1.
select pg_temp.as_user('61000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_error($q$select public.complete_gym_session(current_setting('t.sA')::uuid, null, true)$q$, 'Este plan no está asignado a ti', 'A2 marca una sesión que no le toca');
select pg_temp.expect_error($q$select public.submit_gym_rpe(current_setting('t.logA')::uuid, 5::smallint)$q$, 'not_found', 'A2 responde el registro de A1');
select pg_temp.expect_error($q$select public.my_gym_log_summary(current_setting('t.logA')::uuid)$q$, 'not_found', 'A2 lee el resumen de A1');
select pg_temp.expect_count($q$select 1 from public.gym_session_logs$q$, 0, 'A2 no ve los registros de A1');
select pg_temp.expect_count($q$select 1 from public.gym_plans$q$, 0, 'el jugador no lee los planes directo');
select pg_temp.expect_count($q$select 1 from public.gym_plan_exercises$q$, 0, 'el jugador no lee los ejercicios directo');
select pg_temp.expect_fail($q$select public.player_gym_summary('a1d00000-0000-0000-0000-000000000001')$q$, 'A2 ve el gimnasio de A1');
select pg_temp.expect_fail($q$select * from public.gym_adherence(current_setting('t.from')::date, current_setting('t.to')::date)$q$, 'el jugador ve el cumplimiento del plantel');
select pg_temp.expect_fail($q$select * from public.team_load_breakdown('15')$q$, 'el jugador ve el desglose del plantel');
select pg_temp.expect_fail($q$select * from public.gym_plan_progress()$q$, 'el jugador ve el avance de los planes');
select pg_temp.back();

-- =======================================================================
-- 5. Carga semanal con el gimnasio
-- =======================================================================
-- A1 esta semana: Sesión A 8 × 60 = 480 + propia 6 × 45 = 270 (hoy). Sesión B y la propia de
-- hace 2 días no tienen esfuerzo y no suman.
select pg_temp.as_user('55000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_eq($q$select (public.player_weekly_load('a1d00000-0000-0000-0000-000000000001')->'weeks'->-1->>'gimnasio')$q$,
  '750', 'la semana suma el gimnasio (8 × 60 + 6 × 45)');
select pg_temp.expect_eq($q$select (public.player_weekly_load('a1d00000-0000-0000-0000-000000000001')->>'current_load')$q$,
  '750', 'la carga actual incluye el gimnasio');
select pg_temp.expect_eq($q$select (public.player_weekly_load('a1d00000-0000-0000-0000-000000000001', 6, '7')->>'current_load')$q$,
  '750', 'el gimnasio cuenta también en Sevens');
select pg_temp.expect_count($q$select 1 from jsonb_array_elements(public.player_weekly_load('a1d00000-0000-0000-0000-000000000001')->'current_sessions') x where x->>'kind' = 'gimnasio'$q$,
  2, 'sesiones de la semana: 2 de gimnasio');
select pg_temp.expect_eq($q$select current_load::text from public.team_srpe_load('15') where player_id = 'a1d00000-0000-0000-0000-000000000001'$q$, '750', 'team_srpe_load suma el gimnasio');
select pg_temp.expect_eq($q$select cancha || '/' || gimnasio || '/' || partido from public.team_load_breakdown('15') where player_id = 'a1d00000-0000-0000-0000-000000000001'$q$, '0/750/0', 'desglose por tipo');
select pg_temp.expect_eq($q$select done::text from public.gym_adherence(current_setting('t.today')::date, current_setting('t.today')::date) where player_id = 'a1d00000-0000-0000-0000-000000000001'$q$,
  '1', 'cumplimiento de hoy: 1 hecha');
select pg_temp.expect_eq($q$select assigned::text from public.gym_adherence(current_setting('t.today')::date, current_setting('t.today')::date) where player_id = 'a1d00000-0000-0000-0000-000000000001'$q$,
  '2', 'cumplimiento de hoy: 2 asignadas (Sesión A y Sesión P)');
select pg_temp.expect_eq($q$select jsonb_array_length(public.player_gym_summary('a1d00000-0000-0000-0000-000000000001')->'recent')::text$q$, '4', 'ficha: últimos registros');
select pg_temp.expect_count($q$select 1 from public.gym_session_logs$q$, 4, 'el staff ve los registros del club');
-- Avance por plan (20261105202000): P1 lo reciben los 2 pilares. Cuenta desde que se
-- publicó (hoy): la Sesión A de hoy está hecha; la B de hace 2 días queda fuera.
select pg_temp.expect_eq($q$select players || '/' || done from public.gym_plan_progress() where plan_id = current_setting('t.p1id')::uuid$q$,
  '2/1', 'avance de P1: 2 jugadores, 1 sesión hecha desde que se publicó');
select pg_temp.expect_eq($q$select players || '/' || assigned from public.gym_plan_progress() where plan_id = current_setting('t.pEmpty')::uuid$q$,
  '0/0', 'borrador sin destinatarios: sin jugadores ni sesiones');
select pg_temp.back();

-- =======================================================================
-- 6. Aislamiento entre planteles
-- =======================================================================
select pg_temp.as_user('10000000-0000-0000-0000-0000000000d2');
select pg_temp.expect_count($q$select 1 from public.gym_plans$q$, 0, 'head coach B no ve los planes de A');
select pg_temp.expect_count($q$select 1 from public.gym_session_logs$q$, 0, 'head coach B no ve los registros de A');
select pg_temp.expect_state($q$select public.publish_gym_plan(current_setting('t.p1id')::uuid)$q$, 'P0001', 'head coach B publica un plan de A (not_found)');
select pg_temp.expect_error($q$select public.archive_gym_plan(current_setting('t.p1id')::uuid)$q$, 'not_found', 'head coach B archiva un plan de A');
select pg_temp.expect_error($q$select public.save_gym_plan(jsonb_set(current_setting('t.p1')::jsonb, '{id}', to_jsonb(current_setting('t.p1id'))))$q$, 'not_found', 'head coach B edita un plan de A');
select pg_temp.expect_fail($q$select public.player_gym_summary('a1d00000-0000-0000-0000-000000000001')$q$, 'head coach B ve el gimnasio de A1');
select pg_temp.expect_count($q$select 1 from public.gym_adherence(current_setting('t.from')::date, current_setting('t.to')::date) where player_id::text like 'a1d%'$q$, 0, 'head coach B no ve el cumplimiento de A');
select pg_temp.expect_count($q$select 1 from public.gym_plan_progress()$q$, 0, 'head coach B no ve el avance de los planes de A');
select pg_temp.back();
select pg_temp.as_user('60000000-0000-0000-0000-0000000000d2');
select pg_temp.expect_error($q$select public.complete_gym_session(current_setting('t.sA')::uuid, null, true)$q$, 'not_found', 'jugador B marca una sesión de A');
select pg_temp.expect_error($q$select public.submit_gym_rpe(current_setting('t.logA')::uuid, 5::smallint)$q$, 'not_found', 'jugador B responde un registro de A');
select pg_temp.expect_eq($q$select jsonb_array_length(public.my_gym_today()->'sessions')::text$q$, '0', 'jugador B no ve sesiones de A');
select pg_temp.back();

-- =======================================================================
-- 7. Archivar y navegación
-- =======================================================================
select pg_temp.as_user('55000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_ok($q$select public.archive_gym_plan(current_setting('t.p3id')::uuid)$q$, 'preparador físico archiva un plan');
select pg_temp.expect_error($q$select public.publish_gym_plan(current_setting('t.p3id')::uuid)$q$, 'El plan está archivado', 'un plan archivado no se publica');
select pg_temp.back();   -- private.nav_allowed_screens: como postgres, con la sesión del preparador físico
select pg_temp.expect_eq($q$select ('planes' = any (private.nav_allowed_screens('aaaaaaaa-0000-0000-0000-0000000000d1')))::text$q$, 'true', 'preparador físico: planes en la barra');
select pg_temp.as_user('61000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_count($q$select 1 from jsonb_array_elements(public.my_gym_today()->'sessions') s where s->>'label' = 'Sesión S'$q$, 0, 'plan archivado: ya no aparece');
select pg_temp.back();
select pg_temp.as_user('20000000-0000-0000-0000-0000000000d1');
select pg_temp.back();
select pg_temp.expect_eq($q$select ('planes' = any (private.nav_allowed_screens('aaaaaaaa-0000-0000-0000-0000000000d1')))::text$q$, 'false', 'manager: sin planes');
select pg_temp.as_user('20000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_fail($q$select public.set_nav_slots(array['resumen', 'calendario', 'plantel', 'planes'])$q$, 'manager pone planes en su barra');
select pg_temp.back();
select pg_temp.as_user('60000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_ok($q$select public.set_nav_slots(array['resumen', 'calendario', 'mi_plan'])$q$, 'jugador pone Mi plan en su barra');
select pg_temp.expect_fail($q$select public.set_nav_slots(array['resumen', 'calendario', 'planes'])$q$, 'jugador pone planes en su barra');
select pg_temp.back();

-- =======================================================================
-- 8. Bloques, superseries e intensidad por tiempo (20261105210000)
-- =======================================================================
-- P5 (Pilares, hoy): bloque Calentamiento con plancha de 60 s y bloque Principal con una
-- superserie de dos ejercicios y uno suelto.
select set_config('t.p5', jsonb_build_object(
  'name', 'Bloques', 'starts_on', current_setting('t.from'), 'ends_on', current_setting('t.to'),
  'targets', jsonb_build_array(jsonb_build_object('kind', 'posicion', 'position_id', current_setting('t.pilar'))),
  'exclusions', '[]'::jsonb,
  'sessions', jsonb_build_array(
    jsonb_build_object('label', 'Sesión T', 'weekday', current_setting('t.dow0')::int, 'est_minutes', 50, 'exercises', jsonb_build_array(
      jsonb_build_object('name', 'Plancha', 'sets', 3, 'reps', '10', 'intensity_type', 'tiempo', 'seconds', 60, 'block', ' Calentamiento '),
      jsonb_build_object('name', 'Press banca', 'sets', 4, 'reps', '6', 'intensity_type', 'kg', 'kg', 60, 'block', 'Principal', 'superset', 1),
      jsonb_build_object('name', 'Remo con barra', 'sets', 4, 'reps', '8', 'intensity_type', 'bw', 'block', 'Principal', 'superset', 1),
      jsonb_build_object('name', 'Sentadilla búlgara', 'sets', 3, 'reps', '10', 'intensity_type', 'rpe', 'rpe', 7, 'block', 'Principal'))))
)::text, true);
select pg_temp.as_user('10000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_ok($q$select set_config('t.p5id', public.save_gym_plan(current_setting('t.p5')::jsonb)::text, true)$q$, 'guarda un plan con bloques, superserie y tiempo');
select pg_temp.expect_error($q$select public.save_gym_plan(jsonb_set(current_setting('t.p5')::jsonb, '{sessions,0,exercises,0,seconds}', 'null'))$q$,
  'El tiempo va de 5 segundos a 60 minutos (Plancha)', 'tiempo sin segundos');
select pg_temp.expect_error($q$select public.save_gym_plan(jsonb_set(current_setting('t.p5')::jsonb, '{sessions,0,exercises,0,seconds}', '4'))$q$,
  'El tiempo va de 5 segundos a 60 minutos (Plancha)', 'tiempo bajo 5 s');
select pg_temp.expect_error($q$select public.save_gym_plan(jsonb_set(current_setting('t.p5')::jsonb, '{sessions,0,exercises,2,reps}', '""'))$q$,
  'Revisa las repeticiones (Remo con barra)', 'sin reps fuera de tiempo');
select pg_temp.expect_error($q$select public.save_gym_plan(jsonb_set(current_setting('t.p5')::jsonb, '{sessions,0,exercises,1,superset}', '31'))$q$,
  'Revisa la superserie (Press banca)', 'superserie fuera de rango');
select pg_temp.expect_fail($q$select public.save_gym_plan(jsonb_set(current_setting('t.p5')::jsonb, '{sessions,0,exercises,1,block}', to_jsonb(repeat('x', 41))))$q$,
  'bloque de más de 40 caracteres');
select pg_temp.expect_ok($q$select public.publish_gym_plan(current_setting('t.p5id')::uuid)$q$, 'publica P5');
select pg_temp.back();
select pg_temp.expect_eq($q$select string_agg(concat_ws('|', e.name, e.intensity_type, coalesce(e.reps, '-'), coalesce(e.seconds::text, '-'), coalesce(e.block, '-'), coalesce(e.superset::text, '-')), ';' order by e.sort)
  from public.gym_plan_exercises e join public.gym_plan_sessions gs on gs.id = e.session_id
 where gs.plan_id = current_setting('t.p5id')::uuid and e.archived_at is null$q$,
  'Plancha|tiempo|-|60|Calentamiento|-;Press banca|kg|6|-|Principal|1;Remo con barra|bw|8|-|Principal|1;Sentadilla búlgara|rpe|10|-|Principal|-',
  'P5 guarda bloque, superserie y tiempo (sin reps en la plancha)');
select pg_temp.expect_fail($q$insert into public.gym_plan_exercises (club_id, session_id, name, sets, reps, intensity_type)
  select gs.club_id, gs.id, 'Sin tiempo', 3, null, 'tiempo' from public.gym_plan_sessions gs where gs.plan_id = current_setting('t.p5id')::uuid limit 1$q$,
  'check: tiempo exige segundos');
select pg_temp.expect_fail($q$insert into public.gym_plan_exercises (club_id, session_id, name, sets, reps, intensity_type)
  select gs.club_id, gs.id, 'Sin reps', 3, null, 'bw' from public.gym_plan_sessions gs where gs.plan_id = current_setting('t.p5id')::uuid limit 1$q$,
  'check: reps obligatorias fuera de tiempo');
-- El jugador recibe bloque, superserie y segundos.
select pg_temp.as_user('60000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_eq($q$select string_agg(concat_ws('|', x->>'name', coalesce(x->>'seconds', '-'), coalesce(x->>'block', '-'), coalesce(x->>'superset', '-')), ';' order by (x->>'sort')::int)
  from jsonb_array_elements(public.my_gym_today()->'sessions') s, jsonb_array_elements(s->'exercises') x where s->>'label' = 'Sesión T'$q$,
  'Plancha|60|Calentamiento|-;Press banca|-|Principal|1;Remo con barra|-|Principal|1;Sentadilla búlgara|-|Principal|-',
  'my_gym_today trae bloque, superserie y segundos');
select pg_temp.back();

-- Funciones: SECURITY DEFINER, search_path vacío, authenticated sí y anon no
select pg_temp.expect_count($q$select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace
  and p.proname in ('save_gym_plan', 'publish_gym_plan', 'archive_gym_plan', 'complete_gym_session', 'log_own_gym_session',
                    'submit_gym_rpe', 'my_gym_today', 'my_gym_week', 'my_gym_log_summary', 'team_load_breakdown',
                    'gym_adherence', 'player_gym_summary', 'gym_plan_progress')
  and p.prosecdef and p.proconfig = array['search_path=""']
  and has_function_privilege('authenticated', p.oid, 'EXECUTE') and not has_function_privilege('anon', p.oid, 'EXECUTE')$q$, 13,
  'gimnasio: 13 funciones solo para authenticated');
select pg_temp.expect_count($q$select 1 from pg_proc p where p.pronamespace = 'private'::regnamespace
  and p.proname in ('gym_plan_players', 'gym_assignments', 'gym_last_max', 'gym_session_exercises', 'gym_planner_club',
                    'gym_kg_test', 'gym_in_window', 'load_sessions', 'chile_today', 'gym_round_kg')
  and not has_function_privilege('authenticated', p.oid, 'EXECUTE')$q$, 10,
  'los helpers del gimnasio no los ejecuta authenticated');

select 'OK: gym_plan_test' as resultado;
rollback;
