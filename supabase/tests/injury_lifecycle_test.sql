-- Recov · Test del ciclo de vida de la lesión (migraciones 0009 a 0013)
-- Correr DESPUÉS de las migraciones 0001 a 0013. Autónomo: crea sus propios datos y termina en ROLLBACK.
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

-- la sentencia debe funcionar
create function pg_temp.expect_ok(q text, label text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    raise exception 'FAIL: % (debía funcionar y falló: %)', label, sqlerrm;
  end;
end $$;

-- el UPDATE/DELETE no debe afectar ninguna fila (o debe fallar)
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

-- Datos de prueba ----------------------------------------------------
insert into public.clubs (id, name, sport, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Club A', 'rugby',  'club-a'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Club B', 'hockey', 'club-b');

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-00000000000a', 'hc@test.cl'), ('20000000-0000-0000-0000-00000000000a', 'manager@test.cl'), ('30000000-0000-0000-0000-00000000000a', 'kine@test.cl'), ('40000000-0000-0000-0000-00000000000a', 'coach@test.cl'),
  ('60000000-0000-0000-0000-00000000000a', 'j1@test.cl'), ('70000000-0000-0000-0000-00000000000a', 'jpend@test.cl'), ('30000000-0000-0000-0000-00000000000b', 'kine-b@test.cl'), ('60000000-0000-0000-0000-00000000000b', 'jb@test.cl');

insert into public.profiles (id, club_id, roles, full_name, status) values
  ('10000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{head_coach}',  'Head Coach A', 'confirmado'),
  ('20000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{manager}',     'Manager A',    'confirmado'),
  ('30000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{kinesiologo}', 'Kine A',       'confirmado'),
  ('40000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{entrenador}',  'Entrenador A', 'confirmado'),
  ('60000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{jugador}',     'Jugador A1',   'confirmado'),
  ('70000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{jugador}',     'Jugador Pend', 'pendiente'),
  ('30000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', '{kinesiologo}', 'Kine B',       'confirmado'),
  ('60000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', '{jugador}',     'Jugador B1',   'confirmado');

insert into public.players (id, club_id, full_name, first_name, last_name, position, status, user_id) values
  ('a1000000-1111-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Jugador A1',   'Jugador', 'A1',   'Pilar',   'confirmado', '60000000-0000-0000-0000-00000000000a'),
  ('a1000000-1111-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Jugador A2',   'Jugador', 'A2',   'Hooker',  'confirmado', null),
  ('a1000000-1111-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Jugador Pend', 'Jugador', 'Pend', 'Apertura','pendiente',  '70000000-0000-0000-0000-00000000000a'),
  ('b1000000-1111-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Jugador B1',   'Jugador', 'B1',   'Arquero', 'confirmado', '60000000-0000-0000-0000-00000000000b');

-- archivo ajeno que existe en storage (para probar que no se puede referenciar)
insert into storage.objects (bucket_id, name) values ('medical-docs', 'aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000002/ajeno.pdf');

-- =======================================================================
-- 1. Marcar a un jugador lesionado (sin diagnóstico)
-- =======================================================================
select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select public.mark_player_injured('a1000000-1111-0000-0000-000000000001', 'entrenamiento', 'Golpe en la rodilla')$q$, 'entrenador marca lesión');
select pg_temp.back();

select pg_temp.as_user('20000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select public.mark_player_injured('a1000000-1111-0000-0000-000000000001', 'entrenamiento', 'Golpe en la rodilla')$q$, 'manager marca lesión');
select pg_temp.back();

select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select public.mark_player_injured('a1000000-1111-0000-0000-000000000001', 'entrenamiento', 'Me duele la rodilla')$q$, 'jugador se marca a sí mismo');
select pg_temp.back();

select pg_temp.as_anon();
select pg_temp.expect_fail($q$select public.mark_player_injured('a1000000-1111-0000-0000-000000000001', 'entrenamiento', 'Golpe')$q$, 'anónimo marca lesión');
select pg_temp.back();

