-- Recov · Test de Rugby Sevens (migración 0045)
-- Correr DESPUÉS de las migraciones 0001 a 0045. Autónomo: crea sus propios datos y termina en ROLLBACK.
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
-- Datos ficticios: A (rugby), B (rugby, otro club) y H (hockey).
-- =======================================================================
insert into public.clubs (id, name, sport, slug) values
  ('aaaaaaaa-0000-0000-0000-0000000000f7', 'Sevens A', 'rugby',  'sevens-a'),
  ('bbbbbbbb-0000-0000-0000-0000000000f7', 'Sevens B', 'rugby',  'sevens-b'),
  ('cccccccc-0000-0000-0000-0000000000f7', 'Hockey H', 'hockey', 'sevens-h');
insert into auth.users (id, email) values
  ('f7000000-0000-0000-0000-000000000001', 'hc@sevens.test'),
  ('f7000000-0000-0000-0000-000000000002', 'manager@sevens.test'),
  ('f7000000-0000-0000-0000-000000000003', 'kine@sevens.test'),
  ('f7000000-0000-0000-0000-000000000004', 'coach@sevens.test'),
  ('f7000000-0000-0000-0000-000000000005', 'j1@sevens.test'),
  ('f7000000-0000-0000-0000-000000000006', 'j2@sevens.test'),
  ('f7000000-0000-0000-0000-000000000007', 'pend@sevens.test'),
  ('f7000000-0000-0000-0000-000000000011', 'hc-b@sevens.test'),
  ('f7000000-0000-0000-0000-000000000021', 'hc-h@sevens.test');
insert into public.profiles (id, full_name) select id, email from auth.users where email like '%@sevens.test';
insert into public.club_members (user_id, club_id, roles, status) values
  ('f7000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000f7', '{head_coach}',  'confirmado'),
  ('f7000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-0000000000f7', '{manager}',     'confirmado'),
  ('f7000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-0000000000f7', '{kinesiologo}', 'confirmado'),
  ('f7000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-0000000000f7', '{entrenador}',  'confirmado'),
  ('f7000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-0000000000f7', '{jugador}',     'confirmado'),
  ('f7000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-0000000000f7', '{jugador}',     'confirmado'),
  ('f7000000-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-0000000000f7', '{jugador}',     'pendiente'),
  ('f7000000-0000-0000-0000-000000000011', 'bbbbbbbb-0000-0000-0000-0000000000f7', '{head_coach}',  'confirmado'),
  ('f7000000-0000-0000-0000-000000000021', 'cccccccc-0000-0000-0000-0000000000f7', '{head_coach}',  'confirmado');
insert into public.players (id, club_id, full_name, position, status, user_id) values
  ('f7100000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000f7', 'Jugador Uno',  'Flanker', 'confirmado', 'f7000000-0000-0000-0000-000000000005'),
  ('f7100000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-0000000000f7', 'Jugador Dos',  'Centro',  'confirmado', 'f7000000-0000-0000-0000-000000000006'),
  ('f7100000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-0000000000f7', 'Jugador Tres', 'Wing',    'confirmado', null);

-- =======================================================================
-- 1. Activar Sevens: solo la dirección y solo en rugby.
-- =======================================================================
select pg_temp.expect_count($q$select 1 from public.clubs where id = 'aaaaaaaa-0000-0000-0000-0000000000f7' and not has_sevens$q$, 1, 'un club nace sin Sevens');
select pg_temp.expect_fail($q$update public.clubs set has_sevens = true where id = 'cccccccc-0000-0000-0000-0000000000f7'$q$, 'trigger: hockey no puede tener Sevens');
select pg_temp.as_user('f7000000-0000-0000-0000-000000000021'); -- head coach de hockey
select pg_temp.expect_fail($q$select public.set_club_sevens(true)$q$, 'un club de hockey no activa Sevens');
select pg_temp.back();

-- Antes de activar: ni grupo ni eventos Sevens.
select pg_temp.expect_fail($q$insert into public.events (club_id, type, starts_at, ends_at, created_by, format)
  values ('aaaaaaaa-0000-0000-0000-0000000000f7', 'competencia', now() + interval '1 day', now() + interval '1 day 1 hour',
          'f7000000-0000-0000-0000-000000000001', '7')$q$, 'evento Sevens sin Sevens activado (trigger)');
