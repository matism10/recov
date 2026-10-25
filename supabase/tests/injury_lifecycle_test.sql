-- Recov · Test del ciclo de vida de la lesión (migraciones 0009 a 0020)
-- Correr DESPUÉS de las migraciones 0001 a 0020. Autónomo: crea sus propios datos y termina en ROLLBACK.
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

-- Desde 0043 profiles es solo identidad: el plantel, los roles y el estado van a club_members (preparación).
with v(id, club_id, roles, full_name, status) as (values
  ('10000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{head_coach}',  'Head Coach A', 'confirmado'),
  ('20000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{manager}',     'Manager A',    'confirmado'),
  ('30000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{kinesiologo}', 'Kine A',       'confirmado'),
  ('40000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{entrenador}',  'Entrenador A', 'confirmado'),
  ('60000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{jugador}',     'Jugador A1',   'confirmado'),
  ('70000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{jugador}',     'Jugador Pend', 'pendiente'),
  ('30000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', '{kinesiologo}', 'Kine B',       'confirmado'),
  ('60000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', '{jugador}',     'Jugador B1',   'confirmado')),
     p as (insert into public.profiles (id, full_name) select id::uuid, full_name from v)
insert into public.club_members (user_id, club_id, roles, status)
select id::uuid, club_id::uuid, roles::public.user_role[], status::public.member_status from v;

insert into public.players (id, club_id, full_name, first_name, last_name, position, status, user_id) values
  ('a1000000-1111-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Jugador A1',   'Jugador', 'A1',   'Pilar',   'confirmado', '60000000-0000-0000-0000-00000000000a'),
  ('a1000000-1111-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Jugador A2',   'Jugador', 'A2',   'Hooker',  'confirmado', null),
  ('a1000000-1111-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Jugador Pend', 'Jugador', 'Pend', 'Apertura','pendiente',  '70000000-0000-0000-0000-00000000000a'),
  ('b1000000-1111-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Jugador B1',   'Jugador', 'B1',   'Defensa central', 'confirmado', '60000000-0000-0000-0000-00000000000b');

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

-- =======================================================================
-- 5. Descartar o cerrar con otra lesión abierta (0014)
-- =======================================================================
-- A2 tiene una lesión activa (confirmada en la sección 4) y está lesionado.
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.mark_player_injured('a1000000-1111-0000-0000-000000000002', 'competencia', 'Golpe en la cabeza', 'en_revision')$q$, 'kine marca a A2 otra vez');
select pg_temp.back();
create temp table ids5 as select id as a5 from public.injuries where player_id = 'a1000000-1111-0000-0000-000000000002' and status = 'en_evaluacion';
grant select on ids5 to authenticated;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.review_injury((select a5 from ids5), 'descartar')$q$, 'kine descarta la nueva');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.players where id = 'a1000000-1111-0000-0000-000000000002' and availability = 'lesionado'$q$, 1,
  'descartar con otra lesión activa deja lesionado, no en revisión');

-- Cerrar la activa mientras otra sigue en evaluación: sigue en revisión.
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.mark_player_injured('a1000000-1111-0000-0000-000000000002', 'entrenamiento', 'Dolor en el tobillo', 'en_revision')$q$, 'kine marca a A2 una vez más');
select pg_temp.expect_ok($q$select public.review_injury((select a4 from ids4), 'cerrar')$q$, 'kine da de alta la lesión activa de A2');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.players where id = 'a1000000-1111-0000-0000-000000000002' and availability = 'en_revision'$q$, 1,
  'con otra lesión en evaluación sigue en revisión');

create temp table ids6 as select id as a6 from public.injuries where player_id = 'a1000000-1111-0000-0000-000000000002' and status = 'en_evaluacion';
grant select on ids6 to authenticated;
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.review_injury((select a6 from ids6), 'descartar')$q$, 'head coach descarta la última');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.players where id = 'a1000000-1111-0000-0000-000000000002' and availability = 'disponible'$q$, 1,
  'sin lesiones abiertas vuelve a disponible');

-- =======================================================================
-- 6. Fases de recuperación (0015)
-- =======================================================================
-- Compañero de A1 con cuenta, para probar qué ve de las fases de otros.
insert into auth.users (id, email) values ('90000000-0000-0000-0000-00000000000a', 'j3@test.cl');
-- Desde 0043 profiles es solo identidad: el plantel, los roles y el estado van a club_members (preparación).
with v(id, club_id, roles, full_name, status) as (values
  ('90000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{jugador}', 'Jugador A3', 'confirmado')),
     p as (insert into public.profiles (id, full_name) select id::uuid, full_name from v)