select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select public.mark_player_injured('b1000000-1111-0000-0000-000000000001', 'entrenamiento', 'Golpe en la rodilla')$q$, 'kine A marca a jugador del club B');
select pg_temp.expect_fail($q$select public.mark_player_injured('a1000000-1111-0000-0000-000000000003', 'entrenamiento', 'Golpe en la rodilla')$q$, 'kine A marca a jugador pendiente');
select pg_temp.expect_fail($q$select public.mark_player_injured('a1000000-1111-0000-0000-000000000001', 'gimnasio', 'Golpe en la rodilla')$q$, 'dónde ocurrió inválido');
select pg_temp.expect_fail($q$select public.mark_player_injured('a1000000-1111-0000-0000-000000000001', 'entrenamiento', 'x')$q$, 'nota demasiado corta');
select pg_temp.expect_fail($q$select public.mark_player_injured('a1000000-1111-0000-0000-000000000001', 'entrenamiento', 'Golpe', 'reintegro', current_date + 1)$q$, 'fecha futura');
select pg_temp.expect_ok($q$select public.mark_player_injured('a1000000-1111-0000-0000-000000000001', 'entrenamiento', 'Golpe en la rodilla')$q$, 'kine A marca a A1');
select pg_temp.expect_fail($q$select public.mark_player_injured('a1000000-1111-0000-0000-000000000001', 'competencia', 'Otro golpe')$q$, 'marcar dos veces en evaluación');
select pg_temp.back();

select pg_temp.expect_count($q$select 1 from public.injuries where player_id = 'a1000000-1111-0000-0000-000000000001' and status = 'en_evaluacion' and severity is null
  and occurred_during = 'entrenamiento' and type = 'Golpe en la rodilla' and not reported_by_player$q$, 1, 'A1 queda en evaluación sin diagnóstico');
select pg_temp.expect_count($q$select 1 from public.players where id = 'a1000000-1111-0000-0000-000000000001' and availability = 'en_revision'$q$, 1, 'A1 queda en revisión por defecto');

select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.mark_player_injured('a1000000-1111-0000-0000-000000000002', 'competencia', 'Dolor en el hombro', 'lesionado')$q$, 'head coach marca a A2');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.players where id = 'a1000000-1111-0000-0000-000000000002' and availability = 'lesionado'$q$, 1, 'A2 queda lesionado, como indicó');

-- visibilidad
select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.injuries where status = 'en_evaluacion'$q$, 2, 'entrenador ve las lesiones en evaluación');
select pg_temp.back();
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.injuries where status = 'en_evaluacion'$q$, 1, 'A1 ve su lesión en evaluación, no la de A2');
select pg_temp.back();
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
select pg_temp.expect_count($q$select 1 from public.injuries$q$, 0, 'B1 no ve lesiones del club A');
select pg_temp.back();

-- =======================================================================
-- 2. El jugador completa su diagnóstico
-- =======================================================================
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$insert into storage.objects (bucket_id, name) values ('medical-docs', 'aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/diag.pdf')$q$, 'A1 sube su archivo');
select pg_temp.expect_fail($q$select public.complete_injury_report((select id from public.injuries where player_id = 'a1000000-1111-0000-0000-000000000002'), 'Luxación', 6, 'semanas', null,
  '[{"path":"aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/diag.pdf","name":"diag.pdf"}]'::jsonb)$q$, 'A1 completa la lesión de otro jugador');
select pg_temp.expect_fail($q$select public.complete_injury_report((select id from public.injuries where player_id = 'a1000000-1111-0000-0000-000000000001'), 'Esguince', 6, 'semanas', null,
  '[{"path":"aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/noexiste.pdf","name":"x.pdf"}]'::jsonb)$q$, 'archivo inexistente');
select pg_temp.expect_fail($q$select public.complete_injury_report((select id from public.injuries where player_id = 'a1000000-1111-0000-0000-000000000001'), 'Esguince', 6, 'semanas', null,
  '[{"path":"aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000002/ajeno.pdf","name":"x.pdf"}]'::jsonb)$q$, 'archivo de otro jugador');
select pg_temp.expect_fail($q$select public.complete_injury_report((select id from public.injuries where player_id = 'a1000000-1111-0000-0000-000000000001'), 'Esguince', 0, 'semanas', null,
  '[{"path":"aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/diag.pdf","name":"diag.pdf"}]'::jsonb)$q$, 'duración inválida');
