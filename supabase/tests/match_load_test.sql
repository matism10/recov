-- Recov · Pruebas de nóminas y carga del plantel (0027, 0028, 0029)
-- Correr en el SQL Editor de Supabase (o por execute_sql) DESPUÉS de las migraciones
-- 0001 a 0029. Todo va en una transacción que termina en ROLLBACK: no deja datos.
-- Si algo falla, se detiene con "FAIL: ...".
--
-- Cubre: aislamiento entre clubes; quién escribe (head coach, manager, delegado) y
-- quién no (entrenador, nutri, pf, kine, jugador, anónimo); el jugador lee solo lo
-- suyo; validación según el modo; derivación de rangos y puntos medios en rugby y
-- hockey; semáforo en los tres modos; modo cambiado con datos previos; quitar de
-- la convocatoria archiva sin borrar; nómina por puestos (titulares y banca).

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
create function pg_temp.expect_fail(q text, label text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    return;
  end;
  raise exception 'FAIL: % (debía fallar y no falló)', label;
end $$;
create function pg_temp.expect_ok(q text, label text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    raise exception 'FAIL: % (debía funcionar y falló: %)', label, sqlerrm;
  end;
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
-- Total y estado de un jugador en team_match_load(4). Se llama con un rol de staff.
create function pg_temp.expect_load(p_name text, p_total numeric, p_status text, label text)
returns void language plpgsql as $$
declare v jsonb;
begin
  select p into v from jsonb_array_elements(public.team_match_load(4) -> 'players') p
   where p ->> 'full_name' = p_name;
  if v is null then raise exception 'FAIL: % (sin fila para %)', label, p_name; end if;
  if (v ->> 'total')::numeric <> p_total or (v ->> 'status') is distinct from p_status then
    raise exception 'FAIL: % (esperado total % y estado %, hay % y %)',
      label, p_total, p_status, v ->> 'total', v ->> 'status';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Datos: club A (rugby) y club B (hockey)
-- ---------------------------------------------------------------------
insert into public.clubs (id, name, sport, slug) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'Rugby Test',  'rugby',  'rugby-test'),
  ('bbbbbbbb-0000-0000-0000-0000000000b1', 'Hockey Test', 'hockey', 'hockey-test');
insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-0000000000a1', 'hc@rugby.test'),
  ('20000000-0000-0000-0000-0000000000a1', 'manager@rugby.test'),
  ('30000000-0000-0000-0000-0000000000a1', 'kine@rugby.test'),
  ('40000000-0000-0000-0000-0000000000a1', 'coach@rugby.test'),
  ('41000000-0000-0000-0000-0000000000a1', 'coach2@rugby.test'),
  ('50000000-0000-0000-0000-0000000000a1', 'nutri@rugby.test'),
  ('51000000-0000-0000-0000-0000000000a1', 'pf@rugby.test'),
  ('60000000-0000-0000-0000-0000000000a1', 'p1@rugby.test'),
  ('60000000-0000-0000-0000-0000000000a2', 'p2@rugby.test'),
  ('10000000-0000-0000-0000-0000000000b1', 'hc@hockey.test'),
  ('60000000-0000-0000-0000-0000000000b1', 'p1@hockey.test');
insert into public.profiles (id, club_id, roles, full_name, status) values
  ('10000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000a1', '{head_coach}',        'HC Rugby',      'confirmado'),
  ('20000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000a1', '{manager}',           'Manager Rugby', 'confirmado'),
  ('30000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000a1', '{kinesiologo}',       'Kine Rugby',    'confirmado'),
  ('40000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000a1', '{entrenador}',        'Coach Rugby',   'confirmado'),
  ('41000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000a1', '{entrenador}',        'Delegado',      'confirmado'),
  ('50000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000a1', '{nutricionista}',     'Nutri Rugby',   'confirmado'),
  ('51000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000a1', '{preparador_fisico}', 'PF Rugby',      'confirmado'),
  ('60000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000a1', '{jugador}',           'P1',            'confirmado'),
  ('60000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-0000000000a1', '{jugador}',           'P2',            'confirmado'),
  ('10000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-0000000000b1', '{head_coach}',        'HC Hockey',     'confirmado'),
  ('60000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-0000000000b1', '{jugador}',           'H1',            'confirmado');
-- Desde 0039 insertar en profiles ya no crea la membresía: se crea aquí (preparación).
insert into public.club_members (user_id, club_id, roles, status, requested_role)
select id, club_id, roles, status, requested_role from public.profiles on conflict do nothing;
insert into public.players (id, club_id, full_name, position, status, user_id) values
  ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'P1', 'Pilar',    'confirmado', '60000000-0000-0000-0000-0000000000a1'),
  ('a1000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'P2', 'Hooker',   'confirmado', '60000000-0000-0000-0000-0000000000a2'),
  ('a1000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'P3', 'Flanker',  'confirmado', null),
  ('a1000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'P4', 'Apertura', 'confirmado', null),
  ('a1000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'P5', 'Centro',   'confirmado', null),
  ('a1000000-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'Pendiente', 'Pilar', 'pendiente', null),
  ('b1000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-0000000000b1', 'H1', 'Portero',  'confirmado', '60000000-0000-0000-0000-0000000000b1');
-- Eventos: 4 partidos pasados, uno futuro y un entrenamiento pasado (club A); un partido pasado (club B).
insert into public.events (id, club_id, type, starts_at, ends_at, opponent, created_by) values
  ('e0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'competencia', now() - interval '30 days', now() - interval '30 days' + interval '2 hours', 'Rival 1', '10000000-0000-0000-0000-0000000000a1'),
  ('e0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'competencia', now() - interval '20 days', now() - interval '20 days' + interval '2 hours', 'Rival 2', '10000000-0000-0000-0000-0000000000a1'),
  ('e0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'competencia', now() - interval '10 days', now() - interval '10 days' + interval '2 hours', 'Rival 3', '10000000-0000-0000-0000-0000000000a1'),
  ('e0000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'competencia', now() - interval '5 days',  now() - interval '5 days'  + interval '2 hours', 'Rival 4', '10000000-0000-0000-0000-0000000000a1'),
  ('e0000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'competencia', now() + interval '5 days',  now() + interval '5 days'  + interval '2 hours', 'Rival 5', '10000000-0000-0000-0000-0000000000a1'),
  ('e0000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'entrenamiento', now() - interval '3 days', now() - interval '3 days' + interval '2 hours', null, '10000000-0000-0000-0000-0000000000a1'),
  ('e0000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-0000000000b1', 'competencia', now() - interval '7 days',  now() - interval '7 days'  + interval '2 hours', 'Rival H', '10000000-0000-0000-0000-0000000000b1');

-- =======================================================================
-- 1. Escala por deporte: etiquetas, puntos medios y derivación del rango
-- =======================================================================
select pg_temp.expect_count($q$select 1 from (select string_agg(midpoint::text, ',' order by bucket) m,
  string_agg(label, ',' order by bucket) l from public.sport_load_scale('rugby')) s
  where m = '0,10,30,50,70' and l = 'No jugó,<20,20-40,40-60,60+'$q$, 1, 'rugby: puntos medios 0,10,30,50,70 y etiquetas');
select pg_temp.expect_count($q$select 1 from (select string_agg(midpoint::text, ',' order by bucket) m,
  string_agg(label, ',' order by bucket) l from public.sport_load_scale('hockey')) s
  where m = '0,8,23,38,53' and l = 'No jugó,<15,15-30,30-45,45+'$q$, 1, 'hockey: puntos medios 0,8,23,38,53 y etiquetas');
select pg_temp.expect_count($q$select 1 from (select string_agg(label, ',' order by bucket) l from public.sport_load_scale('futsal')) s
  where l = 'No jugó,<10,10-20,20-30,30+'$q$, 1, 'futsal: etiquetas desde los cortes');
select pg_temp.expect_count($q$select 1 where
      private.load_bucket('rugby', 0) = 0 and private.load_bucket('rugby', 1) = 1
  and private.load_bucket('rugby', 19) = 1 and private.load_bucket('rugby', 20) = 2
  and private.load_bucket('rugby', 39) = 2 and private.load_bucket('rugby', 40) = 3
  and private.load_bucket('rugby', 59) = 3 and private.load_bucket('rugby', 60) = 4
  and private.load_bucket('rugby', 100) = 4$q$, 1, 'rugby: derivación del rango desde los minutos');
select pg_temp.expect_count($q$select 1 where
      private.load_bucket('hockey', 14) = 1 and private.load_bucket('hockey', 15) = 2
  and private.load_bucket('hockey', 30) = 3 and private.load_bucket('hockey', 45) = 4$q$, 1, 'hockey: derivación del rango desde los minutos');
select pg_temp.expect_count($q$select 1 from public.sports where match_minutes is null or max_minutes is null$q$, 0, 'los 7 deportes tienen configuración de carga');
select pg_temp.expect_count($q$select 1 from public.sports$q$, 7, 'siguen siendo 7 deportes');
select pg_temp.expect_fail($q$update public.sports set bucket3_from = 10 where slug = 'rugby'$q$, 'cortes desordenados (CHECK)');
select pg_temp.expect_count($q$select 1 from public.clubs where id = 'aaaaaaaa-0000-0000-0000-0000000000a1' and nomina_mode = 'rango'$q$, 1, 'el modo por defecto es rango');

-- =======================================================================
-- 2. Quién arma la convocatoria y quién cambia el modo
-- =======================================================================
select pg_temp.as_user('40000000-0000-0000-0000-0000000000a1');   -- entrenador
select pg_temp.expect_fail($q$select public.set_event_callups('e0000000-0000-0000-0000-000000000001', array['a1000000-0000-0000-0000-000000000001']::uuid[])$q$, 'entrenador arma la convocatoria');
select pg_temp.expect_fail($q$select public.set_nomina_mode('exacto')$q$, 'entrenador cambia el modo');
select pg_temp.back();
select pg_temp.as_user('50000000-0000-0000-0000-0000000000a1');   -- nutri
select pg_temp.expect_fail($q$select public.set_event_callups('e0000000-0000-0000-0000-000000000001', array['a1000000-0000-0000-0000-000000000001']::uuid[])$q$, 'nutricionista arma la convocatoria');
select pg_temp.back();
select pg_temp.as_user('51000000-0000-0000-0000-0000000000a1');   -- pf
select pg_temp.expect_fail($q$select public.set_event_callups('e0000000-0000-0000-0000-000000000001', array['a1000000-0000-0000-0000-000000000001']::uuid[])$q$, 'preparador físico arma la convocatoria');
select pg_temp.back();
select pg_temp.as_user('30000000-0000-0000-0000-0000000000a1');   -- kine
select pg_temp.expect_fail($q$select public.set_event_callups('e0000000-0000-0000-0000-000000000001', array['a1000000-0000-0000-0000-000000000001']::uuid[])$q$, 'kine arma la convocatoria');
select pg_temp.expect_fail($q$select public.set_nomina_delegate('41000000-0000-0000-0000-0000000000a1')$q$, 'kine asigna el delegado de nóminas');
select pg_temp.back();
select pg_temp.as_user('60000000-0000-0000-0000-0000000000a1');   -- jugador
select pg_temp.expect_fail($q$select public.set_event_callups('e0000000-0000-0000-0000-000000000001', array['a1000000-0000-0000-0000-000000000001']::uuid[])$q$, 'jugador arma la convocatoria');
select pg_temp.expect_fail($q$select public.set_nomina_mode('jugo')$q$, 'jugador cambia el modo');
select pg_temp.back();
select pg_temp.as_anon();
select pg_temp.expect_fail($q$select public.set_event_callups('e0000000-0000-0000-0000-000000000001', '{}')$q$, 'anónimo arma la convocatoria');
select pg_temp.expect_fail($q$select public.team_match_load(4)$q$, 'anónimo lee la carga del plantel');
select pg_temp.expect_fail($q$select public.my_match_load()$q$, 'anónimo lee una carga propia');
select pg_temp.expect_fail($q$select 1 from public.event_callups$q$, 'anónimo lee convocatorias');
select pg_temp.back();
select pg_temp.as_user('41000000-0000-0000-0000-0000000000a1');   -- futuro delegado, aún sin delegación
select pg_temp.expect_fail($q$select public.set_event_callups('e0000000-0000-0000-0000-000000000001', array['a1000000-0000-0000-0000-000000000001']::uuid[])$q$, 'entrenador sin delegación arma la convocatoria');
select pg_temp.back();

select pg_temp.as_user('10000000-0000-0000-0000-0000000000a1');   -- head coach
select pg_temp.expect_fail($q$select public.set_nomina_delegate('60000000-0000-0000-0000-0000000000a1')$q$, 'delegar en un jugador');
select pg_temp.expect_fail($q$select public.set_nomina_delegate('10000000-0000-0000-0000-0000000000b1')$q$, 'delegar en alguien de otro club');
select pg_temp.expect_ok($q$select public.set_nomina_delegate('41000000-0000-0000-0000-0000000000a1')$q$, 'head coach delega las nóminas');
select pg_temp.expect_fail($q$select public.set_event_callups('e0000000-0000-0000-0000-000000000006', array['a1000000-0000-0000-0000-000000000001']::uuid[])$q$, 'convocar a un entrenamiento');
select pg_temp.expect_fail($q$select public.set_event_callups('e0000000-0000-0000-0000-0000000000b1', array['a1000000-0000-0000-0000-000000000001']::uuid[])$q$, 'convocar a un evento del club B');
select pg_temp.expect_fail($q$select public.set_event_callups('e0000000-0000-0000-0000-000000000001', array['b1000000-0000-0000-0000-000000000001']::uuid[])$q$, 'convocar a un jugador del club B');
select pg_temp.expect_fail($q$select public.set_event_callups('e0000000-0000-0000-0000-000000000001', array['a1000000-0000-0000-0000-000000000009']::uuid[])$q$, 'convocar a un jugador pendiente');
select pg_temp.expect_ok($q$select public.set_event_callups('e0000000-0000-0000-0000-000000000001', array[
  'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003']::uuid[])$q$, 'head coach convoca al partido 1');
select pg_temp.expect_ok($q$select public.set_event_callups('e0000000-0000-0000-0000-000000000005', array['a1000000-0000-0000-0000-000000000001']::uuid[])$q$, 'head coach convoca a un partido futuro');
select pg_temp.expect_no_rows($q$update public.event_callups set removed_at = now()$q$, 'head coach edita convocatorias directo');
select pg_temp.expect_fail($q$insert into public.event_callups (club_id, event_id, player_id)
  values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001')$q$, 'head coach inserta convocatorias directo');
select pg_temp.back();

select pg_temp.as_user('41000000-0000-0000-0000-0000000000a1');   -- delegado
select pg_temp.expect_ok($q$select public.set_event_callups('e0000000-0000-0000-0000-000000000002', array[
  'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000004']::uuid[])$q$, 'el delegado convoca al partido 2');
select pg_temp.expect_fail($q$select public.set_nomina_mode('exacto')$q$, 'el delegado cambia el modo');
select pg_temp.back();

select pg_temp.as_user('20000000-0000-0000-0000-0000000000a1');   -- manager
select pg_temp.expect_ok($q$select public.set_event_callups('e0000000-0000-0000-0000-000000000003', array[
  'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000004']::uuid[])$q$, 'manager convoca al partido 3');
select pg_temp.back();

-- =======================================================================
-- 3. Validación según el modo
-- =======================================================================
select pg_temp.as_user('10000000-0000-0000-0000-0000000000a1');
-- rango (modo por defecto)
select pg_temp.expect_fail($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000001',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","minutes":80}]')$q$, 'rango: rechaza minutos');
select pg_temp.expect_fail($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000001',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","played":true}]')$q$, 'rango: rechaza jugó');
select pg_temp.expect_fail($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000001',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001"}]')$q$, 'rango: exige el rango');
select pg_temp.expect_fail($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000001',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","range_bucket":5}]')$q$, 'rango: rango fuera de 0 a 4');
select pg_temp.expect_fail($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000001',
  '[{"player_id":"a1000000-0000-0000-0000-000000000005","range_bucket":2}]')$q$, 'participación de un no convocado');
select pg_temp.expect_fail($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000005',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","range_bucket":2}]')$q$, 'participación de un partido que no empieza');
select pg_temp.expect_fail($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000006', '[]')$q$, 'participación de un entrenamiento');
select pg_temp.expect_fail($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000001',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","range_bucket":2},
    {"player_id":"a1000000-0000-0000-0000-000000000002","range_bucket":9}]')$q$, 'lote con una fila inválida');
select pg_temp.expect_count($q$select 1 from public.event_participations$q$, 0, 'el lote inválido no guarda nada');
select pg_temp.expect_ok($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000001',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","range_bucket":2}]')$q$, 'rango: guarda el rango');
select pg_temp.expect_count($q$select 1 from public.event_participations
  where mode = 'rango' and range_bucket = 2 and played and minutes is null$q$, 1, 'rango: jugó se deriva y los minutos quedan nulos');
select pg_temp.expect_ok($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000001',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","range_bucket":0}]')$q$, 'rango: rango 0');
select pg_temp.expect_count($q$select 1 from public.event_participations where range_bucket = 0 and not played$q$, 1, 'rango 0 = no jugó (y se actualiza la misma fila)');
select pg_temp.back();

-- jugo
select pg_temp.as_user('20000000-0000-0000-0000-0000000000a1');   -- manager cambia el modo
select pg_temp.expect_ok($q$select public.set_nomina_mode('jugo')$q$, 'manager cambia el modo a jugó');
select pg_temp.back();
select pg_temp.as_user('10000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_fail($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000001',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","minutes":10}]')$q$, 'jugó: rechaza minutos');
select pg_temp.expect_fail($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000001',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","range_bucket":1}]')$q$, 'jugó: rechaza rango');
select pg_temp.expect_fail($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000001',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","played":"si"}]')$q$, 'jugó: exige un booleano');
select pg_temp.expect_ok($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000001',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","played":true}]')$q$, 'jugó: guarda');
select pg_temp.expect_count($q$select 1 from public.event_participations
  where mode = 'jugo' and played and minutes is null and range_bucket is null$q$, 1, 'jugó: minutos y rango quedan nulos');
select pg_temp.back();

-- exacto
select pg_temp.as_user('10000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_ok($q$select public.set_nomina_mode('exacto')$q$, 'head coach cambia el modo a exacto');
select pg_temp.expect_fail($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000001',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","range_bucket":2}]')$q$, 'exacto: rechaza rango');
select pg_temp.expect_fail($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000001',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","minutes":80,"played":true}]')$q$, 'exacto: rechaza jugó');
select pg_temp.expect_fail($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000001',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","minutes":101}]')$q$, 'exacto: más que el tope de rugby (100)');
select pg_temp.expect_fail($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000001',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","minutes":-1}]')$q$, 'exacto: minutos negativos');
select pg_temp.expect_fail($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000001',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","minutes":12.5}]')$q$, 'exacto: minutos con decimales');
select pg_temp.expect_ok($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000001',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","minutes":100}]')$q$, 'exacto: el tope se acepta');
select pg_temp.expect_count($q$select 1 from public.event_participations where minutes = 100 and range_bucket = 4 and played$q$, 1, 'exacto: rango 4 y jugó derivados');
select pg_temp.back();
select pg_temp.as_user('40000000-0000-0000-0000-0000000000a1');   -- entrenador
select pg_temp.expect_fail($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000001',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","minutes":10}]')$q$, 'entrenador carga la participación');
select pg_temp.back();
select pg_temp.as_user('30000000-0000-0000-0000-0000000000a1');   -- kine
select pg_temp.expect_fail($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000001',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","minutes":10}]')$q$, 'kine carga la participación');
select pg_temp.back();
select pg_temp.as_user('60000000-0000-0000-0000-0000000000a1');   -- jugador
select pg_temp.expect_fail($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000001',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","minutes":10}]')$q$, 'jugador carga su participación');
select pg_temp.back();