insert into public.club_members (user_id, club_id, roles, status)
select id::uuid, club_id::uuid, roles::public.user_role[], status::public.member_status from v;
insert into public.players (id, club_id, full_name, first_name, last_name, position, status, user_id) values
  ('a1000000-1111-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'Jugador A3', 'Jugador', 'A3', 'Wing', 'confirmado', '90000000-0000-0000-0000-00000000000a');

-- A1 tiene una lesión activa, confirmada.
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.mark_player_injured('a1000000-1111-0000-0000-000000000001', 'competencia', 'Golpe en el muslo', 'en_revision')$q$, 'kine marca a A1 para fases');
select pg_temp.back();
create temp table ids7 as select id as a7 from public.injuries where player_id = 'a1000000-1111-0000-0000-000000000001' and status = 'en_evaluacion';
grant select on ids7 to authenticated;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select public.set_injury_phases((select a7 from ids7), '[{"name":"Reposo"}]'::jsonb)$q$, 'fases de una lesión en evaluación');
select pg_temp.expect_ok($q$select public.review_injury((select a7 from ids7), 'confirmar', 'moderada', current_date + 60)$q$, 'kine confirma la lesión de A1');
select pg_temp.back();

-- Permisos
select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select public.set_injury_phases((select a7 from ids7), '[{"name":"Reposo"}]'::jsonb)$q$, 'entrenador define fases');
select pg_temp.expect_fail($q$select public.advance_injury_phase((select a7 from ids7))$q$, 'entrenador avanza fases');
select pg_temp.back();
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select public.set_injury_phases((select a7 from ids7), '[{"name":"Reposo"}]'::jsonb)$q$, 'jugador define sus fases');
select pg_temp.back();
select pg_temp.as_user('30000000-0000-0000-0000-00000000000b');
select pg_temp.expect_fail($q$select public.set_injury_phases((select a7 from ids7), '[{"name":"Reposo"}]'::jsonb)$q$, 'kine B define fases del club A');
select pg_temp.back();

-- Validaciones
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select public.set_injury_phases((select a7 from ids7), '[]'::jsonb)$q$, 'sin fases');
select pg_temp.expect_fail($q$select public.set_injury_phases((select a7 from ids7), '[{"name":"x"}]'::jsonb)$q$, 'nombre muy corto');
select pg_temp.expect_fail($q$select public.set_injury_phases((select a7 from ids7), '[{"name":"Reposo","status":"en_curso"},{"name":"Rehabilitación","status":"en_curso"}]'::jsonb)$q$, 'dos fases en curso');
select pg_temp.expect_fail($q$select public.set_injury_phases((select a7 from ids7), format('[{"name":"Reposo","started_on":"%s"}]', current_date - 400)::jsonb)$q$, 'fase antes de la lesión');
select pg_temp.expect_fail($q$select public.set_injury_phases((select a7 from ids7), '[{"name":"Reposo","status":"pendiente"},{"name":"Rehabilitación","status":"completada"}]'::jsonb)$q$, 'completada después de una pendiente');

-- El head coach carga la plantilla
select pg_temp.expect_ok($q$select public.set_injury_phases((select a7 from ids7), format(
  '[{"name":"Reposo","status":"en_curso","started_on":"%s"},{"name":"Rehabilitación"},{"name":"Readaptación"},{"name":"Reintegro"}]',
  current_date)::jsonb)$q$, 'head coach define 4 fases');

-- Agregar una fase y después quitarla: queda marcada como quitada, no se borra.
select pg_temp.expect_ok($q$select public.set_injury_phases((select a7 from ids7),
  (select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'status', status, 'started_on', started_on) order by position)
     from public.injury_phases where injury_id = (select a7 from ids7) and archived_at is null)
  || '[{"name":"Control médico"}]'::jsonb)$q$, 'head coach agrega una fase');
select pg_temp.expect_count($q$select 1 from public.injury_phases where injury_id = (select a7 from ids7) and archived_at is null$q$, 5, 'quedan 5 fases');
select pg_temp.expect_ok($q$select public.set_injury_phases((select a7 from ids7),
  (select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'status', status, 'started_on', started_on) order by position)
     from public.injury_phases where injury_id = (select a7 from ids7) and archived_at is null and name <> 'Control médico'))$q$, 'head coach quita esa fase');
