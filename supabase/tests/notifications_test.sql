-- Recov · Test de notificaciones del Resumen (20261107180000 a 20261107184000)
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

create function pg_temp.expect_ok(q text, label text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    raise exception 'FAIL: % (debía funcionar y falló: %)', label, sqlerrm;
  end;
end $$;

create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAIL: %', label; end if;
end $$;

-- Notificaciones vivas (sin descartar) de una persona y un tipo (como postgres, sin RLS).
create function pg_temp.n(u uuid, k text) returns int language sql as $$
  select count(*)::int from public.notifications where user_id = u and kind = k and dismissed_at is null
$$;
create function pg_temp.p(u uuid, k text) returns jsonb language sql as $$
  select payload from public.notifications where user_id = u and kind = k and dismissed_at is null
   order by created_at desc limit 1
$$;

-- Datos de prueba ---------------------------------------------------------
-- Club A: rugby con Sevens. Club B: hockey.
insert into public.clubs (id, name, sport, slug) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'Club A', 'rugby',  'club-a-n'),
  ('bbbbbbbb-0000-0000-0000-0000000000f2', 'Club B', 'hockey', 'club-b-n');
update public.clubs set has_sevens = true where id = 'aaaaaaaa-0000-0000-0000-0000000000f1';

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-0000000000f1', 'hc-a@notif.test'),
  ('20000000-0000-0000-0000-0000000000f1', 'manager-a@notif.test'),
  ('30000000-0000-0000-0000-0000000000f1', 'kine-a@notif.test'),
  ('40000000-0000-0000-0000-0000000000f1', 'coach-a@notif.test'),
  ('55000000-0000-0000-0000-0000000000f1', 'pf-a@notif.test'),
  ('60000000-0000-0000-0000-0000000000f1', 'jugador-a1@notif.test'),
  ('61000000-0000-0000-0000-0000000000f1', 'jugador-a2@notif.test'),
  ('90000000-0000-0000-0000-0000000000f1', 'nuevo@notif.test'),
  ('10000000-0000-0000-0000-0000000000f2', 'hc-b@notif.test'),
  ('60000000-0000-0000-0000-0000000000f2', 'jugador-b1@notif.test');

with v(id, club_id, roles, full_name) as (values
  ('10000000-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-0000000000f1', '{head_coach}',        'HC A'),
  ('20000000-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-0000000000f1', '{manager}',           'Manager A'),
  ('30000000-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-0000000000f1', '{kinesiologo}',       'Kine A'),
  ('40000000-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-0000000000f1', '{entrenador}',        'Entrenador A'),
  ('55000000-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-0000000000f1', '{preparador_fisico}', 'PF A'),
  ('60000000-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-0000000000f1', '{jugador}',           'Jugador A1'),
  ('61000000-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-0000000000f1', '{jugador}',           'Jugador A2'),
  ('10000000-0000-0000-0000-0000000000f2', 'bbbbbbbb-0000-0000-0000-0000000000f2', '{head_coach}',        'HC B'),
  ('60000000-0000-0000-0000-0000000000f2', 'bbbbbbbb-0000-0000-0000-0000000000f2', '{jugador}',           'Jugador B1')),
     p as (insert into public.profiles (id, full_name) select id::uuid, full_name from v)
insert into public.club_members (user_id, club_id, roles, status)
select id::uuid, club_id::uuid, roles::public.user_role[], 'confirmado' from v;