select pg_temp.as_user('f7000000-0000-0000-0000-000000000001'); -- head coach A
select pg_temp.expect_fail($q$select * from public.create_event('competencia', now() + interval '1 day', now() + interval '1 day 1 hour', p_format => '7')$q$, 'create_event Sevens sin Sevens activado');
select pg_temp.expect_fail($q$select public.set_sevens_group(array['f7000000-0000-0000-0000-000000000005']::uuid[])$q$, 'armar el grupo sin Sevens activado');
select pg_temp.back();

create function pg_temp.expect_no_direction(uid uuid, who text) returns void language plpgsql as $$
begin
  perform pg_temp.as_user(uid);
  perform pg_temp.expect_state($q$select public.set_club_sevens(true)$q$, '42501', who || ' activa Sevens');
  perform pg_temp.back();
end $$;
select pg_temp.expect_no_direction('f7000000-0000-0000-0000-000000000003', 'kine');
select pg_temp.expect_no_direction('f7000000-0000-0000-0000-000000000004', 'entrenador');
select pg_temp.expect_no_direction('f7000000-0000-0000-0000-000000000005', 'jugador');
select pg_temp.expect_no_direction('f7000000-0000-0000-0000-000000000007', 'pendiente');
select pg_temp.as_user('f7000000-0000-0000-0000-000000000001');
select pg_temp.expect_ok($q$select public.set_club_sevens(true)$q$, 'head coach activa Sevens');
select pg_temp.expect_no_rows($q$update public.clubs set has_sevens = false$q$, 'head coach cambia has_sevens directo');
select pg_temp.back();
select pg_temp.as_user('f7000000-0000-0000-0000-000000000002');
select pg_temp.expect_ok($q$select public.set_club_sevens(true)$q$, 'manager también puede activar Sevens');
select pg_temp.back();

-- =======================================================================
-- 2. Grupo Sevens: solo la dirección; solo miembros confirmados del club.
-- =======================================================================
select pg_temp.as_user('f7000000-0000-0000-0000-000000000003'); -- kine
select pg_temp.expect_state($q$select public.set_sevens_group(array['f7000000-0000-0000-0000-000000000005']::uuid[])$q$, '42501', 'kine arma el grupo');
select pg_temp.back();
select pg_temp.as_user('f7000000-0000-0000-0000-000000000004'); -- entrenador
select pg_temp.expect_state($q$select public.set_sevens_group(array['f7000000-0000-0000-0000-000000000005']::uuid[])$q$, '42501', 'entrenador arma el grupo');
select pg_temp.back();
select pg_temp.as_user('f7000000-0000-0000-0000-000000000002'); -- manager
select pg_temp.expect_fail($q$select public.set_sevens_group(array['f7000000-0000-0000-0000-000000000007']::uuid[])$q$, 'agregar a un pendiente');
select pg_temp.expect_fail($q$select public.set_sevens_group(array['f7000000-0000-0000-0000-000000000011']::uuid[])$q$, 'agregar a alguien de otro club');
select pg_temp.expect_ok($q$select public.set_sevens_group(array['f7000000-0000-0000-0000-000000000005',
  'f7000000-0000-0000-0000-000000000004', 'f7000000-0000-0000-0000-000000000005']::uuid[])$q$, 'manager arma el grupo (jugador y staff, con repetido)');
select pg_temp.expect_fail($q$insert into public.sevens_group (club_id, member_id)
  values ('aaaaaaaa-0000-0000-0000-0000000000f7', 'f7000000-0000-0000-0000-000000000006')$q$, 'manager inserta en el grupo directo');
select pg_temp.expect_no_rows($q$update public.sevens_group set position = 'Pilar'$q$, 'manager edita el grupo directo');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.sevens_group where club_id = 'aaaaaaaa-0000-0000-0000-0000000000f7' and archived_at is null$q$, 2, 'el grupo queda con 2 personas');

-- Aislamiento y lectura.
select pg_temp.as_user('f7000000-0000-0000-0000-000000000005'); -- jugador del grupo
select pg_temp.expect_count($q$select 1 from public.sevens_group$q$, 2, 'un miembro confirmado lee el grupo de su club');
select pg_temp.back();
select pg_temp.as_user('f7000000-0000-0000-0000-000000000007'); -- pendiente
select pg_temp.expect_count($q$select 1 from public.sevens_group$q$, 0, 'un pendiente no lee el grupo');
select pg_temp.back();
select pg_temp.as_user('f7000000-0000-0000-0000-000000000011'); -- head coach B
select pg_temp.expect_count($q$select 1 from public.sevens_group$q$, 0, 'otro club no ve el grupo');
select pg_temp.expect_fail($q$select public.set_sevens_group('{}')$q$, 'otro club (sin Sevens) no arma su grupo');
select pg_temp.expect_no_rows($q$update public.sevens_group set archived_at = now()$q$, 'otro club no modifica el grupo');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.sevens_group where club_id = 'aaaaaaaa-0000-0000-0000-0000000000f7' and archived_at is null$q$, 2, 'el grupo de A sigue intacto');
select pg_temp.as_anon();
select pg_temp.expect_fail($q$select 1 from public.sevens_group$q$, 'anónimo lee el grupo');
select pg_temp.expect_fail($q$select public.set_my_sevens_position('Pilar')$q$, 'anónimo cambia una posición');
select pg_temp.back();