select pg_temp.expect_count($q$select 1 from public.injury_phases where injury_id = (select a7 from ids7) and archived_at is null$q$, 4, 'vuelven a ser 4 fases visibles');
select pg_temp.expect_count($q$select 1 from public.injury_phases where injury_id = (select a7 from ids7) and archived_at is not null and name = 'Control médico'$q$, 1,
  'la fase quitada se conserva marcada');
select pg_temp.expect_fail($q$select public.set_injury_phases((select a7 from ids7),
  jsonb_build_array(jsonb_build_object('id', (select id from public.injury_phases where injury_id = (select a7 from ids7) and archived_at is not null), 'name', 'Control médico')))$q$,
  'reusar el id de una fase quitada');
select pg_temp.back();

-- Visibilidad
select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.injury_phases where injury_id = (select a7 from ids7) and archived_at is null$q$, 4, 'el entrenador ve las fases');
select pg_temp.back();
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.injury_phases where archived_at is null$q$, 4, 'A1 ve las fases de su lesión');
select pg_temp.back();
select pg_temp.as_user('90000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.injury_phases$q$, 0, 'A3 no ve las fases de A1');
select pg_temp.expect_count($q$select 1 from public.injuries$q$, 0, 'A3 no ve la lesión de A1');
select pg_temp.expect_count($q$select 1 from public.squad_current_phases() where player_id = 'a1000000-1111-0000-0000-000000000001' and phase_name = 'Reposo'$q$, 1,
  'A3 ve solo el nombre de la fase en curso de A1');
select pg_temp.back();
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
select pg_temp.expect_count($q$select 1 from public.squad_current_phases()$q$, 0, 'B1 no ve fases del club A');
select pg_temp.back();
select pg_temp.as_anon();
select pg_temp.expect_fail($q$select 1 from public.squad_current_phases()$q$, 'anónimo ve fases');
select pg_temp.back();

-- Avanzar hasta Reintegro
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.advance_injury_phase((select a7 from ids7))$q$, 'avanza a Rehabilitación');
select pg_temp.expect_ok($q$select public.advance_injury_phase((select a7 from ids7))$q$, 'avanza a Readaptación');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.players where id = 'a1000000-1111-0000-0000-000000000001' and availability = 'lesionado'$q$, 1, 'antes de Reintegro sigue lesionado');
select pg_temp.expect_count($q$select 1 from public.injury_phases where injury_id = (select a7 from ids7) and archived_at is null and status = 'completada' and ended_on = current_date$q$, 2, 'dos fases completadas');
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.advance_injury_phase((select a7 from ids7))$q$, 'avanza a Reintegro');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.players where id = 'a1000000-1111-0000-0000-000000000001' and availability = 'reintegro'$q$, 1, 'la fase Reintegro lo pone en reintegro');
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.advance_injury_phase((select a7 from ids7))$q$, 'completa Reintegro');
select pg_temp.expect_fail($q$select public.advance_injury_phase((select a7 from ids7))$q$, 'no quedan fases');
select pg_temp.expect_ok($q$select public.review_injury((select a7 from ids7), 'cerrar')$q$, 'alta de A1');
select pg_temp.expect_fail($q$select public.set_injury_phases((select a7 from ids7), '[{"name":"Reposo"}]'::jsonb)$q$, 'fases de una lesión cerrada');
select pg_temp.back();

-- =======================================================================
-- 7. Lugar de la lesión: 'externo' y obligatorio para el jugador (0018)
-- =======================================================================
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');   -- jugador A1
select pg_temp.expect_ok($q$insert into storage.objects (bucket_id, name) values ('medical-docs', 'aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/ext.pdf')$q$, 'A1 sube su archivo');
select pg_temp.expect_fail($q$select public.report_injury('Esguince', current_date - 1, 2, 'semanas', null,
  '[{"path":"aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/ext.pdf","name":"ext.pdf"}]'::jsonb, null)$q$, 'report_injury sin lugar');
select pg_temp.expect_fail($q$select public.report_injury('Esguince', current_date - 1, 2, 'semanas', null,
  '[{"path":"aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/ext.pdf","name":"ext.pdf"}]'::jsonb, 'partido')$q$, 'report_injury con lugar inválido');
select pg_temp.expect_ok($q$select public.report_injury('Esguince fuera del club', current_date - 1, 2, 'semanas', null,
  '[{"path":"aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/ext.pdf","name":"ext.pdf"}]'::jsonb, 'externo')$q$, 'report_injury con lugar externo');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.injuries where player_id = 'a1000000-1111-0000-0000-000000000001'
  and reported_by_player and status = 'activa' and occurred_during = 'externo'$q$, 1, 'la lesión del jugador guarda el lugar externo');

