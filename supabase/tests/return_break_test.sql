-- Recov · Test de vuelta tras parón (20261110130000)
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
create function pg_temp.expect_fail(q text, label text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then return; end;
  raise exception 'FAIL: % (debía fallar y no falló)', label;
end $$;
create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FAIL: %', label; end if; end $$;
-- Día relativo a hoy en Chile.
create function pg_temp.d(n int) returns date language sql as $$ select private.chile_today() + n $$;
-- Un día de actividad: sesión de gimnasio (señal positiva).
create function pg_temp.gym(p uuid, n int, rpe int default null) returns void language sql as $$
  insert into public.gym_session_logs (club_id, player_id, performed_on, minutes, completed_all, rpe)
  values ('aaaaaaaa-0000-0000-0000-0000000000b1', p, pg_temp.d(n), 60, true, rpe) $$;
create function pg_temp.injury(p uuid, a int, b int) returns void language sql as $$
  insert into public.injuries (club_id, player_id, type, status, started_on, closed_on)
  values ('aaaaaaaa-0000-0000-0000-0000000000b1', p, 'Esguince', (case when b is null then 'activa' else 'cerrada' end)::public.injury_status,
          pg_temp.d(a), case when b is null then null else pg_temp.d(b) end) $$;
create function pg_temp.flagged(fmt text default '15') returns int language sql as $$
  select count(*)::int from private.return_team('aaaaaaaa-0000-0000-0000-0000000000b1', fmt) $$;

-- Datos -------------------------------------------------------------------
insert into public.clubs (id, name, sport, slug) values
  ('aaaaaaaa-0000-0000-0000-0000000000b1', 'Club A', 'hockey', 'club-a-ret'),
  ('bbbbbbbb-0000-0000-0000-0000000000b2', 'Club B', 'hockey', 'club-b-ret');
insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-0000000000b1', 'hc-a@ret.test'),
  ('60000000-0000-0000-0000-0000000000b1', 'p1@ret.test'),
  ('60000000-0000-0000-0000-0000000000b2', 'p2@ret.test'),
  ('10000000-0000-0000-0000-0000000000b2', 'hc-b@ret.test');
with v(id, club_id, roles, full_name) as (values
  ('10000000-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000b1', '{head_coach}', 'HC A'),
  ('60000000-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000b1', '{jugador}',    'P1 Lesión'),
  ('60000000-0000-0000-0000-0000000000b2', 'aaaaaaaa-0000-0000-0000-0000000000b1', '{jugador}',    'P2 Vacaciones'),
  ('10000000-0000-0000-0000-0000000000b2', 'bbbbbbbb-0000-0000-0000-0000000000b2', '{head_coach}', 'HC B')),
     p as (insert into public.profiles (id, full_name) select id::uuid, full_name from v)
insert into public.club_members (user_id, club_id, roles, status)
select id::uuid, club_id::uuid, roles::public.user_role[], 'confirmado' from v;

insert into public.players (id, club_id, full_name, position, status, availability, user_id)
select ('c1000000-0000-0000-0000-0000000000b' || n)::uuid, 'aaaaaaaa-0000-0000-0000-0000000000b1',
       'P' || n, null, 'confirmado', 'disponible',
       case n when 1 then '60000000-0000-0000-0000-0000000000b1'::uuid
              when 2 then '60000000-0000-0000-0000-0000000000b2'::uuid end
  from generate_series(1, 8) n;

-- Eventos pasados (para "No fui" y la lista).
insert into public.events (id, club_id, type, starts_at, ends_at, created_by) values
  ('e0000000-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000b1', 'entrenamiento',
   (pg_temp.d(-10)::timestamp + time '19:00') at time zone 'America/Santiago',
   (pg_temp.d(-10)::timestamp + time '20:00') at time zone 'America/Santiago', '10000000-0000-0000-0000-0000000000b1'),
  ('e0000000-0000-0000-0000-0000000000b2', 'aaaaaaaa-0000-0000-0000-0000000000b1', 'entrenamiento',
   (pg_temp.d(-8)::timestamp + time '19:00') at time zone 'America/Santiago',
   (pg_temp.d(-8)::timestamp + time '20:00') at time zone 'America/Santiago', '10000000-0000-0000-0000-0000000000b1');

-- P1: gimnasio hace 30 días (con esfuerzo), lesión del -29 al -5, vuelve hace 3 días.
select pg_temp.gym('c1000000-0000-0000-0000-0000000000b1', -30, 5);
select pg_temp.injury('c1000000-0000-0000-0000-0000000000b1', -29, -5);
select pg_temp.gym('c1000000-0000-0000-0000-0000000000b1', -3, 6);
-- P2: hace 40 días, vacaciones declaradas del -39 al -8, vuelve hace 2 días.
select pg_temp.gym('c1000000-0000-0000-0000-0000000000b2', -40);
insert into public.absences (club_id, player_id, scope, starts_on, ends_on, reason, created_by)
values ('aaaaaaaa-0000-0000-0000-0000000000b1', 'c1000000-0000-0000-0000-0000000000b2', 'periodo',
        pg_temp.d(-39), pg_temp.d(-8), 'vacaciones', '10000000-0000-0000-0000-0000000000b1');
select pg_temp.gym('c1000000-0000-0000-0000-0000000000b2', -2);
-- P3: huecos sin evidencia (sin respuesta no es parón).
select pg_temp.gym('c1000000-0000-0000-0000-0000000000b3', -20);
select pg_temp.gym('c1000000-0000-0000-0000-0000000000b3', -2);
-- P4: "No fui" en el entrenamiento del -10; vuelve hace 1 día (hueco de 18 días).
select pg_temp.gym('c1000000-0000-0000-0000-0000000000b4', -20);
insert into public.session_rpe (event_id, player_id, club_id, rpe, absent)
values ('e0000000-0000-0000-0000-0000000000b1', 'c1000000-0000-0000-0000-0000000000b4', 'aaaaaaaa-0000-0000-0000-0000000000b1', null, true);
select pg_temp.gym('c1000000-0000-0000-0000-0000000000b4', -1);
-- P5: ausente en la lista del -8; hueco de exactamente 10 días (-12 a -1).
select pg_temp.gym('c1000000-0000-0000-0000-0000000000b5', -12);
insert into public.event_attendance (event_id, player_id, club_id, present, recorded_by)
values ('e0000000-0000-0000-0000-0000000000b2', 'c1000000-0000-0000-0000-0000000000b5', 'aaaaaaaa-0000-0000-0000-0000000000b1', false, '10000000-0000-0000-0000-0000000000b1');
select pg_temp.gym('c1000000-0000-0000-0000-0000000000b5', -1);
-- P6: hueco de 8 días (menor al umbral), aun con evidencia.
select pg_temp.gym('c1000000-0000-0000-0000-0000000000b6', -12);
insert into public.event_attendance (event_id, player_id, club_id, present, recorded_by)
values ('e0000000-0000-0000-0000-0000000000b2', 'c1000000-0000-0000-0000-0000000000b6', 'aaaaaaaa-0000-0000-0000-0000000000b1', false, '10000000-0000-0000-0000-0000000000b1');
select pg_temp.gym('c1000000-0000-0000-0000-0000000000b6', -3);
-- P7: volvió hace 40 días (fuera de la ventana de 14).
select pg_temp.gym('c1000000-0000-0000-0000-0000000000b7', -60);
select pg_temp.injury('c1000000-0000-0000-0000-0000000000b7', -59, -45);
select pg_temp.gym('c1000000-0000-0000-0000-0000000000b7', -40);
-- P8: lesionado todavía, sin volver.
select pg_temp.gym('c1000000-0000-0000-0000-0000000000b8', -30);
select pg_temp.injury('c1000000-0000-0000-0000-0000000000b8', -29, null);

-- =======================================================================
-- 1. Umbrales y vueltas individuales (4 de 8 = 50 %: sin aviso de equipo)
-- =======================================================================
select pg_temp.check(private.break_days() = 10 and private.return_window_days() = 14
                     and private.team_break_share() = 0.6, 'umbrales provisorios');
select pg_temp.check(pg_temp.flagged() = 4, 'vuelven P1, P2, P4 y P5 (P3 sin evidencia, P6 bajo el umbral, P7 fuera de ventana, P8 sin volver)');
select pg_temp.check((select bool_and(not in_team) from private.return_team('aaaaaaaa-0000-0000-0000-0000000000b1', '15')), '50 % del plantel: avisos individuales');
select pg_temp.check((select cause from private.return_team('aaaaaaaa-0000-0000-0000-0000000000b1', '15') where full_name = 'P1') = 'lesion', 'P1: tras lesión');
select pg_temp.check((select cause from private.return_team('aaaaaaaa-0000-0000-0000-0000000000b1', '15') where full_name = 'P2') = 'vacaciones', 'P2: tras vacaciones (motivo declarado)');
select pg_temp.check((select cause from private.return_team('aaaaaaaa-0000-0000-0000-0000000000b1', '15') where full_name = 'P4') = 'ausencia', 'P4: tras ausencia ("No fui")');
select pg_temp.check((select weeks from private.return_team('aaaaaaaa-0000-0000-0000-0000000000b1', '15') where full_name = 'P1') = 4
                     and (select weeks from private.return_team('aaaaaaaa-0000-0000-0000-0000000000b1', '15') where full_name = 'P5') = 1, 'semanas del parón (mínimo 1)');
select pg_temp.check((select gap_days from private.return_team('aaaaaaaa-0000-0000-0000-0000000000b1', '15') where full_name = 'P5') = 10, 'un hueco de 10 días ya es parón');

-- Ficha: staff y el propio jugador.
select pg_temp.as_user('10000000-0000-0000-0000-0000000000b1');
select pg_temp.check((select weeks from public.player_return_flag('c1000000-0000-0000-0000-0000000000b1')) = 4, 'ficha P1: 4 semanas');
select pg_temp.check((select baseline from public.player_return_flag('c1000000-0000-0000-0000-0000000000b1')) = 300.0, 'ficha P1: promedio antes del parón (5 × 60)');
select pg_temp.check((select current_load from public.player_return_flag('c1000000-0000-0000-0000-0000000000b1')) is not null, 'ficha P1: carga de esta semana');
select pg_temp.check((select count(*) from public.player_return_flag('c1000000-0000-0000-0000-0000000000b3')) = 0, 'sin vuelta: sin filas');
select pg_temp.check(jsonb_array_length(public.team_return_summary()->'individual') = 4 and public.team_return_summary()->'team' = 'null'::jsonb, 'Métricas: 4 individuales, sin aviso de equipo');
select pg_temp.check(public.team_return_summary()->>'window_days' = '14', 'Métricas: ventana de 14 días');
select pg_temp.check((select count(*) from public.my_staff_state_notifications('15') where kind = 'vuelta_jugador') = 4
                     and (select count(*) from public.my_staff_state_notifications('15') where kind = 'vuelta_equipo') = 0, 'staff: 4 avisos individuales y ninguno de equipo');
select pg_temp.check((select payload->>'cause' from public.my_staff_state_notifications('15') where kind = 'vuelta_jugador' and payload->>'player_name' = 'P1') = 'lesion', 'el aviso del staff trae la causa');

select pg_temp.as_user('60000000-0000-0000-0000-0000000000b1');
select pg_temp.check((select weeks from public.player_return_flag('c1000000-0000-0000-0000-0000000000b1')) = 4, 'el jugador ve su propia vuelta');
select pg_temp.expect_fail($q$select * from public.player_return_flag('c1000000-0000-0000-0000-0000000000b2')$q$, 'el jugador no ve la de otro');
select pg_temp.expect_fail($q$select public.team_return_summary()$q$, 'el jugador no ve Métricas');
select pg_temp.check((select minutes from public.my_state_notifications('15') where kind = 'return') = 4
                     and (select location from public.my_state_notifications('15') where kind = 'return') = 'lesion'
                     and (select opponent from public.my_state_notifications('15') where kind = 'return') = 'individual', 'el jugador recibe su aviso individual');
select pg_temp.check((select urgent from public.my_state_notifications('15') where kind = 'return') = false, 'el aviso de vuelta no es urgente');
select pg_temp.as_user('60000000-0000-0000-0000-0000000000b2');
select pg_temp.check((select location from public.my_state_notifications('15') where kind = 'return') = 'vacaciones', 'P2 recibe "tras vacaciones"');

-- Aislamiento y anon.
select pg_temp.as_user('10000000-0000-0000-0000-0000000000b2');
select pg_temp.expect_fail($q$select * from public.player_return_flag('c1000000-0000-0000-0000-0000000000b1')$q$, 'el club B no ve jugadores del A');
select pg_temp.check(jsonb_array_length(public.team_return_summary()->'individual') = 0, 'el club B no tiene vueltas');
select pg_temp.as_anon();
select pg_temp.expect_fail($q$select public.team_return_summary()$q$, 'anon no lee Métricas');
select pg_temp.back();

-- =======================================================================
-- 2. Parón del plantel declarado: un solo aviso de equipo
-- =======================================================================
insert into public.absences (id, club_id, player_id, scope, starts_on, ends_on, reason, created_by)
values ('ab000000-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000b1', null, 'periodo',
        pg_temp.d(-25), pg_temp.d(-9), 'vacaciones', '10000000-0000-0000-0000-0000000000b1');
select pg_temp.check((select bool_and(in_team) from private.return_team('aaaaaaaa-0000-0000-0000-0000000000b1', '15')), 'con un parón del plantel todos los que vuelven van en el aviso de equipo');
select pg_temp.as_user('10000000-0000-0000-0000-0000000000b1');
select pg_temp.check(jsonb_array_length(public.team_return_summary()->'individual') = 0
                     and (public.team_return_summary()->'team'->>'squad_break') = 'true', 'Métricas: solo el aviso de equipo (parón declarado)');
select pg_temp.check((select count(*) from public.my_staff_state_notifications('15') where kind = 'vuelta_equipo') = 1
                     and (select count(*) from public.my_staff_state_notifications('15') where kind = 'vuelta_jugador') = 0, 'staff: un solo aviso de equipo');
select pg_temp.as_user('60000000-0000-0000-0000-0000000000b1');
select pg_temp.check((select opponent from public.my_state_notifications('15') where kind = 'return') = 'equipo', 'el jugador ve el aviso de equipo');
select pg_temp.back();

-- =======================================================================
-- 3. 60 % o más del plantel sin parón declarado: aviso de equipo por proporción
-- =======================================================================
update public.absences set ended_at = now(), ended_by = '10000000-0000-0000-0000-0000000000b1'
 where id = 'ab000000-0000-0000-0000-0000000000b1';
select pg_temp.check(pg_temp.flagged() = 4 and (select bool_and(not in_team) from private.return_team('aaaaaaaa-0000-0000-0000-0000000000b1', '15')),
                     'sin parón declarado volvemos a 4 de 8, individuales');
-- P3 gana evidencia (ausente en la lista del -8): 5 de 8 = 62,5 %.
insert into public.event_attendance (event_id, player_id, club_id, present, recorded_by)
values ('e0000000-0000-0000-0000-0000000000b2', 'c1000000-0000-0000-0000-0000000000b3', 'aaaaaaaa-0000-0000-0000-0000000000b1', false, '10000000-0000-0000-0000-0000000000b1');
select pg_temp.check(pg_temp.flagged() = 5 and (select bool_and(in_team) from private.return_team('aaaaaaaa-0000-0000-0000-0000000000b1', '15')), '60 % o más del plantel: todos en el aviso de equipo');
select pg_temp.as_user('10000000-0000-0000-0000-0000000000b1');
select pg_temp.check((public.team_return_summary()->'team'->>'count') = '5'
                     and (public.team_return_summary()->'team'->>'roster') = '8'
                     and (public.team_return_summary()->'team'->>'squad_break') = 'false', 'Métricas: 5 de 8, sin parón declarado');
select pg_temp.back();

-- Un aviso quitado no es evidencia: la vuelta de P2 deja de ser parón sin la ausencia declarada.
update public.absences set ended_at = now(), ended_by = '10000000-0000-0000-0000-0000000000b1'
 where player_id = 'c1000000-0000-0000-0000-0000000000b2';
select pg_temp.check((select count(*) from private.return_team('aaaaaaaa-0000-0000-0000-0000000000b1', '15') where full_name = 'P2') = 0, 'un aviso quitado no cuenta como evidencia');

select 'OK return_break_test' as resultado;
rollback;
