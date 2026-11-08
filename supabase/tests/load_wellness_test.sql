-- Recov · Test de sRPE y check de bienestar (20261105180000)
-- Autónomo: crea sus propios datos y termina en ROLLBACK. Si algo falla, lanza un error que empieza con "FAIL".

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

-- la consulta debe devolver exactamente este texto
create function pg_temp.expect_eq(q text, expected text, label text) returns void language plpgsql as $$
declare got text;
begin
  execute q into got;
  if got is distinct from expected then raise exception 'FAIL: % (esperado %, llegó %)', label, expected, got; end if;
end $$;

-- Datos de prueba (como postgres) ---------------------------------------
insert into public.clubs (id, name, sport, slug, has_sevens) values
  ('aaaaaaaa-0000-0000-0000-0000000000c1', 'Club A carga', 'rugby',  'club-a-carga', true),
  ('bbbbbbbb-0000-0000-0000-0000000000c2', 'Club B carga', 'hockey', 'club-b-carga', false);

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-0000000000c1', 'hc-a-carga@test.cl'),
  ('20000000-0000-0000-0000-0000000000c1', 'manager-a-carga@test.cl'),
  ('30000000-0000-0000-0000-0000000000c1', 'kine-a-carga@test.cl'),
  ('40000000-0000-0000-0000-0000000000c1', 'coach-a-carga@test.cl'),
  ('55000000-0000-0000-0000-0000000000c1', 'pf-a-carga@test.cl'),
  ('60000000-0000-0000-0000-0000000000c1', 'j1-a-carga@test.cl'),
  ('61000000-0000-0000-0000-0000000000c1', 'j2-a-carga@test.cl'),
  ('62000000-0000-0000-0000-0000000000c1', 'j-pend-a-carga@test.cl'),
  ('10000000-0000-0000-0000-0000000000c2', 'hc-b-carga@test.cl'),
  ('60000000-0000-0000-0000-0000000000c2', 'j1-b-carga@test.cl');

with v(id, club_id, roles, full_name, status) as (values
  ('10000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000c1', '{head_coach}',        'HC A',      'confirmado'),
  ('20000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000c1', '{manager}',           'Manager A', 'confirmado'),
  ('30000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000c1', '{kinesiologo}',       'Kine A',    'confirmado'),
  ('40000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000c1', '{entrenador}',        'Coach A',   'confirmado'),
  ('55000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000c1', '{preparador_fisico}', 'PF A',      'confirmado'),
  ('60000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000c1', '{jugador}',           'J1 A',      'confirmado'),
  ('61000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000c1', '{jugador}',           'J2 A',      'confirmado'),
  ('62000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000c1', '{jugador}',           'JP A',      'pendiente'),
  ('10000000-0000-0000-0000-0000000000c2', 'bbbbbbbb-0000-0000-0000-0000000000c2', '{head_coach}',        'HC B',      'confirmado'),
  ('60000000-0000-0000-0000-0000000000c2', 'bbbbbbbb-0000-0000-0000-0000000000c2', '{jugador}',           'J1 B',      'confirmado')),
     p as (insert into public.profiles (id, full_name) select id::uuid, full_name from v)
insert into public.club_members (user_id, club_id, roles, status)
select id::uuid, club_id::uuid, roles::public.user_role[], status::public.member_status from v;