select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');   -- kine A
select pg_temp.expect_ok($q$select public.mark_player_injured('a1000000-1111-0000-0000-000000000004', 'externo', 'Golpe fuera del club')$q$, 'mark_player_injured con lugar externo');
select pg_temp.expect_fail($q$select public.mark_player_injured('a1000000-1111-0000-0000-000000000002', 'partido', 'Golpe en la rodilla')$q$, 'mark_player_injured con lugar inválido');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.injuries where player_id = 'a1000000-1111-0000-0000-000000000004'
  and status = 'en_evaluacion' and occurred_during = 'externo'$q$, 1, 'la lesión marcada guarda el lugar externo');

-- La firma vieja de report_injury (6 argumentos) ya no existe
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'report_injury' and p.pronargs = 6$q$, 0, 'no existe report_injury de 6 argumentos');
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'report_injury' and p.pronargs = 7$q$, 1, 'existe report_injury de 7 argumentos');

-- El CHECK rechaza lugares fuera de la lista, también en inserts directos
select pg_temp.expect_fail($q$insert into public.injuries (club_id, player_id, type, severity, occurred_during)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000002', 'x', 'leve', 'otro')$q$, 'insert directo con lugar fuera del CHECK');

-- =======================================================================
-- 8. Historial de disponibilidad (0019)
-- =======================================================================
-- Jugador nuevo A5: el INSERT deja la fila inicial (sin estado anterior).
insert into public.players (id, club_id, full_name, first_name, last_name, position, status) values
  ('a1000000-1111-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'Jugador A5', 'Jugador', 'A5', 'Centro', 'confirmado');
select pg_temp.expect_count($q$select 1 from public.availability_log where player_id = 'a1000000-1111-0000-0000-000000000005'$q$, 1, 'el insert del jugador deja 1 fila');
select pg_temp.expect_count($q$select 1 from (select from_status, to_status from public.availability_log
  where player_id = 'a1000000-1111-0000-0000-000000000005' order by id desc limit 1) l where from_status is null and to_status = 'disponible'$q$, 1, 'la fila inicial no tiene estado anterior y queda disponible');

-- mark_player_injured: disponible -> en_revision, firmado por el kine
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.mark_player_injured('a1000000-1111-0000-0000-000000000005', 'entrenamiento', 'Golpe en la rodilla')$q$, 'kine marca a A5');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.availability_log where player_id = 'a1000000-1111-0000-0000-000000000005'$q$, 2, 'marcar lesionado escribe 1 fila');
select pg_temp.expect_count($q$select 1 from (select from_status, to_status from public.availability_log
  where player_id = 'a1000000-1111-0000-0000-000000000005' order by id desc limit 1) l where from_status = 'disponible' and to_status = 'en_revision'$q$, 1, 'marcar pasa de disponible a en revisión');
select pg_temp.expect_count($q$select 1 from (select changed_by from public.availability_log
  where player_id = 'a1000000-1111-0000-0000-000000000005' order by id desc limit 1) l where changed_by = '30000000-0000-0000-0000-00000000000a'$q$, 1, 'la fila queda firmada por el kine');

-- review_injury confirmar: en_revision -> lesionado
create temp table ids8 as select id as a8 from public.injuries where player_id = 'a1000000-1111-0000-0000-000000000005' and status = 'en_evaluacion';
grant select on ids8 to authenticated;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.review_injury((select a8 from ids8), 'confirmar', 'moderada', current_date + 30)$q$, 'kine confirma la lesión de A5');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.availability_log where player_id = 'a1000000-1111-0000-0000-000000000005'$q$, 3, 'confirmar escribe 1 fila');
select pg_temp.expect_count($q$select 1 from (select from_status, to_status from public.availability_log
  where player_id = 'a1000000-1111-0000-0000-000000000005' order by id desc limit 1) l where from_status = 'en_revision' and to_status = 'lesionado'$q$, 1, 'confirmar pasa de en revisión a lesionado');