-- hockey (exacto): tope 75 y derivación del rango con sus cortes
update public.clubs set nomina_mode = 'exacto' where id = 'bbbbbbbb-0000-0000-0000-0000000000b1';
select pg_temp.as_user('10000000-0000-0000-0000-0000000000b1');
select pg_temp.expect_ok($q$select public.set_event_callups('e0000000-0000-0000-0000-0000000000b1', array['b1000000-0000-0000-0000-000000000001']::uuid[])$q$, 'hockey: head coach convoca');
select pg_temp.expect_fail($q$select public.set_event_participation('e0000000-0000-0000-0000-0000000000b1',
  '[{"player_id":"b1000000-0000-0000-0000-000000000001","minutes":76}]')$q$, 'hockey: más que el tope (75)');
select pg_temp.expect_ok($q$select public.set_event_participation('e0000000-0000-0000-0000-0000000000b1',
  '[{"player_id":"b1000000-0000-0000-0000-000000000001","minutes":14}]')$q$, 'hockey: 14 minutos');
select pg_temp.expect_count($q$select 1 from public.event_participations where minutes = 14 and range_bucket = 1$q$, 1, 'hockey: 14 minutos = rango 1');
select pg_temp.expect_ok($q$select public.set_event_participation('e0000000-0000-0000-0000-0000000000b1',
  '[{"player_id":"b1000000-0000-0000-0000-000000000001","minutes":15}]')$q$, 'hockey: 15 minutos');