-- A1 y A2 con cuenta, A3 sin cuenta; A2 en el grupo Sevens.
insert into public.players (id, club_id, full_name, position, status, availability, user_id) values
  ('c1000000-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'Jugador A1', 'Pilar',   'confirmado', 'disponible', '60000000-0000-0000-0000-0000000000f1'),
  ('c1000000-0000-0000-0000-0000000000f2', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'Jugador A2', 'Hooker',  'confirmado', 'disponible', '61000000-0000-0000-0000-0000000000f1'),
  ('c1000000-0000-0000-0000-0000000000f3', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'Jugador A3', 'Centro',  'confirmado', 'disponible', null),
  ('c2000000-0000-0000-0000-0000000000f1', 'bbbbbbbb-0000-0000-0000-0000000000f2', 'Jugador B1', 'Portero', 'confirmado', 'disponible', '60000000-0000-0000-0000-0000000000f2');
insert into public.sevens_group (club_id, member_id)
values ('aaaaaaaa-0000-0000-0000-0000000000f1', '61000000-0000-0000-0000-0000000000f1');

create temp table d as select (now() at time zone 'America/Santiago')::date as today;
grant select on d to authenticated;

-- =======================================================================
-- 1. Eventos: nuevo, modificado, cancelado (1, 2, 3)
-- =======================================================================
select pg_temp.as_user('10000000-0000-0000-0000-0000000000f1');
select set_config('t.e1', e::text, true)
  from public.create_event('entrenamiento', now() + interval '2 days', now() + interval '2 days 1 hour') e;
select pg_temp.back();

select pg_temp.check(pg_temp.n('60000000-0000-0000-0000-0000000000f1', 'evento_nuevo') = 1, 'A1 recibe "evento nuevo"');
select pg_temp.check(pg_temp.n('61000000-0000-0000-0000-0000000000f1', 'evento_nuevo') = 1, 'A2 recibe "evento nuevo"');
select pg_temp.check(pg_temp.n('10000000-0000-0000-0000-0000000000f1', 'evento_nuevo') = 0, 'quien lo crea no se avisa a sí mismo');
select pg_temp.check(pg_temp.n('60000000-0000-0000-0000-0000000000f2', 'evento_nuevo') = 0, 'el club B no recibe nada');
select pg_temp.expect_count($q$select 1 from public.notifications where payload->>'event_id' = current_setting('t.e1')$q$, 2,
  'solo los jugadores con cuenta (A3 no tiene)');
select pg_temp.check(pg_temp.p('60000000-0000-0000-0000-0000000000f1', 'evento_nuevo')->>'event_type' = 'entrenamiento', 'el payload trae el tipo de evento');
select pg_temp.check((select category from public.notifications where kind = 'evento_nuevo' limit 1) = 'calendario', 'la categoría se deriva del tipo');

-- Modificar antes de descartar: sigue siendo "nuevo" con los datos al día.
select pg_temp.as_user('10000000-0000-0000-0000-0000000000f1');
select public.update_event(current_setting('t.e1')::uuid, now() + interval '2 days', now() + interval '2 days 1 hour', 'Cancha 9');
select pg_temp.back();
select pg_temp.check(pg_temp.n('60000000-0000-0000-0000-0000000000f1', 'evento_nuevo') = 1
                     and pg_temp.n('60000000-0000-0000-0000-0000000000f1', 'evento_modificado') = 0, 'nuevo + modificado = una sola "nuevo"');
select pg_temp.check(pg_temp.p('60000000-0000-0000-0000-0000000000f1', 'evento_nuevo')->>'location' = 'Cancha 9', 'la "nueva" trae el lugar al día');

-- A1 la descarta; al modificar de nuevo le llega "modificado".
select pg_temp.as_user('60000000-0000-0000-0000-0000000000f1');
select public.dismiss_notification((select id from public.notifications where kind = 'evento_nuevo'));
select pg_temp.back();
select pg_temp.check(pg_temp.n('60000000-0000-0000-0000-0000000000f1', 'evento_nuevo') = 0, 'A1 descarta la suya');

select pg_temp.as_user('10000000-0000-0000-0000-0000000000f1');
select public.update_event(current_setting('t.e1')::uuid, now() + interval '2 days 2 hours', now() + interval '2 days 3 hours', 'Cancha 9');
select pg_temp.back();
select pg_temp.check(pg_temp.n('60000000-0000-0000-0000-0000000000f1', 'evento_modificado') = 1, 'A1 recibe "modificado"');
select pg_temp.check(pg_temp.p('60000000-0000-0000-0000-0000000000f1', 'evento_modificado') ? 'prev_starts_at', '"modificado" trae la fecha anterior');
select pg_temp.check(pg_temp.n('61000000-0000-0000-0000-0000000000f1', 'evento_nuevo') = 1, 'A2 (sin descartar) sigue con "nuevo"');

-- Cambiar solo las notas no avisa.
select pg_temp.as_user('60000000-0000-0000-0000-0000000000f1');
select public.dismiss_notification((select id from public.notifications where kind = 'evento_modificado'));
select pg_temp.as_user('10000000-0000-0000-0000-0000000000f1');
select public.update_event(current_setting('t.e1')::uuid, now() + interval '2 days 2 hours', now() + interval '2 days 3 hours', 'Cancha 9', null, 'Traer agua');
select pg_temp.back();
select pg_temp.check(pg_temp.n('60000000-0000-0000-0000-0000000000f1', 'evento_modificado') = 0, 'cambiar solo las notas no avisa');

-- Cancelar reemplaza lo que había.
select pg_temp.as_user('10000000-0000-0000-0000-0000000000f1');
select public.cancel_event(current_setting('t.e1')::uuid);
select pg_temp.back();
select pg_temp.check(pg_temp.n('61000000-0000-0000-0000-0000000000f1', 'evento_cancelado') = 1
                     and pg_temp.n('61000000-0000-0000-0000-0000000000f1', 'evento_nuevo') = 0, 'A2: "cancelado" reemplaza a "nuevo"');
select pg_temp.check(pg_temp.n('60000000-0000-0000-0000-0000000000f1', 'evento_cancelado') = 1, 'A1 recibe "cancelado"');

-- Sevens: solo el grupo. Pasado: nadie. Serie: una por persona.
select pg_temp.as_user('10000000-0000-0000-0000-0000000000f1');
select public.create_event('entrenamiento', now() + interval '3 days', now() + interval '3 days 1 hour', null, null, null, 1, '7');
select public.create_event('entrenamiento', now() - interval '2 days', now() - interval '2 days' + interval '1 hour');
select pg_temp.back();
select pg_temp.check(pg_temp.n('61000000-0000-0000-0000-0000000000f1', 'evento_nuevo') = 1, 'evento Sevens: A2 (grupo) lo recibe');
select pg_temp.check(pg_temp.n('60000000-0000-0000-0000-0000000000f1', 'evento_nuevo') = 0, 'evento Sevens: A1 (fuera del grupo) no; evento pasado: nadie');

select pg_temp.as_user('10000000-0000-0000-0000-0000000000f1');
select public.create_event('entrenamiento', now() + interval '4 days', now() + interval '4 days 1 hour', 'Cancha 2', null, null, 3);
select pg_temp.back();
select pg_temp.check(pg_temp.n('60000000-0000-0000-0000-0000000000f1', 'evento_nuevo') = 1, 'serie de 3 semanas: una sola notificación');
select pg_temp.check(pg_temp.p('60000000-0000-0000-0000-0000000000f1', 'evento_nuevo')->>'weeks' = '3', 'la serie trae las semanas');

-- =======================================================================
-- 2. Nóminas: convocado (titular o banca) y quitado (4, 5)
-- =======================================================================
insert into public.events (id, club_id, type, starts_at, ends_at, opponent, created_by) values
  ('e2000000-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'competencia', now() + interval '5 days', now() + interval '5 days 2 hours', 'Rival', '10000000-0000-0000-0000-0000000000f1'),
  ('e3000000-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'competencia', now() - interval '1 day', now() - interval '22 hours', 'Rival', '10000000-0000-0000-0000-0000000000f1');

select pg_temp.as_user('10000000-0000-0000-0000-0000000000f1');
select public.set_event_lineup('e2000000-0000-0000-0000-0000000000f1', jsonb_build_array(
  jsonb_build_object('player_id', 'c1000000-0000-0000-0000-0000000000f1', 'slot', 1),
  jsonb_build_object('player_id', 'c1000000-0000-0000-0000-0000000000f2', 'slot', 16)));
select pg_temp.back();
select pg_temp.check(pg_temp.p('60000000-0000-0000-0000-0000000000f1', 'convocado')->>'role' = 'titular', 'A1 convocado de titular');
select pg_temp.check(pg_temp.p('61000000-0000-0000-0000-0000000000f1', 'convocado')->>'role' = 'banca', 'A2 convocado en la banca');
select pg_temp.check(pg_temp.p('60000000-0000-0000-0000-0000000000f1', 'convocado')->>'sport' = 'rugby', 'el payload trae el deporte para el código del puesto');

select pg_temp.as_user('10000000-0000-0000-0000-0000000000f1');
select public.set_event_lineup('e2000000-0000-0000-0000-0000000000f1', jsonb_build_array(
  jsonb_build_object('player_id', 'c1000000-0000-0000-0000-0000000000f1', 'slot', 2),
  jsonb_build_object('player_id', 'c1000000-0000-0000-0000-0000000000f2', 'slot', 16)));
select pg_temp.back();
select pg_temp.check(pg_temp.n('60000000-0000-0000-0000-0000000000f1', 'convocado') = 1
                     and pg_temp.p('60000000-0000-0000-0000-0000000000f1', 'convocado')->>'slot' = '2', 'cambio de puesto: una sola, con el puesto nuevo');

select pg_temp.as_user('10000000-0000-0000-0000-0000000000f1');
select public.set_event_callups('e2000000-0000-0000-0000-0000000000f1', array['c1000000-0000-0000-0000-0000000000f1']::uuid[]);
select pg_temp.back();
select pg_temp.check(pg_temp.n('61000000-0000-0000-0000-0000000000f1', 'quitado_nomina') = 1
                     and pg_temp.n('61000000-0000-0000-0000-0000000000f1', 'convocado') = 0, 'A2 quitado: reemplaza a "convocado"');
select pg_temp.check(pg_temp.n('60000000-0000-0000-0000-0000000000f1', 'convocado') = 1, 'A1 sigue convocado');

select pg_temp.as_user('10000000-0000-0000-0000-0000000000f1');
select public.set_event_lineup('e3000000-0000-0000-0000-0000000000f1', jsonb_build_array(
  jsonb_build_object('player_id', 'c1000000-0000-0000-0000-0000000000f1', 'slot', 1)));
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.notifications where payload->>'event_id' = 'e3000000-0000-0000-0000-0000000000f1'$q$, 0,
  'nómina de un partido pasado: no avisa');

-- =======================================================================
-- 3. Lesiones (6 a 11, 21, 22)
-- =======================================================================
select pg_temp.as_user('30000000-0000-0000-0000-0000000000f1');
select set_config('t.i1', public.mark_player_injured('c1000000-0000-0000-0000-0000000000f1', 'entrenamiento', 'Golpe en rodilla')::text, true);
select pg_temp.back();
select pg_temp.check(pg_temp.n('60000000-0000-0000-0000-0000000000f1', 'marcado_lesionado') = 1, 'A1: "sube tu diagnóstico"');

insert into storage.objects (bucket_id, name) values
  ('medical-docs', 'aaaaaaaa-0000-0000-0000-0000000000f1/c1000000-0000-0000-0000-0000000000f1/diag.pdf'),
  ('medical-docs', 'aaaaaaaa-0000-0000-0000-0000000000f1/c1000000-0000-0000-0000-0000000000f1/d2.pdf');

select pg_temp.as_user('60000000-0000-0000-0000-0000000000f1');
select public.complete_injury_report(current_setting('t.i1')::uuid, 'rodilla'::public.body_zone, 'derecha'::public.injury_laterality,
  4, 'semanas', null, jsonb_build_array(jsonb_build_object(
    'path', 'aaaaaaaa-0000-0000-0000-0000000000f1/c1000000-0000-0000-0000-0000000000f1/diag.pdf', 'name', 'diag.pdf')));
select pg_temp.back();
select pg_temp.check(pg_temp.n('60000000-0000-0000-0000-0000000000f1', 'marcado_lesionado') = 0, 'completar el diagnóstico descarta "sube tu diagnóstico"');
select pg_temp.check(pg_temp.n('30000000-0000-0000-0000-0000000000f1', 'lesion_por_revisar') = 1, 'el kine recibe "lesión por revisar"');
select pg_temp.check(pg_temp.n('10000000-0000-0000-0000-0000000000f1', 'lesion_por_revisar') = 1, 'el head coach también');
select pg_temp.check(pg_temp.n('20000000-0000-0000-0000-0000000000f1', 'lesion_por_revisar') = 0
                     and pg_temp.n('40000000-0000-0000-0000-0000000000f1', 'lesion_por_revisar') = 0, 'manager y entrenador no (sin lesiones_revisar)');
select pg_temp.check(pg_temp.p('30000000-0000-0000-0000-0000000000f1', 'lesion_por_revisar')->>'player_name' = 'Jugador A1', 'trae el nombre del jugador');

select pg_temp.as_user('60000000-0000-0000-0000-0000000000f1');
select public.add_own_injury_document(current_setting('t.i1')::uuid,
  'aaaaaaaa-0000-0000-0000-0000000000f1/c1000000-0000-0000-0000-0000000000f1/d2.pdf', 'examen.pdf');
select pg_temp.back();
select pg_temp.check(pg_temp.n('30000000-0000-0000-0000-0000000000f1', 'documento_subido') = 1, 'el kine recibe "documento subido"');

select pg_temp.as_user('30000000-0000-0000-0000-0000000000f1');
select public.review_injury(current_setting('t.i1')::uuid, 'confirmar', 'moderada', (select today + 30 from d), 'lesionado');
select pg_temp.back();
select pg_temp.check(pg_temp.n('60000000-0000-0000-0000-0000000000f1', 'lesion_confirmada') = 1, 'A1: lesión confirmada');
select pg_temp.check(pg_temp.p('60000000-0000-0000-0000-0000000000f1', 'lesion_confirmada')->>'severity' = 'moderada', 'con la gravedad');
select pg_temp.check(pg_temp.n('30000000-0000-0000-0000-0000000000f1', 'lesion_por_revisar') = 0
                     and pg_temp.n('30000000-0000-0000-0000-0000000000f1', 'documento_subido') = 0
                     and pg_temp.n('10000000-0000-0000-0000-0000000000f1', 'lesion_por_revisar') = 0, 'revisar descarta las del staff');

select pg_temp.as_user('30000000-0000-0000-0000-0000000000f1');
select public.set_injury_phases(current_setting('t.i1')::uuid, jsonb_build_array(
  jsonb_build_object('name', 'Reposo', 'status', 'en_curso', 'started_on', (select today from d)),
  jsonb_build_object('name', 'Rehabilitación', 'status', 'pendiente')));
select pg_temp.back();
select pg_temp.check(pg_temp.p('60000000-0000-0000-0000-0000000000f1', 'fase_cambio')->>'phase_name' = 'Reposo', 'A1: pasa a Reposo');

select pg_temp.as_user('30000000-0000-0000-0000-0000000000f1');
select public.advance_injury_phase(current_setting('t.i1')::uuid);
select pg_temp.back();
select pg_temp.check(pg_temp.n('60000000-0000-0000-0000-0000000000f1', 'fase_cambio') = 1
                     and pg_temp.p('60000000-0000-0000-0000-0000000000f1', 'fase_cambio')->>'phase_name' = 'Rehabilitación', 'avanzar: una sola, con la fase nueva');

select pg_temp.as_user('30000000-0000-0000-0000-0000000000f1');
select public.review_injury(current_setting('t.i1')::uuid, 'cerrar');
select pg_temp.back();
select pg_temp.check(pg_temp.n('60000000-0000-0000-0000-0000000000f1', 'alta') = 1
                     and pg_temp.n('60000000-0000-0000-0000-0000000000f1', 'lesion_confirmada') = 0, 'alta reemplaza a "confirmada"');

select pg_temp.as_user('61000000-0000-0000-0000-0000000000f1');
select set_config('t.i2', public.report_injury('rodilla'::public.body_zone, 'izquierda'::public.injury_laterality,
  (select today from d), 2, 'semanas', null, '[]'::jsonb, 'entrenamiento')::text, true);
select pg_temp.back();
select pg_temp.check(pg_temp.n('30000000-0000-0000-0000-0000000000f1', 'lesion_por_revisar') = 1, 'lesión reportada: el kine la recibe');
select pg_temp.as_user('30000000-0000-0000-0000-0000000000f1');
select public.review_injury(current_setting('t.i2')::uuid, 'descartar');
select pg_temp.back();
select pg_temp.check(pg_temp.n('61000000-0000-0000-0000-0000000000f1', 'lesion_descartada') = 1, 'A2: lesión descartada');
select pg_temp.check(pg_temp.n('30000000-0000-0000-0000-0000000000f1', 'lesion_por_revisar') = 0, 'descartar también limpia la del kine');

select pg_temp.as_user('30000000-0000-0000-0000-0000000000f1');
select public.set_player_availability('c1000000-0000-0000-0000-0000000000f2', 'lesionado');
select public.set_player_availability('c1000000-0000-0000-0000-0000000000f2', 'lesionado');
select pg_temp.back();
select pg_temp.check(pg_temp.n('61000000-0000-0000-0000-0000000000f1', 'disponibilidad') = 1
                     and pg_temp.p('61000000-0000-0000-0000-0000000000f1', 'disponibilidad')->>'to' = 'lesionado', 'A2: cambio de disponibilidad');

-- =======================================================================
-- 4. Gimnasio y evaluaciones (12, 13)
-- =======================================================================
insert into public.test_definitions (id, club_id, name, unit, created_by) values
  ('7e570000-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'Sentadilla 1RM', 'kg', '10000000-0000-0000-0000-0000000000f1');

select set_config('t.plan', jsonb_build_object(
  'name', 'Plan test', 'starts_on', (select today from d), 'ends_on', (select today + 28 from d),
  'targets', jsonb_build_array(jsonb_build_object('kind', 'plantel')), 'exclusions', '[]'::jsonb,
  'sessions', jsonb_build_array(jsonb_build_object('label', 'Sesión A', 'weekday', 1, 'est_minutes', 45,
    'exercises', jsonb_build_array(jsonb_build_object('name', 'Flexiones', 'sets', 3, 'reps', '10', 'intensity_type', 'bw')))))::text, true);

select pg_temp.as_user('55000000-0000-0000-0000-0000000000f1');
select set_config('t.g1', public.save_gym_plan(current_setting('t.plan')::jsonb)::text, true);
select pg_temp.back();
select pg_temp.check(pg_temp.n('60000000-0000-0000-0000-0000000000f1', 'plan_gimnasio') = 0, 'un borrador no avisa');

select pg_temp.as_user('55000000-0000-0000-0000-0000000000f1');
select public.publish_gym_plan(current_setting('t.g1')::uuid);
select pg_temp.back();
select pg_temp.check(pg_temp.p('60000000-0000-0000-0000-0000000000f1', 'plan_gimnasio')->>'change' = 'nuevo', 'A1: plan nuevo');
select pg_temp.check(pg_temp.n('61000000-0000-0000-0000-0000000000f1', 'plan_gimnasio') = 1, 'A2 también (lesionado lo recibe)');

select pg_temp.as_user('55000000-0000-0000-0000-0000000000f1');
select public.save_gym_plan(current_setting('t.plan')::jsonb || jsonb_build_object('id', current_setting('t.g1'), 'name', 'Plan test 2'));
select pg_temp.back();
select pg_temp.check(pg_temp.n('60000000-0000-0000-0000-0000000000f1', 'plan_gimnasio') = 1
                     and pg_temp.p('60000000-0000-0000-0000-0000000000f1', 'plan_gimnasio')->>'change' = 'modificado', 'guardar un plan publicado: "modificado"');

select pg_temp.as_user('55000000-0000-0000-0000-0000000000f1');
select public.record_test_results('7e570000-0000-0000-0000-0000000000f1', (select today from d),
  jsonb_build_array(jsonb_build_object('player_id', 'c1000000-0000-0000-0000-0000000000f1', 'value', 120)));
select pg_temp.back();
select pg_temp.check(pg_temp.p('60000000-0000-0000-0000-0000000000f1', 'evaluacion_resultado')->>'test_name' = 'Sentadilla 1RM', 'A1: resultado de evaluación');
select pg_temp.check(pg_temp.n('61000000-0000-0000-0000-0000000000f1', 'evaluacion_resultado') = 0, 'A2 no (sin resultado)');

-- =======================================================================
-- 5. Cuenta, registros, Sevens, posición y funciones (14 a 17, 20, 23)
-- =======================================================================
select pg_temp.as_user('90000000-0000-0000-0000-0000000000f1');
select public.register_member('club-a-n', 'staff', 'Nuevo', 'Staff', null, null, null, null, 'entrenador');
select pg_temp.back();
select pg_temp.check(pg_temp.n('10000000-0000-0000-0000-0000000000f1', 'registro_pendiente') = 1, 'head coach: registro nuevo');
select pg_temp.check(pg_temp.n('20000000-0000-0000-0000-0000000000f1', 'registro_pendiente') = 1, 'manager: registro nuevo');
select pg_temp.check(pg_temp.n('30000000-0000-0000-0000-0000000000f1', 'registro_pendiente') = 0, 'kine no (sin permiso)');

select pg_temp.as_user('10000000-0000-0000-0000-0000000000f1');
select public.review_member('90000000-0000-0000-0000-0000000000f1', 'confirmar');
select pg_temp.back();
select pg_temp.check(pg_temp.n('10000000-0000-0000-0000-0000000000f1', 'registro_pendiente') = 0
                     and pg_temp.n('20000000-0000-0000-0000-0000000000f1', 'registro_pendiente') = 0, 'decidir el registro lo descarta para toda la dirección');
select pg_temp.check(pg_temp.n('90000000-0000-0000-0000-0000000000f1', 'registro_aprobado') = 1, 'la persona: registro aprobado');

select pg_temp.as_user('10000000-0000-0000-0000-0000000000f1');
select public.set_staff_roles('40000000-0000-0000-0000-0000000000f1', '{entrenador,preparador_fisico}');
select public.set_staff_roles('40000000-0000-0000-0000-0000000000f1', '{preparador_fisico,entrenador}');
select pg_temp.back();
select pg_temp.check(pg_temp.n('40000000-0000-0000-0000-0000000000f1', 'roles_cambio') = 1, 'cambio de roles (los mismos en otro orden no cuenta)');

select pg_temp.as_user('10000000-0000-0000-0000-0000000000f1');
select public.set_staff_roles('90000000-0000-0000-0000-0000000000f1', '{}');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.notifications where user_id = '90000000-0000-0000-0000-0000000000f1' and kind = 'roles_cambio'$q$, 0,
  'la salida del staff no se avisa');

select pg_temp.as_user('10000000-0000-0000-0000-0000000000f1');
select public.set_sevens_group(array['61000000-0000-0000-0000-0000000000f1', '60000000-0000-0000-0000-0000000000f1']::uuid[]);
select public.set_staff_sevens('55000000-0000-0000-0000-0000000000f1', true);
select pg_temp.back();
select pg_temp.check(pg_temp.n('60000000-0000-0000-0000-0000000000f1', 'sevens_agregado') = 1, 'A1 agregado al grupo Sevens');
select pg_temp.check(pg_temp.n('61000000-0000-0000-0000-0000000000f1', 'sevens_agregado') = 0, 'A2 ya estaba: no se avisa');
select pg_temp.check(pg_temp.n('55000000-0000-0000-0000-0000000000f1', 'sevens_agregado') = 1, 'staff agregado a Sevens desde /staff');

select pg_temp.as_user('10000000-0000-0000-0000-0000000000f1');
select public.set_player_positions('c1000000-0000-0000-0000-0000000000f1', 'Hooker');
select pg_temp.back();
select pg_temp.check(pg_temp.p('60000000-0000-0000-0000-0000000000f1', 'posicion_cambio')->>'position' = 'Hooker'
                     and pg_temp.p('60000000-0000-0000-0000-0000000000f1', 'posicion_cambio')->>'prev_position' = 'Pilar', 'A1: tu posición cambió a Hooker');

select pg_temp.as_user('10000000-0000-0000-0000-0000000000f1');
select public.set_kine_delegate('40000000-0000-0000-0000-0000000000f1');
select public.set_kine_delegate('40000000-0000-0000-0000-0000000000f1');
select public.set_nomina_delegate('40000000-0000-0000-0000-0000000000f1');
select pg_temp.back();
select pg_temp.check(pg_temp.n('40000000-0000-0000-0000-0000000000f1', 'funcion_asignada') = 2, 'delegado de kine y de nóminas (repetir no duplica)');

-- =======================================================================
-- 6. RLS y escritura
-- =======================================================================
select pg_temp.as_user('60000000-0000-0000-0000-0000000000f1');
select pg_temp.expect_count($q$select 1 from public.notifications where user_id <> auth.uid()$q$, 0, 'A1 no lee notificaciones de otros');
select pg_temp.back();

select pg_temp.as_user('60000000-0000-0000-0000-0000000000f2');
select pg_temp.expect_count($q$select 1 from public.notifications$q$, 0, 'el club B no lee las del club A');
select pg_temp.back();

select pg_temp.as_user('60000000-0000-0000-0000-0000000000f1');
select pg_temp.expect_fail($q$insert into public.notifications (club_id, user_id, kind)
  values ('aaaaaaaa-0000-0000-0000-0000000000f1', '60000000-0000-0000-0000-0000000000f1', 'alta')$q$, 'insert directo');
select pg_temp.expect_fail($q$update public.notifications set dismissed_at = now()$q$, 'update directo');
select pg_temp.expect_fail($q$select private.notify('aaaaaaaa-0000-0000-0000-0000000000f1', '61000000-0000-0000-0000-0000000000f1', 'alta')$q$, 'la app no llama a private.notify');
select pg_temp.back();
-- Descartar una ajena no hace nada.
select set_config('t.a2note', (select id::text from public.notifications where user_id = '61000000-0000-0000-0000-0000000000f1' and dismissed_at is null limit 1), true);
select pg_temp.as_user('60000000-0000-0000-0000-0000000000f1');
select public.dismiss_notification(current_setting('t.a2note')::uuid);
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.notifications where id = current_setting('t.a2note')::uuid and dismissed_at is null$q$, 1,
  'A1 no puede descartar una de A2');

select pg_temp.as_user('60000000-0000-0000-0000-0000000000f1');
select public.dismiss_all_notifications();
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.notifications where user_id = '60000000-0000-0000-0000-0000000000f1' and dismissed_at is null$q$, 0,
  '"Descartar todas" deja a A1 sin notificaciones');