-- set_player_availability: escribe solo si el valor cambia
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');   -- head coach
select pg_temp.expect_ok($q$select public.set_player_availability('a1000000-1111-0000-0000-000000000005', 'reintegro')$q$, 'head coach pasa a A5 a reintegro');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.availability_log where player_id = 'a1000000-1111-0000-0000-000000000005'$q$, 4, 'el cambio manual escribe 1 fila');
select pg_temp.expect_count($q$select 1 from (select from_status, to_status from public.availability_log
  where player_id = 'a1000000-1111-0000-0000-000000000005' order by id desc limit 1) l where from_status = 'lesionado' and to_status = 'reintegro'$q$, 1, 'el cambio manual pasa de lesionado a reintegro');
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.set_player_availability('a1000000-1111-0000-0000-000000000005', 'reintegro')$q$, 'head coach repite el mismo estado');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.availability_log where player_id = 'a1000000-1111-0000-0000-000000000005'$q$, 4, 'repetir el mismo estado no escribe fila');
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.set_player_availability('a1000000-1111-0000-0000-000000000005', 'lesionado')$q$, 'head coach vuelve a A5 a lesionado');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.availability_log where player_id = 'a1000000-1111-0000-0000-000000000005'$q$, 5, 'volver a lesionado escribe 1 fila');

-- advance_injury_phase hacia "Reintegro": lesionado -> reintegro
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.set_injury_phases((select a8 from ids8), format(
  '[{"name":"Reposo","status":"en_curso","started_on":"%s"},{"name":"Reintegro"}]', current_date)::jsonb)$q$, 'kine define fases de A5');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.availability_log where player_id = 'a1000000-1111-0000-0000-000000000005'$q$, 5, 'definir fases sin Reintegro en curso no escribe fila');
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.advance_injury_phase((select a8 from ids8))$q$, 'avanza a Reintegro');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.availability_log where player_id = 'a1000000-1111-0000-0000-000000000005'$q$, 6, 'avanzar a Reintegro escribe 1 fila');
select pg_temp.expect_count($q$select 1 from (select from_status, to_status from public.availability_log
  where player_id = 'a1000000-1111-0000-0000-000000000005' order by id desc limit 1) l where from_status = 'lesionado' and to_status = 'reintegro'$q$, 1, 'la fase Reintegro pasa de lesionado a reintegro');

-- descartar con otra lesión abierta: no escribe (la disponibilidad no cambia)
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.mark_player_injured('a1000000-1111-0000-0000-000000000005', 'competencia', 'Otro golpe', 'reintegro')$q$, 'kine marca a A5 otra vez sin cambiar su estado');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.availability_log where player_id = 'a1000000-1111-0000-0000-000000000005'$q$, 6, 'marcar con el mismo estado no escribe fila');
create temp table ids9 as select id as a9 from public.injuries where player_id = 'a1000000-1111-0000-0000-000000000005' and status = 'en_evaluacion';
grant select on ids9 to authenticated;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.review_injury((select a9 from ids9), 'descartar')$q$, 'kine descarta la segunda lesión');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.availability_log where player_id = 'a1000000-1111-0000-0000-000000000005'$q$, 6, 'descartar con otra lesión abierta no escribe fila');

-- cerrar la última lesión abierta: reintegro -> disponible
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.review_injury((select a8 from ids8), 'cerrar')$q$, 'alta de A5');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.availability_log where player_id = 'a1000000-1111-0000-0000-000000000005'$q$, 7, 'el alta sin otras lesiones abiertas escribe 1 fila');
select pg_temp.expect_count($q$select 1 from (select from_status, to_status from public.availability_log
  where player_id = 'a1000000-1111-0000-0000-000000000005' order by id desc limit 1) l where from_status = 'reintegro' and to_status = 'disponible'$q$, 1, 'el alta pasa de reintegro a disponible');

-- UPDATE directo como postgres: también queda registrado, sin autor.
-- back() solo hace reset role; se limpian los claims para que auth.uid() sea null (como en el seed).
select set_config('request.jwt.claims', '', true);
update public.players set availability = 'lesionado' where id = 'a1000000-1111-0000-0000-000000000005';
select pg_temp.expect_count($q$select 1 from public.availability_log where player_id = 'a1000000-1111-0000-0000-000000000005'$q$, 8, 'el update directo escribe 1 fila');
select pg_temp.expect_count($q$select 1 from (select from_status, to_status, changed_by from public.availability_log
  where player_id = 'a1000000-1111-0000-0000-000000000005' order by id desc limit 1) l where from_status = 'disponible' and to_status = 'lesionado' and changed_by is null$q$, 1,
  'el update directo pasa de disponible a lesionado y no tiene autor');