select pg_temp.expect_count($q$select 1 from public.event_participations where minutes = 15 and range_bucket = 2$q$, 1, 'hockey: 15 minutos = rango 2');
select pg_temp.back();
update public.clubs set nomina_mode = 'rango' where id = 'bbbbbbbb-0000-0000-0000-0000000000b1';
select pg_temp.as_user('10000000-0000-0000-0000-0000000000b1');
select pg_temp.expect_count($q$select 1 from jsonb_array_elements(public.team_match_load(4) -> 'players') p
  where p ->> 'full_name' = 'H1' and (p ->> 'total')::numeric = 23$q$, 1, 'hockey en rango: el rango 2 vale su punto medio (23)');
select pg_temp.back();

-- =======================================================================
-- 4. Semáforo en exacto, rango y jugó (club A, rugby)
-- =======================================================================
-- Partido 1: P1 80, P2 40, P3 20. Partido 2: P1 80, P2 40, P3 0, P4 10.
select pg_temp.as_user('10000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_ok($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000001', '[
  {"player_id":"a1000000-0000-0000-0000-000000000001","minutes":80},
  {"player_id":"a1000000-0000-0000-0000-000000000002","minutes":40},
  {"player_id":"a1000000-0000-0000-0000-000000000003","minutes":20}]')$q$, 'carga el partido 1');