-- Fichas: A1 y A2 con cuenta (A2 en el grupo Sevens), A3–A5 sin cuenta, una pendiente y B1.
insert into public.players (id, club_id, full_name, status, availability, user_id, active) values
  ('a1c00000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'Ana Uno',    'confirmado', 'disponible', '60000000-0000-0000-0000-0000000000c1', true),
  ('a1c00000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'Bea Dos',    'confirmado', 'disponible', '61000000-0000-0000-0000-0000000000c1', true),
  ('a1c00000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'Cata Tres',  'confirmado', 'disponible', null, true),
  ('a1c00000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'Dani Cuatro','confirmado', 'disponible', null, true),
  ('a1c00000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'Eli Cinco',  'confirmado', 'disponible', null, true),
  ('a1c00000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'Pía Pend',   'pendiente',  'disponible', '62000000-0000-0000-0000-0000000000c1', true),
  ('b1c00000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-0000000000c2', 'Beto B',     'confirmado', 'disponible', '60000000-0000-0000-0000-0000000000c2', true);

insert into public.sevens_group (club_id, member_id)
values ('aaaaaaaa-0000-0000-0000-0000000000c1', '61000000-0000-0000-0000-0000000000c1');

-- Eventos (relativos a ahora). Entrenamientos de 90 min; partidos con término a las 2 h.
insert into public.events (id, club_id, type, starts_at, ends_at, created_by, cancelled_at, format)
select x.id::uuid, x.club::uuid, x.type, now() + x.s::interval, now() + x.e::interval,
       '10000000-0000-0000-0000-0000000000c1'::uuid, x.cancelled, x.fmt
  from (values
  ('ec000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'entrenamiento', '-3 hours',  '-90 minutes', null::timestamptz, '15'), -- t1: en plazo
  ('ec000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'entrenamiento', '-52 hours', '-50 hours', null, '15'), -- vencido
  ('ec000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'entrenamiento', '1 day',     '1 day 90 minutes', null, '15'),   -- futuro
  ('ec000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'entrenamiento', '-3 hours',  '-90 minutes', now(), '15'),       -- cancelado
  ('ec000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'entrenamiento', '-5 hours',  '-210 minutes', null, '15'),       -- A1 ausente en la lista
  ('ec000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'entrenamiento', '-2 hours',  '-30 minutes', null, '7'),         -- Sevens
  ('ec000000-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'entrenamiento', '-47 hours', '-46 hours', null, '15'),          -- en plazo (casi 48 h)
  ('ec000000-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'competencia',   '-3 hours',  '-1 hour', null, '15'),            -- exacto 60
  ('ec000000-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'competencia',   '-3 hours',  '-1 hour', null, '15'),            -- rango, jugó
  ('ec000000-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'competencia',   '-3 hours',  '-1 hour', null, '15'),            -- rango 0, no jugó
  ('ec000000-0000-0000-0000-000000000014', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'competencia',   '-3 hours',  '-1 hour', null, '15'),            -- sin participación
  ('ec000000-0000-0000-0000-000000000015', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'competencia',   '-3 hours',  '-1 hour', null, '15'),            -- jugó / no jugó: jugó
  ('ec000000-0000-0000-0000-000000000016', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'competencia',   '-3 hours',  '-1 hour', null, '15'),            -- A1 no convocado
  ('ec000000-0000-0000-0000-000000000017', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'competencia',   '-3 hours',  '-1 hour', null, '15'),            -- A1 convocado y quitado
  ('ec000000-0000-0000-0000-000000000018', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'competencia',   '-3 hours',  '-1 hour', null, '7'),             -- Sevens, A2 sin participación
  ('ec000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-0000000000c2', 'entrenamiento', '-3 hours',  '-90 minutes', null, '15')
  ) x(id, club, type, s, e, cancelled, fmt);
update public.events set created_by = '10000000-0000-0000-0000-0000000000c2' where club_id = 'bbbbbbbb-0000-0000-0000-0000000000c2';

-- Lista del entrenamiento ec..05: A1 ausente.
insert into public.event_attendance (event_id, player_id, club_id, present, recorded_by) values
  ('ec000000-0000-0000-0000-000000000005', 'a1c00000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000c1', false, '40000000-0000-0000-0000-0000000000c1'),
  ('ec000000-0000-0000-0000-000000000005', 'a1c00000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-0000000000c1', true,  '40000000-0000-0000-0000-0000000000c1');

-- Convocatorias de A1 a los partidos 11–15 y 17 (quitado); A2 al de Sevens.
insert into public.event_callups (club_id, event_id, player_id, created_by, removed_at)
select 'aaaaaaaa-0000-0000-0000-0000000000c1', x.e::uuid, x.p::uuid, '10000000-0000-0000-0000-0000000000c1', x.r
  from (values
  ('ec000000-0000-0000-0000-000000000011', 'a1c00000-0000-0000-0000-000000000001', null::timestamptz),
  ('ec000000-0000-0000-0000-000000000012', 'a1c00000-0000-0000-0000-000000000001', null),
  ('ec000000-0000-0000-0000-000000000013', 'a1c00000-0000-0000-0000-000000000001', null),
  ('ec000000-0000-0000-0000-000000000014', 'a1c00000-0000-0000-0000-000000000001', null),
  ('ec000000-0000-0000-0000-000000000015', 'a1c00000-0000-0000-0000-000000000001', null),
  ('ec000000-0000-0000-0000-000000000017', 'a1c00000-0000-0000-0000-000000000001', now()),
  ('ec000000-0000-0000-0000-000000000011', 'a1c00000-0000-0000-0000-000000000003', null),
  ('ec000000-0000-0000-0000-000000000018', 'a1c00000-0000-0000-0000-000000000002', null)) x(e, p, r);

insert into public.event_participations (callup_id, club_id, event_id, player_id, mode, minutes, range_bucket, played, recorded_by)
select cu.id, cu.club_id, cu.event_id, cu.player_id, x.mode::public.nomina_mode, x.minutes, x.bucket, x.played,
       '10000000-0000-0000-0000-0000000000c1'
  from public.event_callups cu
  join (values
    ('ec000000-0000-0000-0000-000000000011', 'exacto', 60,          3,              true),
    ('ec000000-0000-0000-0000-000000000012', 'rango',  null::int,   4,              true),
    ('ec000000-0000-0000-0000-000000000013', 'rango',  null,        0,              false),
    ('ec000000-0000-0000-0000-000000000015', 'jugo',   null,        null::smallint, true)
  ) x(e, mode, minutes, bucket, played) on x.e::uuid = cu.event_id
 where cu.player_id = 'a1c00000-0000-0000-0000-000000000001';

-- =======================================================================
-- 1. Minutos de cada sesión (private.session_minutes)
-- =======================================================================
select pg_temp.expect_eq($q$select minutes || '/' || estimated from private.session_minutes('ec000000-0000-0000-0000-000000000001', 'a1c00000-0000-0000-0000-000000000001')$q$,
  '90/false', 'entrenamiento: término − inicio');
select pg_temp.expect_eq($q$select minutes || '/' || estimated from private.session_minutes('ec000000-0000-0000-0000-000000000011', 'a1c00000-0000-0000-0000-000000000001')$q$,
  '60/false', 'partido en minutos exactos');
select pg_temp.expect_eq($q$select minutes || '/' || estimated from private.session_minutes('ec000000-0000-0000-0000-000000000012', 'a1c00000-0000-0000-0000-000000000001')$q$,
  '80/true', 'partido en rango y jugó: partido completo, estimado');
select pg_temp.expect_eq($q$select minutes || '/' || estimated from private.session_minutes('ec000000-0000-0000-0000-000000000013', 'a1c00000-0000-0000-0000-000000000001')$q$,
  '0/false', 'partido donde no jugó: 0');
select pg_temp.expect_eq($q$select minutes || '/' || estimated from private.session_minutes('ec000000-0000-0000-0000-000000000014', 'a1c00000-0000-0000-0000-000000000001')$q$,
  '80/true', 'partido sin participación cargada: partido completo, estimado');
select pg_temp.expect_eq($q$select minutes || '/' || estimated from private.session_minutes('ec000000-0000-0000-0000-000000000015', 'a1c00000-0000-0000-0000-000000000001')$q$,
  '80/true', 'partido en jugó / no jugó: partido completo, estimado');
select pg_temp.expect_eq($q$select minutes || '/' || estimated from private.session_minutes('ec000000-0000-0000-0000-000000000018', 'a1c00000-0000-0000-0000-000000000002')$q$,
  '14/true', 'partido Sevens: duración del formato 7');

-- =======================================================================
-- 2. Pendientes del jugador
-- =======================================================================
-- Hoy no toca bienestar: días = uno que no es hoy ni ayer.
create temp table dw as select extract(isodow from (now() at time zone 'America/Santiago'))::smallint as td,
                               extract(isodow from (now() at time zone 'America/Santiago')::date - 1)::smallint as yd;
grant select on dw to authenticated;
update public.clubs set wellness_days = array[((select td from dw) % 7) + 1]::smallint[]
 where id = 'aaaaaaaa-0000-0000-0000-0000000000c1';

select pg_temp.as_user('60000000-0000-0000-0000-0000000000c1');
-- A1 en '15': t1, ec..07 y los partidos 11–15. No: vencido, futuro, cancelado, ausente, Sevens, no convocado, quitado.
select pg_temp.expect_count($q$select 1 from public.my_pending_reports('15') where kind = 'session'$q$, 7, 'A1 tiene 7 sesiones pendientes');
select pg_temp.expect_count($q$select 1 from public.my_pending_reports('15') where event_id in (
  'ec000000-0000-0000-0000-000000000002', 'ec000000-0000-0000-0000-000000000003', 'ec000000-0000-0000-0000-000000000004',
  'ec000000-0000-0000-0000-000000000005', 'ec000000-0000-0000-0000-000000000016', 'ec000000-0000-0000-0000-000000000017')$q$,
  0, 'sin vencidos, futuros, cancelados, ausentes ni partidos sin convocar');
select pg_temp.expect_count($q$select 1 from public.my_pending_reports('7')$q$, 0, 'A1 no está en Sevens: nada en 7');
select pg_temp.expect_count($q$select 1 from public.my_pending_reports('15') where kind = 'wellness'$q$, 0, 'hoy no toca bienestar');
select pg_temp.expect_eq($q$select minutes || '/' || estimated from public.my_pending_reports('15') where event_id = 'ec000000-0000-0000-0000-000000000012'$q$,
  '80/true', 'pendiente trae los minutos estimados');
select pg_temp.as_user('61000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_count($q$select 1 from public.my_pending_reports('7') where kind = 'session'$q$, 2, 'A2 en Sevens: entrenamiento y partido');
select pg_temp.as_user('40000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_count($q$select 1 from public.my_pending_reports('15')$q$, 0, 'el staff sin ficha no tiene pendientes');
select pg_temp.expect_error($q$select * from public.my_pending_reports('x')$q$, 'invalid_format', 'formato inválido');
select pg_temp.back();

-- =======================================================================
-- 3. submit_session_rpe
-- =======================================================================
select pg_temp.as_user('60000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_ok($q$select public.submit_session_rpe('ec000000-0000-0000-0000-000000000001', 7::smallint, false)$q$, 'A1 responde t1');
select pg_temp.expect_ok($q$select public.submit_session_rpe('ec000000-0000-0000-0000-000000000001', 8::smallint, false)$q$, 'A1 corrige t1 en el plazo');
select pg_temp.expect_count($q$select 1 from public.session_rpe where event_id = 'ec000000-0000-0000-0000-000000000001' and rpe = 8$q$, 1, 'una sola fila, corregida');
select pg_temp.expect_ok($q$select public.submit_session_rpe('ec000000-0000-0000-0000-000000000007', 3::smallint, false)$q$, 'a las 46 h todavía se puede');
select pg_temp.expect_error($q$select public.submit_session_rpe('ec000000-0000-0000-0000-000000000002', 5::smallint, false)$q$,
  'Ya pasó el plazo para responder', 'más de 48 h después del término');
select pg_temp.expect_error($q$select public.submit_session_rpe('ec000000-0000-0000-0000-000000000003', 5::smallint, false)$q$,
  'El evento todavía no empieza', 'evento futuro');
select pg_temp.expect_error($q$select public.submit_session_rpe('ec000000-0000-0000-0000-000000000004', 5::smallint, false)$q$,
  'El evento fue cancelado', 'evento cancelado');
select pg_temp.expect_error($q$select public.submit_session_rpe('ec000000-0000-0000-0000-000000000005', 5::smallint, false)$q$,
  'Figuras ausente en este entrenamiento', 'ausente en la lista');
select pg_temp.expect_error($q$select public.submit_session_rpe('ec000000-0000-0000-0000-000000000006', 5::smallint, false)$q$,
  'No estás en el grupo Sevens', 'entrenamiento Sevens sin estar en el grupo');
select pg_temp.expect_error($q$select public.submit_session_rpe('ec000000-0000-0000-0000-000000000016', 5::smallint, false)$q$,
  'No estuviste convocado a este partido', 'partido sin convocatoria');
select pg_temp.expect_error($q$select public.submit_session_rpe('ec000000-0000-0000-0000-000000000017', 5::smallint, false)$q$,
  'No estuviste convocado a este partido', 'convocatoria quitada');
select pg_temp.expect_error($q$select public.submit_session_rpe('ec000000-0000-0000-0000-000000000011', 11::smallint, false)$q$,
  'Elige un valor de 0 a 10', 'esfuerzo fuera de escala');
select pg_temp.expect_error($q$select public.submit_session_rpe('ec000000-0000-0000-0000-000000000011', null, false)$q$,
  'Elige un valor de 0 a 10', 'esfuerzo vacío');
select pg_temp.expect_error($q$select public.submit_session_rpe('ec000000-0000-0000-0000-0000000000b1', 5::smallint, false)$q$,
  'not_found', 'evento de otro plantel');
select pg_temp.expect_ok($q$select public.submit_session_rpe('ec000000-0000-0000-0000-000000000011', 9::smallint, false)$q$, 'A1 responde el partido');
select pg_temp.expect_ok($q$select public.submit_session_rpe('ec000000-0000-0000-0000-000000000013', 6::smallint, true)$q$, 'A1 dice que no jugó (el rpe se ignora)');
select pg_temp.expect_count($q$select 1 from public.session_rpe where event_id = 'ec000000-0000-0000-0000-000000000013' and absent and rpe is null$q$, 1, '"no fui" sin esfuerzo');
select pg_temp.expect_count($q$select 1 from public.my_pending_reports('15') where kind = 'session'$q$, 3, 'quedan 3 pendientes');
select pg_temp.expect_fail($q$insert into public.session_rpe (event_id, player_id, club_id, rpe)
  values ('ec000000-0000-0000-0000-000000000012', 'a1c00000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000c1', 5)$q$,
  'sin escritura directa en session_rpe');

select pg_temp.as_user('61000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_ok($q$select public.submit_session_rpe('ec000000-0000-0000-0000-000000000006', 4::smallint, false)$q$, 'A2 (grupo Sevens) responde el entrenamiento Sevens');
select pg_temp.expect_ok($q$select public.submit_session_rpe('ec000000-0000-0000-0000-000000000001', null, true)$q$, 'A2 dice que no fue a t1');

select pg_temp.as_user('62000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_state($q$select public.submit_session_rpe('ec000000-0000-0000-0000-000000000001', 5::smallint, false)$q$, '42501', 'jugador pendiente no responde');
select pg_temp.as_user('40000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_state($q$select public.submit_session_rpe('ec000000-0000-0000-0000-000000000001', 5::smallint, false)$q$, '42501', 'staff sin ficha no responde');
select pg_temp.as_anon();
select pg_temp.expect_fail($q$select public.submit_session_rpe('ec000000-0000-0000-0000-000000000001', 5::smallint, false)$q$, 'anon no responde');
select pg_temp.back();

-- Ficha inactiva: no responde
update public.players set active = false where id = 'a1c00000-0000-0000-0000-000000000001';
select pg_temp.as_user('60000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_state($q$select public.submit_session_rpe('ec000000-0000-0000-0000-000000000012', 5::smallint, false)$q$, '42501', 'jugador inactivo no responde');
select pg_temp.back();
update public.players set active = true where id = 'a1c00000-0000-0000-0000-000000000001';

-- =======================================================================
-- 4. Resumen del evento (staff)
-- =======================================================================
select pg_temp.as_user('40000000-0000-0000-0000-0000000000c1');
-- t1 (15): A1–A5 esperados; A1 respondió 8 × 90 = 720; A2 dijo que no fue.
select pg_temp.expect_eq($q$select (s->>'expected') || '/' || (s->>'responded') || '/' || (s->>'avg_rpe') || '/' || (s->>'avg_load')
  || '/' || jsonb_array_length(s->'missing') || '/' || jsonb_array_length(s->'absent')
  from public.event_rpe_summary('ec000000-0000-0000-0000-000000000001') s$q$, '5/2/8.0/720/3/1', 'resumen de t1');
-- Entrenamiento con lista: A1 (ausente) no se espera.
select pg_temp.expect_eq($q$select s->>'expected' from public.event_rpe_summary('ec000000-0000-0000-0000-000000000005') s$q$, '4', 'el ausente en la lista no se espera');
-- Partido: solo convocados (A1 y A3); A1 respondió 9 × 60.
select pg_temp.expect_eq($q$select (s->>'expected') || '/' || (s->>'responded') || '/' || (s->>'avg_load') || '/' || (s->>'estimated')
  from public.event_rpe_summary('ec000000-0000-0000-0000-000000000011') s$q$, '2/1/540/false', 'resumen del partido');
-- Sevens: solo el grupo (A2).
select pg_temp.expect_eq($q$select (s->>'expected') || '/' || (s->>'responded') from public.event_rpe_summary('ec000000-0000-0000-0000-000000000006') s$q$, '1/1', 'resumen Sevens: el grupo');
select pg_temp.as_user('60000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_state($q$select public.event_rpe_summary('ec000000-0000-0000-0000-000000000001')$q$, '42501', 'un jugador no ve el resumen');
select pg_temp.as_user('10000000-0000-0000-0000-0000000000c2');
select pg_temp.expect_error($q$select public.event_rpe_summary('ec000000-0000-0000-0000-000000000001')$q$, 'not_found', 'el staff de B no ve un evento de A');
select pg_temp.back();

-- =======================================================================
-- 5. Carga semanal
-- =======================================================================
-- Semanas anteriores (lunes 10:00 Chile, 60 min): Cata 3 semanas × (5 × 60) = 300; semana actual 10 × 60 = 600.
-- Dani: solo 2 semanas previas (no alcanza para "Carga alta").
create temp table wk as select date_trunc('week', now() at time zone 'America/Santiago')::date as ws;
insert into public.events (id, club_id, type, starts_at, ends_at, created_by)
select ('ed000000-0000-0000-0000-00000000000' || k)::uuid, 'aaaaaaaa-0000-0000-0000-0000000000c1', 'entrenamiento',
       ((wk.ws - 7 * k) + time '10:00') at time zone 'America/Santiago',
       ((wk.ws - 7 * k) + time '11:00') at time zone 'America/Santiago',
       '10000000-0000-0000-0000-0000000000c1'
  from wk, generate_series(0, 3) k;
insert into public.session_rpe (event_id, player_id, club_id, rpe)
select ('ed000000-0000-0000-0000-00000000000' || k)::uuid, 'a1c00000-0000-0000-0000-000000000003'::uuid, 'aaaaaaaa-0000-0000-0000-0000000000c1'::uuid,
       (case when k = 0 then 10 else 5 end)::smallint
  from generate_series(0, 3) k
union all
select ('ed000000-0000-0000-0000-00000000000' || k)::uuid, 'a1c00000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-0000000000c1', 9
  from generate_series(0, 2) k;

select pg_temp.as_user('55000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_eq($q$select (l->>'current_load') || '/' || (l->>'baseline') || '/' || (l->>'prior_weeks') || '/' || (l->>'high_load')
  || '/' || (l->>'pct_over') || '/' || jsonb_array_length(l->'weeks')
  from public.player_weekly_load('a1c00000-0000-0000-0000-000000000003') l$q$, '600/300.0/3/true/100/6', 'Cata: carga alta, +100 %');
select pg_temp.expect_eq($q$select (l->>'high_load') || '/' || (l->>'prior_weeks') from public.player_weekly_load('a1c00000-0000-0000-0000-000000000004') l$q$,
  'false/2', 'Dani: 2 semanas previas no alcanzan');
select pg_temp.expect_count($q$select 1 from public.team_srpe_load('15') where high_load$q$, 1, 'una "Carga alta" en el plantel');
select pg_temp.expect_count($q$select 1 from public.team_srpe_load('7')$q$, 1, 'en Sevens, solo el grupo');
select pg_temp.expect_eq($q$select l->>'current_load' from public.player_weekly_load('a1c00000-0000-0000-0000-000000000003', 6, '7') l$q$,
  '0', 'la carga por formato no mezcla 15 y 7');
select pg_temp.expect_error($q$select public.player_weekly_load('a1c00000-0000-0000-0000-000000000003', 0)$q$, 'Semanas fuera de rango', 'semanas inválidas');

select pg_temp.as_user('60000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_ok($q$select public.player_weekly_load('a1c00000-0000-0000-0000-000000000001')$q$, 'el jugador ve su propia carga');
select pg_temp.expect_state($q$select public.player_weekly_load('a1c00000-0000-0000-0000-000000000003')$q$, '42501', 'el jugador no ve la carga de otro');
select pg_temp.expect_state($q$select * from public.team_srpe_load('15')$q$, '42501', 'el jugador no ve la carga del plantel');
select pg_temp.as_user('10000000-0000-0000-0000-0000000000c2');
select pg_temp.expect_state($q$select public.player_weekly_load('a1c00000-0000-0000-0000-000000000003')$q$, '42501', 'el staff de B no ve la carga de A');
select pg_temp.back();

-- =======================================================================
-- 6. Check de bienestar
-- =======================================================================
-- set_wellness_days: head coach, manager y preparador físico; nadie más.
select pg_temp.as_user('55000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_ok($q$select public.set_wellness_days(array[3, 1]::smallint[])$q$, 'preparador físico elige días');
select pg_temp.expect_count($q$select 1 from public.clubs where id = 'aaaaaaaa-0000-0000-0000-0000000000c1' and wellness_days = '{1,3}'$q$, 1, 'días guardados y ordenados');
select pg_temp.expect_error($q$select public.set_wellness_days('{}'::smallint[])$q$, 'Elige entre 1 y 7 días, sin repetir', 'sin días');
select pg_temp.expect_error($q$select public.set_wellness_days(array[8]::smallint[])$q$, 'Elige entre 1 y 7 días, sin repetir', 'día 8');
select pg_temp.expect_error($q$select public.set_wellness_days(array[2, 2]::smallint[])$q$, 'Elige entre 1 y 7 días, sin repetir', 'días repetidos');
select pg_temp.as_user('10000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_ok($q$select public.set_wellness_days(array[1]::smallint[])$q$, 'head coach elige días');
select pg_temp.as_user('20000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_ok($q$select public.set_wellness_days(array[1, 4]::smallint[])$q$, 'manager elige días');
select pg_temp.as_user('30000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_state($q$select public.set_wellness_days(array[1]::smallint[])$q$, '42501', 'kine no elige días');
select pg_temp.as_user('40000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_state($q$select public.set_wellness_days(array[1]::smallint[])$q$, '42501', 'entrenador no elige días');
select pg_temp.as_user('60000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_state($q$select public.set_wellness_days(array[1]::smallint[])$q$, '42501', 'jugador no elige días');
select pg_temp.as_user('10000000-0000-0000-0000-0000000000c2');
select pg_temp.expect_ok($q$select public.set_wellness_days(array[5]::smallint[])$q$, 'head coach de B en su plantel');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.clubs where id = 'aaaaaaaa-0000-0000-0000-0000000000c1' and wellness_days = '{1,4}'$q$, 1, 'B no cambió los días de A');
select pg_temp.expect_fail($q$update public.clubs set wellness_days = '{1,1}' where id = 'aaaaaaaa-0000-0000-0000-0000000000c1'$q$, 'check: sin repetidos');

-- Hoy toca: report_date = hoy.
update public.clubs set wellness_days = array[(select td from dw)] where id = 'aaaaaaaa-0000-0000-0000-0000000000c1';
select pg_temp.as_user('60000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_count($q$select 1 from public.my_pending_reports('15') where kind = 'wellness'
  and report_date = (now() at time zone 'America/Santiago')::date$q$, 1, 'pendiente: bienestar de hoy');
select pg_temp.expect_error($q$select public.submit_wellness(5::smallint, 4::smallint, 3::smallint, 2::smallint, 0::smallint)$q$,
  'Responde las 5 preguntas con un valor de 1 a 5', 'ítem fuera de escala');
select pg_temp.expect_eq($q$select public.submit_wellness(5::smallint, 4::smallint, 3::smallint, 2::smallint, 1::smallint)::text$q$,
  ((now() at time zone 'America/Santiago')::date)::text, 'responde hoy');
select pg_temp.expect_ok($q$select public.submit_wellness(5::smallint, 5::smallint, 5::smallint, 5::smallint, 5::smallint)$q$, 'corrige el mismo día');
select pg_temp.expect_count($q$select 1 from public.wellness_reports where player_id = 'a1c00000-0000-0000-0000-000000000001' and total = 25$q$, 1, 'una fila, total 25');
select pg_temp.expect_count($q$select 1 from public.my_pending_reports('15') where kind = 'wellness'$q$, 0, 'ya no está pendiente');
select pg_temp.expect_fail($q$insert into public.wellness_reports (club_id, player_id, report_date, fatigue, sleep, soreness, stress, mood)
  values ('aaaaaaaa-0000-0000-0000-0000000000c1', 'a1c00000-0000-0000-0000-000000000001', current_date - 3, 1, 1, 1, 1, 1)$q$,
  'sin escritura directa en wellness_reports');
select pg_temp.back();

-- Ayer tocaba y hoy no: report_date = ayer.
update public.clubs set wellness_days = array[(select yd from dw)] where id = 'aaaaaaaa-0000-0000-0000-0000000000c1';
select pg_temp.as_user('61000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_count($q$select 1 from public.my_pending_reports('15') where kind = 'wellness'
  and report_date = (now() at time zone 'America/Santiago')::date - 1$q$, 1, 'pendiente: bienestar de ayer');
select pg_temp.expect_eq($q$select public.submit_wellness(3::smallint, 3::smallint, 3::smallint, 3::smallint, 3::smallint)::text$q$,
  ((now() at time zone 'America/Santiago')::date - 1)::text, 'responde al día siguiente');
select pg_temp.back();

-- Ni hoy ni ayer.
update public.clubs set wellness_days = array[((select td from dw) % 7) + 1]::smallint[] where id = 'aaaaaaaa-0000-0000-0000-0000000000c1';
select pg_temp.as_user('60000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_error($q$select public.submit_wellness(3::smallint, 3::smallint, 3::smallint, 3::smallint, 3::smallint)$q$,
  'Hoy no toca el check de bienestar', 'día sin check');
select pg_temp.as_user('62000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_state($q$select public.submit_wellness(3::smallint, 3::smallint, 3::smallint, 3::smallint, 3::smallint)$q$, '42501', 'pendiente no responde bienestar');
select pg_temp.back();

-- wellness_flags: Cata cae de 20 a 15 (4 previos) → bajo; Dani con un ítem en 1 → bajo; Eli estable → no.
insert into public.wellness_reports (club_id, player_id, report_date, fatigue, sleep, soreness, stress, mood)
select 'aaaaaaaa-0000-0000-0000-0000000000c1'::uuid, x.p::uuid, (now() at time zone 'America/Santiago')::date - x.dd, x.f::smallint, x.s::smallint, x.so::smallint, x.st::smallint, x.m::smallint
  from (values
  ('a1c00000-0000-0000-0000-000000000003', 1, 3, 3, 3, 3, 3),
  ('a1c00000-0000-0000-0000-000000000003', 8, 4, 4, 4, 4, 4), ('a1c00000-0000-0000-0000-000000000003', 15, 4, 4, 4, 4, 4),
  ('a1c00000-0000-0000-0000-000000000003', 22, 4, 4, 4, 4, 4), ('a1c00000-0000-0000-0000-000000000003', 29, 4, 4, 4, 4, 4),
  ('a1c00000-0000-0000-0000-000000000004', 2, 5, 1, 5, 5, 5),
  ('a1c00000-0000-0000-0000-000000000005', 2, 4, 4, 4, 4, 4),
  ('a1c00000-0000-0000-0000-000000000005', 9, 4, 4, 4, 4, 4), ('a1c00000-0000-0000-0000-000000000005', 16, 4, 4, 4, 4, 4),
  ('a1c00000-0000-0000-0000-000000000005', 23, 4, 4, 4, 4, 4),
  ('a1c00000-0000-0000-0000-000000000005', 40, 1, 1, 1, 1, 1)  -- fuera de los 7 días, no es el último
  ) x(p, dd, f, s, so, st, m)
union all
select 'bbbbbbbb-0000-0000-0000-0000000000c2', 'b1c00000-0000-0000-0000-000000000001', (now() at time zone 'America/Santiago')::date, 1, 1, 1, 1, 1;

select pg_temp.as_user('30000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_eq($q$select string_agg(full_name || ':' || low || ':' || total, ',' order by full_name) from public.wellness_flags('15')$q$,
  'Ana Uno:false:25,Bea Dos:false:15,Cata Tres:true:15,Dani Cuatro:true:21,Eli Cinco:false:20', 'marcas de bienestar');
select pg_temp.expect_eq($q$select array_to_string(low_items, ',') from public.wellness_flags('15') where full_name = 'Dani Cuatro'$q$, 'sleep', 'ítems bajos de Dani');
select pg_temp.expect_count($q$select 1 from public.wellness_flags('7')$q$, 1, 'en Sevens, solo el grupo');
select pg_temp.expect_count($q$select 1 from public.wellness_reports where club_id = 'bbbbbbbb-0000-0000-0000-0000000000c2'$q$, 0, 'el staff de A no lee bienestar de B');
select pg_temp.expect_count($q$select 1 from public.session_rpe where club_id = 'aaaaaaaa-0000-0000-0000-0000000000c1'$q$, 13, 'el staff lee todo el sRPE del plantel');
select pg_temp.as_user('60000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_state($q$select * from public.wellness_flags('15')$q$, '42501', 'el jugador no ve las marcas');
select pg_temp.expect_count($q$select 1 from public.wellness_reports$q$, 1, 'el jugador solo lee su bienestar');
select pg_temp.expect_count($q$select 1 from public.session_rpe where player_id <> 'a1c00000-0000-0000-0000-000000000001'$q$, 0, 'el jugador no lee el sRPE de otros');
select pg_temp.as_user('10000000-0000-0000-0000-0000000000c2');
select pg_temp.expect_count($q$select 1 from public.wellness_flags('15') where player_id::text like 'a1c%'$q$, 0, 'el staff de B no ve marcas de A');
select pg_temp.expect_count($q$select 1 from public.session_rpe where club_id = 'aaaaaaaa-0000-0000-0000-0000000000c1'$q$, 0, 'el staff de B no lee sRPE de A');
select pg_temp.as_anon();
select pg_temp.expect_fail($q$select 1 from public.session_rpe$q$, 'anon no lee session_rpe');
select pg_temp.expect_fail($q$select 1 from public.wellness_reports$q$, 'anon no lee wellness_reports');
select pg_temp.back();

-- =======================================================================
-- 7. my_session_report (20261105190000): una sesión propia
-- =======================================================================
select pg_temp.as_user('60000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_eq($q$select (r->>'answered') || '/' || (r->>'rpe') || '/' || (r->>'minutes') || '/' || (r->>'can_submit')
  from public.my_session_report('ec000000-0000-0000-0000-000000000001') r$q$, 'true/8/90/true', 'sesión respondida y corregible');
select pg_temp.expect_eq($q$select (r->>'answered') || '/' || (r->>'minutes') || '/' || (r->>'estimated') || '/' || (r->>'can_submit')
  from public.my_session_report('ec000000-0000-0000-0000-000000000012') r$q$, 'false/80/true/true', 'partido pendiente, estimado');
select pg_temp.expect_eq($q$select (r->>'can_submit') || '/' || (r->>'reason') from public.my_session_report('ec000000-0000-0000-0000-000000000002') r$q$,
  'false/Ya pasó el plazo para responder', 'vencido: no se puede responder');
select pg_temp.expect_error($q$select public.my_session_report('ec000000-0000-0000-0000-0000000000b1')$q$, 'not_found', 'evento de otro plantel');
select pg_temp.as_user('40000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_state($q$select public.my_session_report('ec000000-0000-0000-0000-000000000001')$q$, '42501', 'staff sin ficha');
select pg_temp.back();

select 'OK: load_wellness_test' as resultado;
rollback;
