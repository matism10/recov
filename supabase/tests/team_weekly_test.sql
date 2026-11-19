-- Recov · Test de la carga del plantel por semana y del bienestar del plantel (20261118120000)
-- Autónomo: crea sus propios datos y termina en ROLLBACK. Si algo falla, lanza un error que empieza con "FAIL".
-- Cubre: jugador sin acceso, staff sin carga_ver sin acceso, aislamiento entre clubes,
-- formato Sevens, semana en curso, suma del gimnasio y el bienestar (orden y orientación).

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
create function pg_temp.expect_fail(q text, label text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then return; end;
  raise exception 'FAIL: % (debía fallar y no falló)', label;
end $$;
create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FAIL: %', label; end if; end $$;
-- Lunes de la semana actual (n = 0) o de n semanas antes/después, en Chile.
create function pg_temp.monday(n int) returns date language sql as $$
  select date_trunc('week', now() at time zone 'America/Santiago')::date + 7 * n $$;
-- Instante del lunes de esa semana a las 00:05 en Chile (siempre dentro de la semana).
create function pg_temp.at_monday(n int) returns timestamptz language sql as $$
  select (pg_temp.monday(n)::timestamp + time '00:05') at time zone 'America/Santiago' $$;

-- Datos (como postgres) ----------------------------------------------------
insert into public.clubs (id, name, sport, slug, has_sevens) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', 'Club A semana', 'rugby',  'club-a-semana', true),
  ('bbbbbbbb-0000-0000-0000-0000000000d2', 'Club B semana', 'hockey', 'club-b-semana', false);

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-0000000000d1', 'hc-a@semana.test'),
  ('30000000-0000-0000-0000-0000000000d1', 'kine-a@semana.test'),
  ('40000000-0000-0000-0000-0000000000d1', 'coach-a@semana.test'),
  ('60000000-0000-0000-0000-0000000000d1', 'j1-a@semana.test'),
  ('61000000-0000-0000-0000-0000000000d1', 'j2-a@semana.test'),
  ('10000000-0000-0000-0000-0000000000d2', 'hc-b@semana.test');

with v(id, club_id, roles, full_name) as (values
  ('10000000-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000d1', '{head_coach}',  'HC A'),
  ('30000000-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000d1', '{kinesiologo}', 'Kine A'),
  ('40000000-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000d1', '{entrenador}',  'Coach A'),
  ('60000000-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000d1', '{jugador}',     'J1 A'),
  ('61000000-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000d1', '{jugador}',     'J2 A'),
  ('10000000-0000-0000-0000-0000000000d2', 'bbbbbbbb-0000-0000-0000-0000000000d2', '{head_coach}',  'HC B')),
     p as (insert into public.profiles (id, full_name) select id::uuid, full_name from v)
insert into public.club_members (user_id, club_id, roles, status)
select id::uuid, club_id::uuid, roles::public.user_role[], 'confirmado' from v;

-- El entrenador pierde carga_ver (ajuste por persona; la plantilla del rol lo trae).
insert into public.member_permissions (club_id, user_id, perm, granted, set_by)
values ('aaaaaaaa-0000-0000-0000-0000000000d1', '40000000-0000-0000-0000-0000000000d1', 'carga_ver', false,
        '10000000-0000-0000-0000-0000000000d1');

-- Fichas: P1 (J1, en el grupo Sevens), P2 (J2), P3 sin cuenta, P4 inactivo; B1 en el club B.
insert into public.players (id, club_id, full_name, status, availability, user_id, active) values
  ('a1d00000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'Pablo Uno',   'confirmado', 'disponible', '60000000-0000-0000-0000-0000000000d1', true),
  ('a1d00000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'Pedro Dos',   'confirmado', 'disponible', '61000000-0000-0000-0000-0000000000d1', true),
  ('a1d00000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'Paco Tres',   'confirmado', 'disponible', null, true),
  ('a1d00000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'Pía Inactiva','confirmado', 'disponible', null, false),
  ('b1d00000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-0000000000d2', 'Beto B',      'confirmado', 'disponible', null, true);

insert into public.sevens_group (club_id, member_id)
values ('aaaaaaaa-0000-0000-0000-0000000000d1', '60000000-0000-0000-0000-0000000000d1');

-- Entrenamientos de 60 min el lunes a las 00:05 (Chile): semana actual (15 y 7), la
-- anterior (15) y uno del club B en la semana actual.
insert into public.events (id, club_id, type, starts_at, ends_at, created_by, format) values
  ('ed000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'entrenamiento',
   pg_temp.at_monday(0), pg_temp.at_monday(0) + interval '60 minutes', '10000000-0000-0000-0000-0000000000d1', '15'),
  ('ed000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'entrenamiento',
   pg_temp.at_monday(-1), pg_temp.at_monday(-1) + interval '60 minutes', '10000000-0000-0000-0000-0000000000d1', '15'),
  ('ed000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'entrenamiento',
   pg_temp.at_monday(0), pg_temp.at_monday(0) + interval '60 minutes', '10000000-0000-0000-0000-0000000000d1', '7'),
  ('ed000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-0000000000d2', 'entrenamiento',
   pg_temp.at_monday(0), pg_temp.at_monday(0) + interval '60 minutes', '10000000-0000-0000-0000-0000000000d2', '15');

insert into public.session_rpe (event_id, player_id, club_id, rpe) values
  ('ed000000-0000-0000-0000-000000000001', 'a1d00000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000d1', 6), -- 360
  ('ed000000-0000-0000-0000-000000000001', 'a1d00000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-0000000000d1', 5), -- 300
  ('ed000000-0000-0000-0000-000000000001', 'a1d00000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-0000000000d1', 9), -- inactivo: no cuenta
  ('ed000000-0000-0000-0000-000000000002', 'a1d00000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000d1', 4), -- 240, semana anterior
  ('ed000000-0000-0000-0000-000000000003', 'a1d00000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000d1', 8), -- 480, Sevens
  ('ed000000-0000-0000-0000-0000000000b1', 'b1d00000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-0000000000d2', 10); -- 600, club B

-- Gimnasio (sin formato): P2 hoy con esfuerzo 5 × 60 = 300; P3 el lunes anterior 3 × 60 = 180;
-- P3 hoy sin esfuerzo (no suma ni cuenta como respuesta).
insert into public.gym_session_logs (club_id, player_id, performed_on, minutes, completed_all, rpe) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', 'a1d00000-0000-0000-0000-000000000002', private.chile_today(), 60, true, 5),
  ('aaaaaaaa-0000-0000-0000-0000000000d1', 'a1d00000-0000-0000-0000-000000000003', pg_temp.monday(-1), 60, true, 3),
  ('aaaaaaaa-0000-0000-0000-0000000000d1', 'a1d00000-0000-0000-0000-000000000003', private.chile_today(), 60, true, null);

-- Bienestar (5 = mejor): P1 hace 1 día 13/25, P2 hoy 24/25, P3 hace 2 días 16/25,
-- P1 hace 20 días 20/25 (no es el último), B1 hoy 5/25 (otro club).
insert into public.wellness_reports (club_id, player_id, report_date, fatigue, sleep, soreness, stress, mood) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', 'a1d00000-0000-0000-0000-000000000001', private.chile_today() - 1,  2, 3, 2, 3, 3),
  ('aaaaaaaa-0000-0000-0000-0000000000d1', 'a1d00000-0000-0000-0000-000000000002', private.chile_today(),      5, 5, 5, 5, 4),
  ('aaaaaaaa-0000-0000-0000-0000000000d1', 'a1d00000-0000-0000-0000-000000000003', private.chile_today() - 2,  3, 1, 4, 4, 4),
  ('aaaaaaaa-0000-0000-0000-0000000000d1', 'a1d00000-0000-0000-0000-000000000001', private.chile_today() - 20, 4, 4, 4, 4, 4),
  ('bbbbbbbb-0000-0000-0000-0000000000d2', 'b1d00000-0000-0000-0000-000000000001', private.chile_today(),      1, 1, 1, 1, 1);

-- =======================================================================
-- 1. Acceso: jugador, staff sin carga_ver y anon no; kine (con carga_ver) sí
-- =======================================================================
select pg_temp.as_user('60000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_fail($q$select * from public.team_load_weekly(6, '15')$q$, 'jugador lee team_load_weekly');
select pg_temp.expect_fail($q$select public.team_wellness_summary('15')$q$, 'jugador lee team_wellness_summary');
select pg_temp.back();

select pg_temp.as_user('40000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_fail($q$select * from public.team_load_weekly(6, '15')$q$, 'entrenador sin carga_ver lee team_load_weekly');
select pg_temp.expect_fail($q$select public.team_wellness_summary('15')$q$, 'entrenador sin carga_ver lee team_wellness_summary');
select pg_temp.back();

select pg_temp.as_anon();
select pg_temp.expect_fail($q$select * from public.team_load_weekly(6, '15')$q$, 'anon lee team_load_weekly');
select pg_temp.expect_fail($q$select public.team_wellness_summary('15')$q$, 'anon lee team_wellness_summary');
select pg_temp.back();

select pg_temp.as_user('30000000-0000-0000-0000-0000000000d1');
select pg_temp.check((select count(*) from public.team_load_weekly(6, '15')) = 6, 'kine con carga_ver: 6 semanas');
select pg_temp.check(public.team_wellness_summary('15') is not null, 'kine con carga_ver: bienestar');
select pg_temp.expect_fail($q$select * from public.team_load_weekly(0, '15')$q$, 'p_weeks fuera de rango');
select pg_temp.expect_fail($q$select * from public.team_load_weekly(6, '10')$q$, 'formato inválido');
select pg_temp.expect_fail($q$select public.team_wellness_summary(null)$q$, 'formato nulo');
select pg_temp.back();

-- =======================================================================
-- 2. Carga por semana (head coach A, Rugby 15)
-- =======================================================================
select pg_temp.as_user('10000000-0000-0000-0000-0000000000d1');

-- Semana en curso: una sola, la actual, y es la última.
select pg_temp.check((select count(*) from public.team_load_weekly(6, '15') where in_progress) = 1, 'una sola semana en curso');
select pg_temp.check((select week_start from public.team_load_weekly(6, '15') where in_progress) = pg_temp.monday(0), 'la semana en curso es la actual');
select pg_temp.check((select max(week_start) from public.team_load_weekly(6, '15')) = pg_temp.monday(0)
                     and (select min(week_start) from public.team_load_weekly(6, '15')) = pg_temp.monday(-5), '6 semanas de lunes a lunes');

-- Semana actual: cancha 360 + 300 (el inactivo no cuenta), gimnasio 300 (P2), sin Sevens.
select pg_temp.check((select cancha from public.team_load_weekly(6, '15') where in_progress) = 660, 'cancha de la semana: 660 (sin el inactivo ni Sevens)');
select pg_temp.check((select gimnasio from public.team_load_weekly(6, '15') where in_progress) = 300, 'gimnasio de la semana: 300 (sin el registro sin esfuerzo)');
select pg_temp.check((select partido from public.team_load_weekly(6, '15') where in_progress) = 0, 'partido de la semana: 0');
select pg_temp.check((select total from public.team_load_weekly(6, '15') where in_progress) = 960, 'total de la semana: 960');
select pg_temp.check((select responded from public.team_load_weekly(6, '15') where in_progress) = 2, 'respondieron 2 (P1 y P2)');
select pg_temp.check((select avg_load from public.team_load_weekly(6, '15') where in_progress) = 480, 'promedio por jugador que respondió: 480');
select pg_temp.check((select roster from public.team_load_weekly(6, '15') where in_progress) = 3, 'plantel activo en 15: 3');

-- Semana anterior: cancha 240 (P1) + gimnasio 180 (P3) = 420 / 2 = 210.
select pg_temp.check((select gimnasio from public.team_load_weekly(6, '15') where week_start = pg_temp.monday(-1)) = 180, 'gimnasio de la semana anterior: 180');
select pg_temp.check((select avg_load from public.team_load_weekly(6, '15') where week_start = pg_temp.monday(-1)) = 210, 'promedio de la semana anterior: 210');
select pg_temp.check((select not in_progress from public.team_load_weekly(6, '15') where week_start = pg_temp.monday(-1)), 'la anterior no está en curso');
-- Referencia de la semana actual: promedio de las 4 anteriores con datos (solo una: 210).
select pg_temp.check((select prior_avg from public.team_load_weekly(6, '15') where in_progress) = 210
                     and (select prior_weeks from public.team_load_weekly(6, '15') where in_progress) = 1, 'referencia: 210 con 1 semana previa');
-- Semanas sin datos: 0 y sin promedio.
select pg_temp.check((select responded = 0 and avg_load is null from public.team_load_weekly(6, '15') where week_start = pg_temp.monday(-3)), 'semana sin datos');

-- =======================================================================
-- 3. Formato Sevens: solo el grupo (P1) y solo eventos en 7; el gimnasio de P2 no entra
-- =======================================================================
select pg_temp.check((select cancha from public.team_load_weekly(6, '7') where in_progress) = 480, 'Sevens: cancha 480');
select pg_temp.check((select gimnasio from public.team_load_weekly(6, '7') where in_progress) = 0, 'Sevens: sin el gimnasio de quien no está en el grupo');
select pg_temp.check((select responded from public.team_load_weekly(6, '7') where in_progress) = 1, 'Sevens: respondió 1');
select pg_temp.check((select roster from public.team_load_weekly(6, '7') where in_progress) = 1, 'Sevens: plantel de 1');
select pg_temp.check((select (public.team_wellness_summary('7') -> 'lowest' -> 0 ->> 'player_id')::uuid) = 'a1d00000-0000-0000-0000-000000000001'
                     and jsonb_array_length(public.team_wellness_summary('7') -> 'lowest') = 1, 'Sevens: bienestar solo del grupo');

-- =======================================================================
-- 4. Bienestar del plantel (Rugby 15)
-- =======================================================================
select pg_temp.check(jsonb_array_length(public.team_wellness_summary('15') -> 'weeks') = 6, 'bienestar: 6 semanas');
select pg_temp.check((select count(*) from jsonb_array_elements(public.team_wellness_summary('15') -> 'weeks') w
                       where (w ->> 'in_progress')::boolean) = 1, 'bienestar: una semana en curso');
select pg_temp.check((public.team_wellness_summary('15') ->> 'recent_responded')::int = 3, 'bienestar: 3 respondieron en 7 días');
select pg_temp.check((public.team_wellness_summary('15') ->> 'recent_avg')::numeric = 17.7, 'bienestar: promedio (13 + 24 + 16) / 3 = 17,7');
select pg_temp.check((select string_agg(x ->> 'total', ',' order by o)
                        from jsonb_array_elements(public.team_wellness_summary('15') -> 'lowest') with ordinality t(x, o)) = '13,16,24',
                     'bienestar: los 3 más bajos en orden (y el check viejo de P1 no cuenta)');
-- Orientación del jugador: fatiga guardada 2 → se ve 4; sueño 3 → 3.
select pg_temp.check((select (i ->> 'shown')::int = 4 and (i ->> 'stored')::int = 2
                        from jsonb_array_elements(public.team_wellness_summary('15') -> 'lowest' -> 0 -> 'items') i
                       where i ->> 'key' = 'fatigue'), 'bienestar: fatiga en la orientación del jugador');
select pg_temp.check((select (i ->> 'shown')::int = 3
                        from jsonb_array_elements(public.team_wellness_summary('15') -> 'lowest' -> 0 -> 'items') i
                       where i ->> 'key' = 'sleep'), 'bienestar: sueño sin invertir');
select pg_temp.back();

-- =======================================================================
-- 5. Aislamiento entre clubes: B ve solo lo suyo y A no ve lo de B
-- =======================================================================
select pg_temp.as_user('10000000-0000-0000-0000-0000000000d2');
select pg_temp.check((select cancha from public.team_load_weekly(6, '15') where in_progress) = 600, 'club B: solo su entrenamiento');
select pg_temp.check((select roster from public.team_load_weekly(6, '15') where in_progress) = 1, 'club B: plantel de 1');
select pg_temp.check((public.team_wellness_summary('15') -> 'lowest' -> 0 ->> 'total')::int = 5
                     and jsonb_array_length(public.team_wellness_summary('15') -> 'lowest') = 1, 'club B: solo su bienestar');
select pg_temp.back();

select pg_temp.as_user('10000000-0000-0000-0000-0000000000d1');
select pg_temp.check(not exists (select 1 from jsonb_array_elements(public.team_wellness_summary('15') -> 'lowest') x
                                  where x ->> 'player_id' = 'b1d00000-0000-0000-0000-000000000001'), 'club A no ve el bienestar de B');
select pg_temp.back();

select 'team_weekly_test: OK' as resultado;
rollback;