select pg_temp.expect_fail($q$select public.complete_injury_report((select id from public.injuries where player_id = 'a1000000-1111-0000-0000-000000000001'), 'Esguince', 6, 'semanas', null, '[]'::jsonb)$q$, 'sin documentos');
select pg_temp.expect_ok($q$select public.complete_injury_report((select id from public.injuries where player_id = 'a1000000-1111-0000-0000-000000000001'), 'Esguince de rodilla', 8, 'semanas', 'Me lo vio un traumatólogo',
  '[{"path":"aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/diag.pdf","name":"diag.pdf"}]'::jsonb)$q$, 'A1 completa su diagnóstico');
select pg_temp.expect_fail($q$select public.complete_injury_report((select id from public.injuries where player_id = 'a1000000-1111-0000-0000-000000000001'), 'Esguince de rodilla', 8, 'semanas', null,
  '[{"path":"aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/diag.pdf","name":"diag.pdf"}]'::jsonb)$q$, 'completar dos veces');
select pg_temp.expect_count($q$select 1 from public.injuries where status = 'activa' and type = 'Esguince de rodilla' and reported_by_player
  and doctor_estimate_value = 8 and doctor_estimate_unit = 'semanas' and expected_return_on = started_on + 56 and reviewed_at is null$q$, 1,
  'la lesión queda activa, con lo que dijo el médico y sin revisar');
select pg_temp.expect_count($q$select 1 from public.documents where injury_id is not null and status = 'borrador'$q$, 1, 'A1 ve su documento ligado a la lesión');
select pg_temp.expect_no_rows($q$update public.injuries set severity = 'leve'$q$, 'jugador edita su lesión');
select pg_temp.back();

select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select public.complete_injury_report((select id from public.injuries where player_id = 'a1000000-1111-0000-0000-000000000002'), 'x', 6, 'semanas', null, '[]'::jsonb)$q$, 'entrenador completa lesión');
select pg_temp.back();

-- =======================================================================
-- 3. Revisión: confirmar, descartar, cerrar
-- =======================================================================
select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select public.review_injury((select id from public.injuries where player_id = 'a1000000-1111-0000-0000-000000000001'), 'confirmar', 'moderada')$q$, 'entrenador revisa');
select pg_temp.back();
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select public.review_injury((select id from public.injuries where player_id = 'a1000000-1111-0000-0000-000000000001'), 'confirmar', 'leve')$q$, 'jugador revisa');
select pg_temp.back();
select pg_temp.as_user('30000000-0000-0000-0000-00000000000b');
select pg_temp.expect_fail($q$select public.review_injury('a2000000-2222-0000-0000-000000000000', 'descartar')$q$, 'kine B revisa una lesión inexistente');
select pg_temp.back();

-- id de la lesión de A1 (como superusuario, para usarla en consultas siguientes)
create temp table ids as select id as a1 from public.injuries where player_id = 'a1000000-1111-0000-0000-000000000001';
create temp table ids2 as select id as a2 from public.injuries where player_id = 'a1000000-1111-0000-0000-000000000002';
grant select on ids, ids2 to authenticated;

select pg_temp.as_user('30000000-0000-0000-0000-00000000000b');
select pg_temp.expect_fail($q$select public.review_injury((select a1 from ids), 'descartar')$q$, 'kine B revisa lesión del club A');
select pg_temp.back();

select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select public.review_injury((select a1 from ids), 'borrar')$q$, 'decisión inválida');
select pg_temp.expect_fail($q$select public.review_injury((select a1 from ids), 'confirmar')$q$, 'confirmar sin gravedad');
select pg_temp.expect_fail($q$select public.review_injury((select a1 from ids), 'confirmar', 'moderada', current_date - 400)$q$, 'fecha de alta anterior a la lesión');
select pg_temp.expect_fail($q$select public.review_injury((select a2 from ids2), 'cerrar')$q$, 'cerrar una lesión que sigue en evaluación');
select pg_temp.expect_ok($q$select public.review_injury((select a1 from ids), 'confirmar', 'moderada')$q$, 'kine confirma la lesión de A1');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.injuries where id = (select a1 from ids) and severity = 'moderada' and reviewed_by = '30000000-0000-0000-0000-00000000000a' and reviewed_at is not null
  and doctor_estimate_value = 8 and status = 'activa'$q$, 1, 'queda revisada y se conserva lo que dijo el médico');