select pg_temp.expect_count($q$select 1 from public.notifications where user_id = '60000000-0000-0000-0000-0000000000f1'
  and dismissed_at is not null$q$, 12, 'descartar no borra: las 12 de A1 siguen guardadas');

select pg_temp.as_anon();
select pg_temp.expect_fail($q$select 1 from public.notifications$q$, 'anon no lee');
select pg_temp.expect_fail($q$select public.dismiss_all_notifications()$q$, 'anon no descarta');
select pg_temp.back();

-- =======================================================================
-- 7. De estado: jugador (18, 19) y staff (24 a 29)
-- =======================================================================
update public.clubs set wellness_days = '{1,2,3,4,5,6,7}' where id = 'aaaaaaaa-0000-0000-0000-0000000000f1';
insert into public.events (id, club_id, type, starts_at, ends_at, created_by) values
  ('e4000000-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'entrenamiento', now() - interval '3 hours', now() - interval '90 minutes', '10000000-0000-0000-0000-0000000000f1'),
  ('e5000000-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'entrenamiento', now() - interval '41 hours', now() - interval '40 hours', '10000000-0000-0000-0000-0000000000f1'),
  ('e6000000-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'competencia', now() + interval '3 days', now() + interval '3 days 2 hours', '10000000-0000-0000-0000-0000000000f1');
insert into public.injuries (club_id, player_id, type, severity, status, started_on, expected_return_on, reviewed_at)
select 'aaaaaaaa-0000-0000-0000-0000000000f1', 'c1000000-0000-0000-0000-0000000000f3', 'Esguince', 'leve', 'activa', today - 10, today + 2, now() from d;

select pg_temp.as_user('60000000-0000-0000-0000-0000000000f1');
select pg_temp.expect_count($q$select 1 from public.my_state_notifications('15')
  where kind = 'session' and ref_id = 'e4000000-0000-0000-0000-0000000000f1' and not urgent$q$, 1, 'sRPE pendiente con más de 12 h: no urgente');
select pg_temp.expect_count($q$select 1 from public.my_state_notifications('15')
  where kind = 'session' and ref_id = 'e5000000-0000-0000-0000-0000000000f1' and urgent
    and deadline = now() - interval '40 hours' + interval '48 hours'$q$, 1, 'sRPE que vence en 8 h: urgente, vence a las 48 h');
select pg_temp.expect_count($q$select 1 from public.my_state_notifications('15') where kind = 'wellness'$q$, 1, 'check de bienestar el día que toca');
select pg_temp.expect_count($q$select * from public.my_staff_state_notifications('15')$q$, 0, 'un jugador no recibe las del staff');
select public.submit_wellness(4::smallint, 4::smallint, 4::smallint, 4::smallint, 4::smallint);
select pg_temp.expect_count($q$select 1 from public.my_state_notifications('15') where kind = 'wellness'$q$, 0, 'respondido: desaparece');
select pg_temp.back();

select pg_temp.as_user('10000000-0000-0000-0000-0000000000f1');
select pg_temp.expect_count($q$select 1 from public.my_staff_state_notifications('15') where kind = 'sin_lista'
  and ref_id = 'e4000000-0000-0000-0000-0000000000f1'$q$, 1, 'head coach: entrenamiento sin lista');
select pg_temp.expect_count($q$select 1 from public.my_staff_state_notifications('15') where kind = 'sin_nomina'
  and ref_id = 'e6000000-0000-0000-0000-0000000000f1'$q$, 1, 'head coach: partido sin nómina');
select pg_temp.expect_count($q$select 1 from public.my_staff_state_notifications('15') where kind = 'sin_nomina'
  and ref_id = 'e2000000-0000-0000-0000-0000000000f1'$q$, 0, 'partido con nómina: no');
select pg_temp.expect_count($q$select 1 from public.my_staff_state_notifications('15') where kind = 'sin_participacion'
  and ref_id = 'e3000000-0000-0000-0000-0000000000f1'$q$, 1, 'head coach: partido sin participación');
select pg_temp.expect_count($q$select 1 from public.my_staff_state_notifications('15') where kind = 'alta_estimada'
  and (payload->>'days')::int = 2 and not (payload->>'vencida')::boolean$q$, 1, 'head coach: alta estimada próxima');
select pg_temp.expect_count($q$select 1 from public.my_staff_state_notifications('7') where kind = 'alta_estimada'$q$, 0,
  'Sevens: la lesión de A3 (fuera del grupo) no aparece');
select pg_temp.back();

select pg_temp.as_user('20000000-0000-0000-0000-0000000000f1');
select pg_temp.expect_count($q$select 1 from public.my_staff_state_notifications('15') where kind = 'sin_nomina'$q$, 1, 'manager: partido sin nómina');
select pg_temp.expect_count($q$select 1 from public.my_staff_state_notifications('15') where kind = 'alta_estimada'$q$, 0, 'manager: sin lesiones_revisar, no ve altas');
select pg_temp.back();

select pg_temp.as_user('30000000-0000-0000-0000-0000000000f1');
select pg_temp.expect_count($q$select 1 from public.my_staff_state_notifications('15') where kind = 'alta_estimada'$q$, 1, 'kine: alta estimada');
select pg_temp.expect_count($q$select 1 from public.my_staff_state_notifications('15') where kind = 'sin_nomina'$q$, 0, 'kine: sin nomina_armar, no ve nóminas');
select pg_temp.back();

select pg_temp.as_user('10000000-0000-0000-0000-0000000000f2');
select pg_temp.expect_count($q$select * from public.my_staff_state_notifications('15')$q$, 0, 'head coach B: nada del club A');
select pg_temp.back();

-- =======================================================================
-- 8. Permisos de las funciones
-- =======================================================================
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('dismiss_notification', 'dismiss_all_notifications',
                                               'my_state_notifications', 'my_staff_state_notifications')
    and not has_function_privilege('anon', p.oid, 'EXECUTE')
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    and p.proconfig = array['search_path=""']$q$, 4, 'funciones públicas: solo authenticated y search_path vacío');
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private' and p.proname in ('notify', 'notify_players', 'notify_perm', 'dismiss_notification_keys',
       'event_notice_payload', 'notify_event_audience', 'notify_callup', 'injury_notice_payload',
       'injury_current_phase', 'notify_phase_change', 'notify_gym_plan', 'notification_category')
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')$q$, 0, 'los helpers privados no los ejecuta authenticated');

select 'notifications_test OK' as resultado;
rollback;