-- =======================================================================
-- 3. Posición en Sevens: solo la propia y solo si está en el grupo.
-- =======================================================================
select pg_temp.as_user('f7000000-0000-0000-0000-000000000006'); -- jugador fuera del grupo
select pg_temp.expect_state($q$select public.set_my_sevens_position('Pilar')$q$, '42501', 'un jugador fuera del grupo elige posición');
select pg_temp.back();
select pg_temp.as_user('f7000000-0000-0000-0000-000000000005'); -- jugador del grupo
select pg_temp.expect_fail($q$select public.set_my_sevens_position('Flanker')$q$, 'posición del 15 (Flanker) rechazada en Sevens');
select pg_temp.expect_fail($q$select public.set_my_sevens_position('Pilar', 'Pilar')$q$, 'secundaria igual a la principal');
select pg_temp.expect_fail($q$select public.set_my_sevens_position(null)$q$, 'sin posición principal');
select pg_temp.expect_fail($q$select public.set_my_sevens_position(' ', 'Hooker')$q$, 'principal vacía con secundaria');
select pg_temp.expect_ok($q$select public.set_my_sevens_position('Pilar', 'Hooker')$q$, 'el jugador elige Pilar y Hooker');
select pg_temp.back();
select pg_temp.as_user('f7000000-0000-0000-0000-000000000004'); -- entrenador del grupo (staff)
select pg_temp.expect_ok($q$select public.set_my_sevens_position('Centro')$q$, 'el staff del grupo también tiene posición');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.sevens_group where member_id = 'f7000000-0000-0000-0000-000000000005'
  and position = 'Pilar' and secondary_position = 'Hooker'$q$, 1, 'la posición del jugador quedó guardada');
select pg_temp.expect_count($q$select 1 from public.players where id = 'f7100000-0000-0000-0000-000000000001' and position = 'Flanker'$q$, 1, 'la posición del 15 no cambia');
select pg_temp.expect_fail($q$update public.sevens_group set secondary_position = position
  where member_id = 'f7000000-0000-0000-0000-000000000005'$q$, 'check: secundaria igual a la principal');
select pg_temp.expect_fail($q$update public.sevens_group set position = null
  where member_id = 'f7000000-0000-0000-0000-000000000005'$q$, 'check: secundaria sin principal');

-- Y viceversa: una posición solo de Sevens no vale en la ficha del 15.
insert into public.positions (sport, format, name, sort) values ('rugby', '7', 'Solo Sevens (prueba)', 99);
select pg_temp.expect_fail($q$update public.players set position = 'Solo Sevens (prueba)' where id = 'f7100000-0000-0000-0000-000000000002'$q$, 'posición solo de Sevens rechazada en la ficha del 15');
select pg_temp.expect_ok($q$update public.players set position = 'Medio scrum' where id = 'f7100000-0000-0000-0000-000000000002'$q$, 'una posición del 15 sigue valiendo en la ficha');
select pg_temp.expect_count($q$select 1 from public.positions where sport = 'rugby' and format = '7' and name in
  ('Pilar', 'Hooker', 'Medio scrum', 'Apertura', 'Centro', 'Wing')$q$, 6, 'las 6 posiciones de Sevens');
select pg_temp.expect_count($q$select 1 from public.positions where sport = 'rugby' and format = '15'$q$, 10, 'rugby 15 sigue con 10 posiciones');
select pg_temp.expect_fail($q$insert into public.positions (sport, format, name, sort) values ('rugby', '7', 'Pilar', 50)$q$, 'nombre repetido en el mismo formato');