select pg_temp.expect_count($q$select 1 from public.players where id = 'a1000000-1111-0000-0000-000000000001' and availability = 'lesionado'$q$, 1, 'confirmar deja lesionado');

select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.review_injury((select a1 from ids), 'confirmar', 'leve', null, null)$q$, 'kine cambia a leve');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.players where id = 'a1000000-1111-0000-0000-000000000001' and availability = 'lesionado'$q$, 1, 'leve también deja lesionado');
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.review_injury((select a1 from ids), 'confirmar', 'grave', null, 'reintegro')$q$, 'kine fuerza la disponibilidad');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.players where id = 'a1000000-1111-0000-0000-000000000001' and availability = 'reintegro'$q$, 1, 'la disponibilidad indicada manda sobre la sugerida');

-- head coach descarta la de A2 (no había lesión): vuelve a disponible
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.review_injury((select a2 from ids2), 'descartar')$q$, 'head coach descarta la lesión de A2');
select pg_temp.expect_fail($q$select public.review_injury((select a2 from ids2), 'descartar')$q$, 'descartar dos veces');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.injuries where id = (select a2 from ids2) and status = 'descartada' and closed_on = current_date$q$, 1, 'queda descartada');
select pg_temp.expect_count($q$select 1 from public.players where id = 'a1000000-1111-0000-0000-000000000002' and availability = 'disponible'$q$, 1, 'A2 vuelve a disponible');

-- A1 se vuelve a lesionar mientras tiene una activa: descartar la nueva no lo libera
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.mark_player_injured('a1000000-1111-0000-0000-000000000001', 'competencia', 'Golpe en el tobillo', 'lesionado')$q$, 'kine marca a A1 de nuevo');
select pg_temp.back();
create temp table ids3 as select id as a3 from public.injuries where player_id = 'a1000000-1111-0000-0000-000000000001' and status = 'en_evaluacion';
grant select on ids3 to authenticated;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.review_injury((select a3 from ids3), 'descartar')$q$, 'kine descarta la segunda');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.players where id = 'a1000000-1111-0000-0000-000000000001' and availability <> 'disponible'$q$, 1, 'A1 sigue sin estar disponible: queda la primera lesión activa');

-- alta: cerrar la primera → disponible
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.review_injury((select a1 from ids), 'cerrar')$q$, 'head coach da de alta a A1');
select pg_temp.expect_fail($q$select public.review_injury((select a1 from ids), 'cerrar')$q$, 'cerrar dos veces');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.injuries where id = (select a1 from ids) and status = 'cerrada' and closed_on = current_date$q$, 1, 'la lesión queda cerrada');
select pg_temp.expect_count($q$select 1 from public.players where id = 'a1000000-1111-0000-0000-000000000001' and availability = 'disponible'$q$, 1, 'A1 vuelve a disponible');

-- el jugador sigue viendo su historial
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.injuries$q$, 2, 'A1 ve su historial (cerrada y descartada)');
select pg_temp.expect_count($q$select 1 from public.injuries where status = 'cerrada'$q$, 1, 'A1 ve su lesión cerrada');
select pg_temp.back();

-- =======================================================================
-- 4. Disponibilidad "en revisión" (0011)
-- =======================================================================
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.mark_player_injured('a1000000-1111-0000-0000-000000000002', 'entrenamiento', 'Golpe en la espalda', 'en_revision')$q$, 'kine marca a A2 en revisión');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.players where id = 'a1000000-1111-0000-0000-000000000002' and availability = 'en_revision'$q$, 1, 'A2 queda en revisión');

create temp table ids4 as select id as a4 from public.injuries where player_id = 'a1000000-1111-0000-0000-000000000002' and status = 'en_evaluacion';
grant select on ids4 to authenticated;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.review_injury((select a4 from ids4), 'confirmar', 'leve', current_date + 14)$q$, 'kine confirma la lesión de A2');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.players where id = 'a1000000-1111-0000-0000-000000000002' and availability = 'lesionado'$q$, 1, 'al confirmar deja de estar en revisión');

select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.players where availability = 'lesionado'$q$, 1, 'el jugador ve el estado del plantel');
select pg_temp.back();

rollback;