-- El orden por id coincide con el orden por changed_at
select pg_temp.expect_count($q$select 1 from (
  select changed_at, lag(changed_at) over (order by id) as anterior
    from public.availability_log where player_id = 'a1000000-1111-0000-0000-000000000005') o
  where anterior is not null and changed_at < anterior$q$, 0, 'el orden por id coincide con el orden por changed_at');

-- =======================================================================
-- 9. Agregados del dashboard (0020)
-- =======================================================================
-- Punto de partida limpio: lo anterior del club A queda fuera de los agregados
-- (jugadores inactivos, lesiones descartadas). Todo se revierte con el ROLLBACK.
update public.players set active = false where club_id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.injuries set status = 'descartada' where club_id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Jugadores nuevos, uno por caso y cada uno con su propia posición. D4 está inactivo.
insert into public.players (id, club_id, full_name, first_name, last_name, position, status, active) values
  ('a1000000-1111-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000001', 'Jugador D1', 'Jugador', 'D1', 'Octavo',        'confirmado', true),
  ('a1000000-1111-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000001', 'Jugador D2', 'Jugador', 'D2', 'Flanker',       'confirmado', true),
  ('a1000000-1111-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000001', 'Jugador D3', 'Jugador', 'D3', 'Segunda línea', 'confirmado', true),
  ('a1000000-1111-0000-0000-000000000014', 'aaaaaaaa-0000-0000-0000-000000000001', 'Jugador D4', 'Jugador', 'D4', 'Medio scrum',   'confirmado', false),
  ('a1000000-1111-0000-0000-000000000015', 'aaaaaaaa-0000-0000-0000-000000000001', 'Jugador D5', 'Jugador', 'D5', 'Fullback',      'confirmado', true),
  ('a1000000-1111-0000-0000-000000000016', 'aaaaaaaa-0000-0000-0000-000000000001', 'Jugador D6', 'Jugador', 'D6', 'Pilar',         'confirmado', true);

-- 9.1 dash_summary sigue la disponibilidad (D1: marcar y confirmar)
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.dash_summary()
  where total = 5 and disponibles = 5 and en_revision = 0 and lesionados = 0 and reintegro = 0$q$, 1, 'resumen inicial: 5 activos disponibles (D4 inactivo no cuenta)');
select pg_temp.expect_ok($q$select public.mark_player_injured('a1000000-1111-0000-0000-000000000011', 'entrenamiento', 'Golpe en el hombro')$q$, 'kine marca a D1');
select pg_temp.expect_count($q$select 1 from public.dash_summary()
  where total = 5 and disponibles = 4 and en_revision = 1 and lesionados = 0 and reintegro = 0$q$, 1, 'marcar: en revisión sube a 1 y disponibles baja a 4');
select pg_temp.back();
create temp table ids10 as select id as d1 from public.injuries where player_id = 'a1000000-1111-0000-0000-000000000011' and status = 'en_evaluacion';
grant select on ids10 to authenticated;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.review_injury((select d1 from ids10), 'confirmar', 'leve', current_date + 60)$q$, 'kine confirma la lesión de D1');
select pg_temp.expect_count($q$select 1 from public.dash_summary()
  where total = 5 and disponibles = 4 and en_revision = 0 and lesionados = 1 and reintegro = 0$q$, 1, 'confirmar: lesionados sube a 1 y en revisión vuelve a 0');
select pg_temp.back();

-- 9.2 Jugador inactivo (D4): fuera del resumen, recurrentes y próximas altas; sus lesiones sí cuentan
insert into public.injuries (club_id, player_id, type, severity, status, started_on, occurred_during, expected_return_on) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000014', 'Desgarro',    'moderada', 'activa',  current_date,     'competencia', current_date + 5),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000014', 'Contractura', 'leve',     'cerrada', current_date - 8, 'competencia', null);
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.dash_summary() where total = 5$q$, 1, 'D4 inactivo no cuenta en el total');
select pg_temp.expect_count($q$select 1 from public.dash_recurring_players() where player_id = 'a1000000-1111-0000-0000-000000000014'$q$, 0, 'D4 inactivo no aparece en recurrentes');
select pg_temp.expect_count($q$select 1 from public.dash_upcoming_returns() where player_id = 'a1000000-1111-0000-0000-000000000014'$q$, 0, 'D4 inactivo no aparece en próximas altas');
select pg_temp.expect_count($q$select 1 from public.dash_injuries_by_position()
  where position_name = 'Medio scrum' and injuries_count = 2 and players_count = 1$q$, 1, 'las lesiones de D4 cuentan por posición');