-- =======================================================================
-- 4. Archivar y restaurar conserva la posición.
-- =======================================================================
select pg_temp.as_user('f7000000-0000-0000-0000-000000000001');
select pg_temp.expect_ok($q$select public.set_sevens_group(array['f7000000-0000-0000-0000-000000000004']::uuid[])$q$, 'sacar al jugador del grupo');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.sevens_group where member_id = 'f7000000-0000-0000-0000-000000000005' and archived_at is not null$q$, 1, 'el jugador queda archivado (no se borra)');
select pg_temp.as_user('f7000000-0000-0000-0000-000000000005');
select pg_temp.expect_state($q$select public.set_my_sevens_position('Wing')$q$, '42501', 'archivado no cambia su posición');
select pg_temp.back();
select pg_temp.as_user('f7000000-0000-0000-0000-000000000001');
select pg_temp.expect_ok($q$select public.set_sevens_group(array['f7000000-0000-0000-0000-000000000004', 'f7000000-0000-0000-0000-000000000005']::uuid[])$q$, 'volver a agregar al jugador');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.sevens_group where member_id = 'f7000000-0000-0000-0000-000000000005'
  and archived_at is null and position = 'Pilar' and secondary_position = 'Hooker'$q$, 1, 'al restaurarlo conserva su posición');
select pg_temp.expect_count($q$select 1 from public.sevens_group where club_id = 'aaaaaaaa-0000-0000-0000-0000000000f7'$q$, 2, 'restaurar no duplica filas');