select pg_temp.expect_ok($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000002', '[
  {"player_id":"a1000000-0000-0000-0000-000000000001","minutes":80},
  {"player_id":"a1000000-0000-0000-0000-000000000002","minutes":40},
  {"player_id":"a1000000-0000-0000-0000-000000000003","minutes":0},
  {"player_id":"a1000000-0000-0000-0000-000000000004","minutes":10}]')$q$, 'carga el partido 2');
select pg_temp.back();

-- Con 2 partidos en la ventana: datos sin semáforo.
select pg_temp.as_user('40000000-0000-0000-0000-0000000000a1');   -- entrenador lee
select pg_temp.expect_load('P1', 160, null, 'menos de 3 partidos: P1 sin semáforo');
select pg_temp.expect_count($q$select 1 where (public.team_match_load(4) ->> 'matches_count')::int = 2$q$, 1, 'ventana de 2 partidos');
select pg_temp.back();

-- Partido 3: P1 80, P2 40, P3 0, P4 10.
select pg_temp.as_user('41000000-0000-0000-0000-0000000000a1');   -- el delegado carga
select pg_temp.expect_ok($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000003', '[
  {"player_id":"a1000000-0000-0000-0000-000000000001","minutes":80},
  {"player_id":"a1000000-0000-0000-0000-000000000002","minutes":40},
  {"player_id":"a1000000-0000-0000-0000-000000000003","minutes":0},
  {"player_id":"a1000000-0000-0000-0000-000000000004","minutes":10}]')$q$, 'el delegado carga el partido 3');
select pg_temp.back();

-- exacto: totales 240, 120, 20, 20, 0. Referencia (totales > 0) = 100.
-- Alta >= 125, baja <= 50.
select pg_temp.as_user('51000000-0000-0000-0000-0000000000a1');   -- pf lee
select pg_temp.expect_count($q$select 1 where (public.team_match_load(4) ->> 'reference')::numeric = 100$q$, 1, 'exacto: referencia 100');
select pg_temp.expect_load('P1', 240, 'alta', 'exacto: P1 alta');
select pg_temp.expect_load('P2', 120, 'normal', 'exacto: P2 normal');
select pg_temp.expect_load('P3', 20, 'baja', 'exacto: P3 baja');
select pg_temp.expect_load('P4', 20, 'baja', 'exacto: P4 baja');
select pg_temp.expect_load('P5', 0, 'sin_minutos', 'exacto: P5 no convocado = sin minutos');
select pg_temp.back();

-- rango (los datos en exacto sirven): puntos medios 70, 50, 30 y 10.
-- Totales 210, 150, 30, 20, 0. Referencia 102,5: alta >= 128,1, baja <= 51,25.
update public.clubs set nomina_mode = 'rango' where id = 'aaaaaaaa-0000-0000-0000-0000000000a1';
select pg_temp.as_user('50000000-0000-0000-0000-0000000000a1');   -- nutri lee
select pg_temp.expect_load('P1', 210, 'alta', 'rango: P1 alta');
select pg_temp.expect_load('P2', 150, 'alta', 'rango: P2 alta');
select pg_temp.expect_load('P3', 30, 'baja', 'rango: P3 baja');
select pg_temp.expect_load('P4', 20, 'baja', 'rango: P4 baja');
select pg_temp.expect_load('P5', 0, 'sin_minutos', 'rango: P5 sin minutos');
select pg_temp.expect_count($q$select 1 where (public.team_match_load(4) ->> 'other_mode_count')::int = 0$q$, 1, 'rango: los datos en exacto no cuentan como otro modo');
select pg_temp.back();

-- jugó: P1 y P2 jugaron los 3 (alta), P4 2 (normal), P3 1 (baja), P5 0 (sin partidos).
update public.clubs set nomina_mode = 'jugo' where id = 'aaaaaaaa-0000-0000-0000-0000000000a1';
select pg_temp.as_user('30000000-0000-0000-0000-0000000000a1');   -- kine lee
select pg_temp.expect_load('P1', 3, 'alta', 'jugó: P1 alta');
select pg_temp.expect_load('P2', 3, 'alta', 'jugó: P2 alta');
select pg_temp.expect_load('P4', 2, 'normal', 'jugó: P4 normal');
select pg_temp.expect_load('P3', 1, 'baja', 'jugó: P3 baja');
select pg_temp.expect_load('P5', 0, 'sin_partidos', 'jugó: P5 sin partidos');
select pg_temp.back();

-- =======================================================================
-- 5. Modo cambiado con datos previos
-- =======================================================================
-- Partido 4 cargado en "jugó" (menos detallado): P1 y P2 jugaron.
select pg_temp.as_user('10000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_ok($q$select public.set_event_callups('e0000000-0000-0000-0000-000000000004', array[
  'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002']::uuid[])$q$, 'convoca al partido 4');