select pg_temp.expect_count($q$select 1 from public.dash_injuries_by_place() where place_key = 'competencia' and injuries_count = 2$q$, 1, 'las lesiones de D4 cuentan por lugar');
select pg_temp.back();

-- 9.3 Lesión descartada (D2): no cuenta en ningún agregado
insert into public.injuries (club_id, player_id, type, severity, status, started_on, occurred_during, expected_return_on) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000012', 'Esguince', 'leve', 'activa',     current_date,      'entrenamiento', null),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000012', 'Esguince', 'leve', 'cerrada',    current_date - 20, 'entrenamiento', null),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000012', 'Golpe',    null,   'descartada', current_date,      'competencia',   null);
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.dash_injuries_by_week(4)
  where week_start = date_trunc('week', current_date::timestamp)::date and injuries_count = 3$q$, 1, 'semana actual: D1, D4 y D2, sin la descartada');
select pg_temp.expect_count($q$select 1 from public.dash_injuries_by_place() where place_key = 'competencia' and injuries_count = 2$q$, 1, 'la descartada no suma en competencia');
select pg_temp.expect_count($q$select 1 from public.dash_injuries_by_position() where position_name = 'Flanker' and injuries_count = 2$q$, 1, 'la descartada no suma por posición');
select pg_temp.expect_count($q$select 1 from public.dash_recurring_players()
  where player_id = 'a1000000-1111-0000-0000-000000000012' and injuries_count = 2$q$, 1, 'la descartada no suma en recurrentes');
select pg_temp.back();

-- 9.4 Lesiones por semana: 4 filas, con semanas en cero; hoy - 8 cae en su semana
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.dash_injuries_by_week(4)$q$, 4, 'dash_injuries_by_week(4) devuelve 4 filas');
select pg_temp.expect_count($q$select 1 where exists (select 1 from public.dash_injuries_by_week(4) where injuries_count = 0)$q$, 1, 'incluye semanas en cero');
select pg_temp.expect_count($q$select 1 from public.dash_injuries_by_week(4)
  where week_start = date_trunc('week', (current_date - 8)::timestamp)::date and injuries_count = 1$q$, 1, 'la lesión de hace 8 días cae en su semana');
select pg_temp.back();

-- 9.5 Lugar: siempre 4 claves; externo, sin dato y ventana de 12 meses
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.dash_injuries_by_place()
  where place_key in ('entrenamiento', 'competencia', 'externo', 'sin_dato')$q$, 4, 'by_place devuelve las 4 claves');
select pg_temp.expect_count($q$select 1 from public.dash_injuries_by_place() where place_key = 'externo' and injuries_count = 0$q$, 1, 'externo parte en 0');
select pg_temp.back();
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');   -- A1 reporta una lesión externa
select pg_temp.expect_ok($q$insert into storage.objects (bucket_id, name) values ('medical-docs', 'aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/dash.pdf')$q$, 'A1 sube su archivo');
select pg_temp.expect_ok($q$select public.report_injury('Golpe fuera del club', current_date - 60, 2, 'semanas', null,
  '[{"path":"aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/dash.pdf","name":"dash.pdf"}]'::jsonb, 'externo')$q$, 'A1 reporta una lesión externa');
select pg_temp.back();
insert into public.injuries (club_id, player_id, type, severity, status, started_on, occurred_during, expected_return_on) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000013', 'Sobrecarga',      null,   'activa',  current_date - 60,                          null,      null),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000013', 'Esguince antiguo', 'leve', 'cerrada', (current_date - interval '13 months')::date, 'externo', null);
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.dash_injuries_by_place()
  where (place_key, injuries_count) in (('entrenamiento', 3), ('competencia', 2), ('externo', 1), ('sin_dato', 1))$q$, 4,
  'by_place: externo suma el reporte, null va a sin_dato y la de hace 13 meses no cuenta');
select pg_temp.back();

-- 9.6 Recurrentes: 2+ lesiones no descartadas en 12 meses
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.dash_recurring_players()
  where player_id = 'a1000000-1111-0000-0000-000000000012' and injuries_count = 2 and last_injury_on = current_date$q$, 1, 'D2 aparece con 2 lesiones');