-- =======================================================================
-- 5. Eventos Sevens: puestos 1–12; en el 15, 1–23. Escala y carga por formato.
-- =======================================================================
-- create_event como el head coach A (identidad por el JWT; la tabla temporal la crea postgres).
select set_config('request.jwt.claims', json_build_object('sub', 'f7000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
create temp table ev as select
  (select x from public.create_event('competencia', now() - interval '1 day', now() - interval '1 day' + interval '30 minutes', p_opponent => 'Rival 7', p_format => '7') x) e7,
  (select x from public.create_event('competencia', now() - interval '2 days', now() - interval '2 days' + interval '2 hours', p_opponent => 'Rival 15') x) e15;
grant select on ev to authenticated;
select pg_temp.expect_count($q$select 1 from public.events e join ev on e.id = ev.e7 where e.format = '7'$q$, 1, 'create_event crea el evento Sevens');
select pg_temp.expect_count($q$select 1 from public.events e join ev on e.id = ev.e15 where e.format = '15'$q$, 1, 'por defecto el evento es del 15');
select pg_temp.as_user('f7000000-0000-0000-0000-000000000001');
select pg_temp.expect_ok($q$select public.set_event_lineup((select e7 from ev), '[
  {"player_id":"f7100000-0000-0000-0000-000000000001","slot":1},
  {"player_id":"f7100000-0000-0000-0000-000000000002","slot":12}]')$q$, 'Sevens: puestos 1 y 12 válidos');
select pg_temp.expect_fail($q$select public.set_event_lineup((select e7 from ev), '[{"player_id":"f7100000-0000-0000-0000-000000000001","slot":13}]')$q$, 'Sevens: puesto 13 rechazado');
select pg_temp.expect_ok($q$select public.set_event_lineup((select e15 from ev), '[
  {"player_id":"f7100000-0000-0000-0000-000000000001","slot":1},
  {"player_id":"f7100000-0000-0000-0000-000000000002","slot":23}]')$q$, '15: puestos 1 y 23 válidos');
select pg_temp.expect_fail($q$select public.set_event_lineup((select e15 from ev), '[{"player_id":"f7100000-0000-0000-0000-000000000001","slot":24}]')$q$, '15: puesto 24 rechazado');
select pg_temp.back();

select pg_temp.expect_count($q$select 1 from (select string_agg(midpoint::text, ',' order by bucket) m, string_agg(label, ',' order by bucket) l,
  max(min_to) top from public.format_load_scale('rugby', '7')) s where m = '0,3,8,12,14' and l = 'No jugó,<5,5-10,10-14,14+' and top = 14$q$, 1,
  'escala Sevens: 0 / 1–4 / 5–9 / 10–13 / 14');
select pg_temp.expect_count($q$select 1 from (select string_agg(midpoint::text, ',' order by bucket) m from public.format_load_scale('rugby', '15')) s
  where m = (select string_agg(midpoint::text, ',' order by bucket) from public.sport_load_scale('rugby'))$q$, 1, 'la escala del 15 no cambia');

update public.clubs set nomina_mode = 'exacto' where id = 'aaaaaaaa-0000-0000-0000-0000000000f7';
select pg_temp.as_user('f7000000-0000-0000-0000-000000000001');
select pg_temp.expect_fail($q$select public.set_event_participation((select e7 from ev), '[{"player_id":"f7100000-0000-0000-0000-000000000001","minutes":15}]')$q$, 'Sevens: más de 14 minutos rechazado');
select pg_temp.expect_ok($q$select public.set_event_participation((select e7 from ev), '[
  {"player_id":"f7100000-0000-0000-0000-000000000001","minutes":14},
  {"player_id":"f7100000-0000-0000-0000-000000000002","minutes":7}]')$q$, 'Sevens: 14 y 7 minutos');
select pg_temp.expect_ok($q$select public.set_event_participation((select e15 from ev), '[{"player_id":"f7100000-0000-0000-0000-000000000001","minutes":80}]')$q$, '15: 80 minutos');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.event_participations p join ev on p.event_id = ev.e7
  where (p.minutes, p.range_bucket) in ((14, 4), (7, 2))$q$, 2, 'Sevens: 14 min = rango 4 y 7 min = rango 2');
select pg_temp.expect_count($q$select 1 from public.event_participations p join ev on p.event_id = ev.e15
  where p.minutes = 80 and p.range_bucket = 4$q$, 1, '15: 80 min = rango 4');

select pg_temp.as_user('f7000000-0000-0000-0000-000000000004'); -- entrenador (staff)
select pg_temp.expect_count($q$select 1 where (public.team_match_load(4, '7') ->> 'matches_count')::int = 1
  and (public.team_match_load(4, '15') ->> 'matches_count')::int = 1
  and (public.team_match_load(4) ->> 'matches_count')::int = 1$q$, 1, 'la carga separa los partidos por formato');
select pg_temp.expect_count($q$select 1 from jsonb_array_elements(public.team_match_load(4, '7') -> 'players') p
  where p ->> 'player_id' = 'f7100000-0000-0000-0000-000000000001' and (p ->> 'total')::numeric = 14$q$, 1, 'Sevens: la carga del jugador del grupo');
select pg_temp.expect_count($q$select 1 from jsonb_array_elements(public.team_match_load(4, '7') -> 'players')$q$, 1, 'Sevens: solo los jugadores del grupo');
select pg_temp.expect_count($q$select 1 from jsonb_array_elements(public.team_match_load(4, '15') -> 'players')$q$, 3, '15: todo el plantel');
select pg_temp.expect_fail($q$select public.team_match_load(4, '9')$q$, 'formato inválido');
select pg_temp.back();
select pg_temp.as_user('f7000000-0000-0000-0000-000000000005'); -- jugador
select pg_temp.expect_count($q$select 1 where (public.my_match_load('7') -> 'player' ->> 'total')::numeric = 14
  and (public.my_match_load('7') ->> 'starters')::int = 7
  and jsonb_array_length(public.my_match_load('7') -> 'callups') = 1
  and (public.my_match_load() ->> 'starters')::int = 15
  and jsonb_array_length(public.my_match_load() -> 'callups') = 1$q$, 1, 'my_match_load por formato (y sin argumento = 15)');
select pg_temp.back();

-- =======================================================================
-- 6. Permisos de las funciones nuevas.
-- =======================================================================
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.oid in ('public.set_club_sevens(boolean)'::regprocedure, 'public.set_sevens_group(uuid[])'::regprocedure,
                  'public.set_my_sevens_position(text, text)'::regprocedure, 'public.team_match_load(integer, text)'::regprocedure,
                  'public.my_match_load(text)'::regprocedure, 'public.format_load_scale(text, text)'::regprocedure,
                  'public.create_event(text, timestamptz, timestamptz, text, text, text, integer, text)'::regprocedure)
    and p.prosecdef and p.proconfig = array['search_path=""']
    and has_function_privilege('authenticated', p.oid, 'EXECUTE') and not has_function_privilege('anon', p.oid, 'EXECUTE')$q$, 7,
  'las 7 funciones: SECURITY DEFINER, search_path vacío, authenticated sí y anon no');
select pg_temp.expect_count($q$select 1 from pg_proc where proname = 'create_event' and pronamespace = 'public'::regnamespace$q$, 1, 'create_event tiene una sola firma');
select pg_temp.expect_count($q$select 1 where has_table_privilege('authenticated', 'public.sevens_group', 'INSERT')
  or has_table_privilege('authenticated', 'public.sevens_group', 'UPDATE') or has_table_privilege('authenticated', 'public.sevens_group', 'DELETE')
  or has_table_privilege('anon', 'public.sevens_group', 'SELECT')
  or has_table_privilege('authenticated', 'public.sport_format_config', 'INSERT') or has_table_privilege('authenticated', 'public.sport_format_config', 'UPDATE')$q$, 0,
  'sin escritura directa en sevens_group ni sport_format_config');

select 'sevens_test: OK' as resultado;
rollback;