select pg_temp.expect_ok($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000004', '[
  {"player_id":"a1000000-0000-0000-0000-000000000001","played":true},
  {"player_id":"a1000000-0000-0000-0000-000000000002","played":true}]')$q$, 'carga el partido 4 en jugó');
select pg_temp.back();
select pg_temp.as_user('40000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_load('P1', 4, 'alta', 'jugó: P1 jugó los 4 de la ventana');
select pg_temp.expect_load('P4', 2, 'normal', 'jugó: P4 jugó 2 de 4');
select pg_temp.back();

-- Vuelve a exacto: el partido 4 (en jugó) no se estima hacia arriba.
select pg_temp.as_user('10000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_ok($q$select public.set_nomina_mode('exacto')$q$, 'vuelve a exacto');
select pg_temp.back();
select pg_temp.as_user('40000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_count($q$select 1 where (public.team_match_load(4) ->> 'other_mode_count')::int = 2$q$, 1, 'exacto: 2 participaciones cargadas en otro modo');
select pg_temp.expect_count($q$select 1 from jsonb_array_elements(public.team_match_load(4) -> 'players') p
  where p ->> 'full_name' = 'P1' and (p ->> 'other_mode')::int = 1$q$, 1, 'exacto: P1 tiene 1 partido en otro modo');
select pg_temp.expect_load('P1', 240, 'alta', 'exacto: el partido en jugó no suma minutos');
select pg_temp.back();
update public.clubs set nomina_mode = 'rango' where id = 'aaaaaaaa-0000-0000-0000-0000000000a1';
select pg_temp.as_user('40000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_count($q$select 1 where (public.team_match_load(4) ->> 'other_mode_count')::int = 2$q$, 1, 'rango: jugó tampoco se estima hacia arriba');
select pg_temp.back();

-- =======================================================================
-- 6. Quitar de la convocatoria archiva sin borrar
-- =======================================================================
select pg_temp.as_user('10000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_ok($q$select public.set_event_callups('e0000000-0000-0000-0000-000000000001', array[
  'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002']::uuid[])$q$, 'quita a P3 del partido 1');
select pg_temp.expect_count($q$select 1 from public.event_callups
  where event_id = 'e0000000-0000-0000-0000-000000000001' and player_id = 'a1000000-0000-0000-0000-000000000003'
    and removed_at is not null$q$, 1, 'la convocatoria de P3 queda archivada');
select pg_temp.expect_count($q$select 1 from public.event_participations
  where event_id = 'e0000000-0000-0000-0000-000000000001' and player_id = 'a1000000-0000-0000-0000-000000000003'$q$, 1, 'su participación no se borra');
select pg_temp.expect_load('P3', 0, 'sin_minutos', 'rango: P3 sin el partido 1 ya no suma');
select pg_temp.expect_fail($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000001',
  '[{"player_id":"a1000000-0000-0000-0000-000000000003","range_bucket":1}]')$q$, 'no se carga a un convocado archivado');
select pg_temp.expect_ok($q$select public.set_event_callups('e0000000-0000-0000-0000-000000000001', array[
  'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003']::uuid[])$q$, 'vuelve a convocar a P3');
select pg_temp.expect_count($q$select 1 from public.event_callups
  where event_id = 'e0000000-0000-0000-0000-000000000001' and player_id = 'a1000000-0000-0000-0000-000000000003'
    and removed_at is null$q$, 1, 'la misma fila se reactiva');
select pg_temp.expect_load('P3', 30, 'baja', 'rango: P3 vuelve a sumar el partido 1');
select pg_temp.back();

-- =======================================================================
-- 7. El jugador lee solo lo suyo; aislamiento entre clubes
-- =======================================================================
select pg_temp.as_user('60000000-0000-0000-0000-0000000000a1');   -- P1
select pg_temp.expect_count($q$select 1 from public.event_callups$q$, 5, 'P1 ve solo sus 5 convocatorias');
select pg_temp.expect_count($q$select 1 from public.event_callups where player_id <> 'a1000000-0000-0000-0000-000000000001'$q$, 0, 'P1 no ve convocatorias de otros');
select pg_temp.expect_count($q$select 1 from public.event_participations where player_id <> 'a1000000-0000-0000-0000-000000000001'$q$, 0, 'P1 no ve participaciones de otros');
select pg_temp.expect_fail($q$select public.team_match_load(4)$q$, 'P1 lee la carga del plantel');
select pg_temp.expect_count($q$select 1 where not (public.my_match_load() ? 'players')
  and public.my_match_load() -> 'player' ->> 'player_id' = 'a1000000-0000-0000-0000-000000000001'
  and public.my_match_load() -> 'player' -> 'status' = 'null'::jsonb$q$, 1, 'my_match_load: solo P1 y sin semáforo');
select pg_temp.expect_count($q$select 1 where (public.my_match_load() -> 'player' ->> 'total')::numeric = 210
  and (public.my_match_load() ->> 'window_size')::int = 6$q$, 1, 'my_match_load: su total en la ventana de 6');
select pg_temp.expect_count($q$select 1 from jsonb_array_elements(public.my_match_load() -> 'callups')$q$, 5, 'my_match_load: sus 5 convocatorias (también la futura)');
select pg_temp.expect_count($q$select 1 where position('a1000000-0000-0000-0000-000000000002' in public.my_match_load()::text) = 0
  and position('"P2"' in public.my_match_load()::text) = 0$q$, 1, 'my_match_load: sin datos de otros jugadores');
select pg_temp.back();

select pg_temp.as_user('60000000-0000-0000-0000-0000000000b1');   -- H1 (club B)
select pg_temp.expect_count($q$select 1 from public.event_callups where club_id = 'aaaaaaaa-0000-0000-0000-0000000000a1'$q$, 0, 'H1 no ve convocatorias del club A');
select pg_temp.expect_count($q$select 1 where position('a1000000' in public.my_match_load()::text) = 0$q$, 1, 'my_match_load de H1 no trae nada del club A');
select pg_temp.back();
select pg_temp.as_user('10000000-0000-0000-0000-0000000000b1');   -- HC del club B
select pg_temp.expect_count($q$select 1 from public.event_callups where club_id = 'aaaaaaaa-0000-0000-0000-0000000000a1'$q$, 0, 'HC B no ve convocatorias del club A');
select pg_temp.expect_count($q$select 1 from public.event_participations where club_id = 'aaaaaaaa-0000-0000-0000-0000000000a1'$q$, 0, 'HC B no ve participaciones del club A');
select pg_temp.expect_count($q$select 1 from jsonb_array_elements(public.team_match_load(4) -> 'players') p
  where p ->> 'player_id' like 'a1000000%'$q$, 0, 'la carga del club B no trae jugadores del club A');
select pg_temp.expect_fail($q$select public.set_event_participation('e0000000-0000-0000-0000-000000000001',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","range_bucket":1}]')$q$, 'HC B carga un partido del club A');
select pg_temp.back();

-- =======================================================================
-- 8. Permisos de las funciones y de las tablas
-- =======================================================================
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in
    ('set_event_callups', 'set_event_participation', 'set_nomina_mode', 'set_nomina_delegate', 'team_match_load', 'my_match_load')
    and p.prosecdef and p.proconfig = array['search_path=""']$q$, 6, 'las 6 funciones son SECURITY DEFINER con search_path vacío');
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(p.proacl) a
  where n.nspname = 'public' and p.proname in
    ('set_event_callups', 'set_event_participation', 'set_nomina_mode', 'set_nomina_delegate', 'team_match_load', 'my_match_load', 'sport_load_scale')
    and (a.grantee = 0 or a.grantee = 'anon'::regrole)$q$, 0, 'ninguna da permisos a PUBLIC ni a anon');
select pg_temp.expect_count($q$select 1 where has_table_privilege('authenticated', 'public.event_callups', 'INSERT')
  or has_table_privilege('authenticated', 'public.event_participations', 'UPDATE')
  or has_table_privilege('authenticated', 'public.event_participations', 'DELETE')$q$, 0, 'authenticated no escribe las tablas directo');
select pg_temp.expect_count($q$select 1 where has_function_privilege('authenticated', 'private.match_load(uuid, int, uuid)', 'EXECUTE')$q$, 0, 'authenticated no ejecuta el cálculo interno');

-- =======================================================================
-- 9. Nómina por puestos: titulares y banca (0029)
-- =======================================================================
select pg_temp.expect_count($q$select 1 from public.sports where slug = 'rugby' and starters = 15 and bench_size = 8$q$, 1, 'rugby: 15 titulares y 8 de banca');
select pg_temp.expect_count($q$select 1 from public.sports where slug = 'hockey' and starters = 11 and bench_size = 5$q$, 1, 'hockey: 11 titulares y 5 de banca');
select pg_temp.expect_count($q$select 1 from public.sports where starters is null or bench_size is null$q$, 0, 'los 7 deportes tienen titulares y banca');
-- 20 jugadores más en el club A para probar el máximo de 23.
insert into public.players (club_id, full_name, position, status)
select 'aaaaaaaa-0000-0000-0000-0000000000a1', 'Extra ' || g, 'Centro', 'confirmado' from generate_series(1, 20) g;

select pg_temp.as_user('40000000-0000-0000-0000-0000000000a1');   -- entrenador
select pg_temp.expect_fail($q$select public.set_event_lineup('e0000000-0000-0000-0000-000000000005',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","slot":1}]')$q$, 'entrenador arma la nómina por puestos');
select pg_temp.back();
select pg_temp.as_user('60000000-0000-0000-0000-0000000000a1');   -- jugador
select pg_temp.expect_fail($q$select public.set_event_lineup('e0000000-0000-0000-0000-000000000005',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","slot":1}]')$q$, 'jugador arma la nómina por puestos');
select pg_temp.back();

select pg_temp.as_user('10000000-0000-0000-0000-0000000000a1');   -- head coach
select pg_temp.expect_fail($q$select public.set_event_lineup('e0000000-0000-0000-0000-000000000005',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","slot":24}]')$q$, 'rugby: puesto 24 fuera de 1 a 23');
select pg_temp.expect_fail($q$select public.set_event_lineup('e0000000-0000-0000-0000-000000000005',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","slot":0}]')$q$, 'puesto 0');
select pg_temp.expect_fail($q$select public.set_event_lineup('e0000000-0000-0000-0000-000000000005',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","slot":1},
    {"player_id":"a1000000-0000-0000-0000-000000000002","slot":1}]')$q$, 'dos jugadores en el mismo puesto');
select pg_temp.expect_fail($q$select public.set_event_lineup('e0000000-0000-0000-0000-000000000005',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","slot":1},
    {"player_id":"a1000000-0000-0000-0000-000000000001","slot":2}]')$q$, 'un jugador dos veces');
select pg_temp.expect_fail($q$select public.set_event_lineup('e0000000-0000-0000-0000-000000000005',
  '[{"player_id":"b1000000-0000-0000-0000-000000000001","slot":1}]')$q$, 'jugador de otro club');
select pg_temp.expect_fail($q$select public.set_event_lineup('e0000000-0000-0000-0000-000000000006',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","slot":1}]')$q$, 'nómina de un entrenamiento');
select pg_temp.expect_fail($q$select public.set_event_lineup('e0000000-0000-0000-0000-000000000005',
  (select jsonb_agg(jsonb_build_object('player_id', id)) from (select id from public.players
    where club_id = 'aaaaaaaa-0000-0000-0000-0000000000a1' and status = 'confirmado' limit 24) x))$q$, 'más de 23 jugadores');
select pg_temp.expect_ok($q$select public.set_event_lineup('e0000000-0000-0000-0000-000000000005',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","slot":1},
    {"player_id":"a1000000-0000-0000-0000-000000000002","slot":2},
    {"player_id":"a1000000-0000-0000-0000-000000000003","slot":16},
    {"player_id":"a1000000-0000-0000-0000-000000000004","slot":null}]')$q$, 'head coach arma la nómina con titulares, banca y uno sin puesto');
select pg_temp.expect_count($q$select 1 from public.event_callups where event_id = 'e0000000-0000-0000-0000-000000000005'
  and removed_at is null$q$, 4, 'quedan 4 convocados');
select pg_temp.expect_count($q$select 1 from public.event_callups where event_id = 'e0000000-0000-0000-0000-000000000005'
  and removed_at is null and ((player_id = 'a1000000-0000-0000-0000-000000000001' and slot = 1)
    or (player_id = 'a1000000-0000-0000-0000-000000000003' and slot = 16)
    or (player_id = 'a1000000-0000-0000-0000-000000000004' and slot is null))$q$, 3, 'cada uno en su puesto (o sin puesto)');
-- Intercambiar puestos y sacar a uno: se archiva y libera su puesto.
select pg_temp.expect_ok($q$select public.set_event_lineup('e0000000-0000-0000-0000-000000000005',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","slot":2},
    {"player_id":"a1000000-0000-0000-0000-000000000002","slot":1},
    {"player_id":"a1000000-0000-0000-0000-000000000004","slot":23}]')$q$, 'intercambia puestos y saca a P3');
select pg_temp.expect_count($q$select 1 from public.event_callups where event_id = 'e0000000-0000-0000-0000-000000000005'
  and player_id = 'a1000000-0000-0000-0000-000000000003' and removed_at is not null and slot is null$q$, 1, 'P3 queda archivado y sin puesto');
select pg_temp.expect_count($q$select 1 from public.event_callups where event_id = 'e0000000-0000-0000-0000-000000000005'
  and removed_at is null and ((player_id = 'a1000000-0000-0000-0000-000000000001' and slot = 2)
    or (player_id = 'a1000000-0000-0000-0000-000000000002' and slot = 1))$q$, 2, 'los puestos quedan intercambiados');
select pg_temp.expect_ok($q$select public.set_event_callups('e0000000-0000-0000-0000-000000000005', array[
  'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000004']::uuid[])$q$, 'set_event_callups sigue funcionando');
select pg_temp.expect_count($q$select 1 from public.event_callups where event_id = 'e0000000-0000-0000-0000-000000000005'
  and player_id = 'a1000000-0000-0000-0000-000000000002' and removed_at is not null and slot is null$q$, 1, 'set_event_callups libera el puesto al archivar');
select pg_temp.expect_no_rows($q$update public.event_callups set slot = 5$q$, 'head coach edita puestos directo');
select pg_temp.back();
select pg_temp.expect_fail($q$insert into public.event_callups (club_id, event_id, player_id, slot)
  values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005', 23)$q$, 'dos convocados en el mismo puesto (índice único)');

select pg_temp.as_user('41000000-0000-0000-0000-0000000000a1');   -- delegado
select pg_temp.expect_ok($q$select public.set_event_lineup('e0000000-0000-0000-0000-000000000005',
  '[{"player_id":"a1000000-0000-0000-0000-000000000001","slot":9}]')$q$, 'el delegado arma la nómina por puestos');
select pg_temp.back();
select pg_temp.as_user('60000000-0000-0000-0000-0000000000a1');   -- P1 ve su puesto
select pg_temp.expect_count($q$select 1 from jsonb_array_elements(public.my_match_load() -> 'callups') c
  where c ->> 'event_id' = 'e0000000-0000-0000-0000-000000000005' and (c ->> 'slot')::int = 9$q$, 1, 'el jugador ve su puesto');
select pg_temp.expect_count($q$select 1 where (public.my_match_load() ->> 'starters')::int = 15$q$, 1, 'my_match_load trae los titulares del deporte');
select pg_temp.back();

update public.clubs set nomina_mode = 'rango' where id = 'bbbbbbbb-0000-0000-0000-0000000000b1';
select pg_temp.as_user('10000000-0000-0000-0000-0000000000b1');   -- hockey: 11 + 5
select pg_temp.expect_fail($q$select public.set_event_lineup('e0000000-0000-0000-0000-0000000000b1',
  '[{"player_id":"b1000000-0000-0000-0000-000000000001","slot":17}]')$q$, 'hockey: puesto 17 fuera de 1 a 16');
select pg_temp.expect_ok($q$select public.set_event_lineup('e0000000-0000-0000-0000-0000000000b1',
  '[{"player_id":"b1000000-0000-0000-0000-000000000001","slot":16}]')$q$, 'hockey: puesto 16 (banca)');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'set_event_lineup' and p.prosecdef and p.proconfig = array['search_path=""']$q$, 1, 'set_event_lineup es SECURITY DEFINER con search_path vacío');
select pg_temp.expect_count($q$select 1 where has_function_privilege('anon', 'public.set_event_lineup(uuid, jsonb)', 'EXECUTE')$q$, 0, 'anon no ejecuta set_event_lineup');

select 'match_load_test: OK' as resultado;

rollback;