select pg_temp.expect_count($q$select 1 from public.dash_recurring_players() where player_id = 'a1000000-1111-0000-0000-000000000011'$q$, 0, 'D1 con 1 lesión no aparece');
select pg_temp.expect_count($q$select 1 from public.dash_recurring_players() where player_id = 'a1000000-1111-0000-0000-000000000013'$q$, 0, 'D3 no aparece: su segunda lesión es de hace 13 meses');
select pg_temp.expect_count($q$select 1 from public.dash_recurring_players()$q$, 1, 'solo D2 es recurrente');
select pg_temp.back();

-- 9.7 Próximas altas (D5): activas hasta hoy + 30, vencidas primero
insert into public.injuries (club_id, player_id, type, severity, status, started_on, occurred_during, expected_return_on) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000015', 'Fractura', 'grave', 'activa',        current_date - 60, null, current_date + 10),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000015', 'Luxación', 'grave', 'activa',        current_date - 60, null, current_date - 3),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000015', 'Rotura',   'grave', 'activa',        current_date - 60, null, current_date + 45),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000015', 'Golpe',    null,    'en_evaluacion', current_date - 60, null, current_date + 5),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000015', 'Esguince', 'leve',  'cerrada',       current_date - 60, null, current_date + 5);
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.dash_upcoming_returns()
  where player_id = 'a1000000-1111-0000-0000-000000000015' and return_on = current_date + 10 and days_left = 10$q$, 1, 'la activa a 10 días aparece con days_left = 10');
select pg_temp.expect_count($q$select 1 from public.dash_upcoming_returns()
  where player_id = 'a1000000-1111-0000-0000-000000000015' and return_on = current_date - 3 and days_left = -3$q$, 1, 'la vencida aparece con days_left = -3');
select pg_temp.expect_count($q$select 1 from (select days_left, row_number() over () as n from public.dash_upcoming_returns()) t
  where (n = 1 and days_left = -3) or (n = 2 and days_left = 10)$q$, 2, 'la vencida va antes que la próxima');
select pg_temp.expect_count($q$select 1 from public.dash_upcoming_returns() where days_left = 45$q$, 0, 'la de 45 días no aparece');
select pg_temp.expect_count($q$select 1 from public.dash_upcoming_returns()$q$, 2, 'en evaluación, cerrada, sin fecha o a más de 30 días no aparecen');
select pg_temp.back();

-- 9.8 Serie de disponibilidad (D6). Las filas de historial escritas dentro de esta
-- transacción tienen changed_at > now() (inicio de la transacción) y no entran en ningún
-- corte, así que solo cuentan las filas con fechas pasadas que se fijan aquí.
-- La fila inicial de D6 (null → disponible) pasa a ser de hace 20 días.
update public.availability_log set changed_at = now() - interval '20 days'
 where player_id = 'a1000000-1111-0000-0000-000000000016';
insert into public.availability_log (club_id, player_id, from_status, to_status, changed_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000016', 'disponible', 'lesionado',  now() - interval '10 days'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000016', 'lesionado',  'disponible', now() - interval '3 days');
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.dash_availability_series(4)$q$, 4, 'dash_availability_series(4) devuelve 4 filas');
select pg_temp.expect_count($q$select 1 from public.dash_availability_series(4)
  where week_start = date_trunc('week', current_date::timestamp)::date
    and disponible = 1 and en_revision = 0 and lesionado = 0 and reintegro = 0$q$, 1, 'la semana actual refleja el último estado (disponible)');
-- La semana que cierra entre hace 10 y hace 3 días lo muestra lesionado; es la única.
select pg_temp.expect_count($q$select 1 from public.dash_availability_series(4)
  where week_start = date_trunc('week', now() - interval '3 days')::date - 7 and lesionado = 1 and disponible = 0$q$, 1, 'la semana anterior al alta lo muestra lesionado');
select pg_temp.expect_count($q$select 1 from public.dash_availability_series(4) where lesionado = 1$q$, 1, 'solo una semana lo muestra lesionado');
-- La semana que cierra entre hace 20 y hace 10 días lo muestra disponible.
select pg_temp.expect_count($q$select 1 from public.dash_availability_series(4)
  where week_start = date_trunc('week', now() - interval '10 days')::date - 7 and disponible = 1 and lesionado = 0$q$, 1, 'antes de lesionarse aparece disponible');
-- Antes de su primera fila no cuenta en ningún estado.
select pg_temp.expect_count($q$select 1 from public.dash_availability_series(5)
  where week_start = date_trunc('week', current_date::timestamp)::date - 28
    and disponible + en_revision + lesionado + reintegro = 0$q$, 1, 'antes de su primera fila no cuenta');
select pg_temp.back();

rollback;
