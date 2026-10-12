-- Recov · Test de aislamiento entre clubes y de permisos por rol
-- Correr en el SQL Editor de Supabase DESPUÉS de las migraciones 0001 a 0016.
-- Todo ocurre dentro de una transacción que termina en ROLLBACK: no deja datos.
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

-- Datos de prueba (como postgres) ---------------------------------------
-- Club A (rugby) y Club B (hockey)
insert into public.clubs (id, name, sport, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Club A', 'rugby',  'club-a'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Club B', 'hockey', 'club-b');

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-00000000000a', 'hc-a@test.cl'),
  ('20000000-0000-0000-0000-00000000000a', 'manager-a@test.cl'),
  ('30000000-0000-0000-0000-00000000000a', 'kine-a@test.cl'),
  ('40000000-0000-0000-0000-00000000000a', 'coach-a@test.cl'),
  ('50000000-0000-0000-0000-00000000000a', 'nutri-a@test.cl'),
  ('60000000-0000-0000-0000-00000000000a', 'jugador-a1@test.cl'),
  ('70000000-0000-0000-0000-00000000000a', 'jugador-pendiente-a@test.cl'),
  ('80000000-0000-0000-0000-00000000000a', 'staff-pendiente-a@test.cl'),
  ('30000000-0000-0000-0000-00000000000b', 'kine-b@test.cl'),
  ('60000000-0000-0000-0000-00000000000b', 'jugador-b1@test.cl'),
  ('c0000000-0000-0000-0000-00000000000a', 'nuevo-jugador@test.cl'),
  ('d0000000-0000-0000-0000-00000000000a', 'nuevo-staff@test.cl'),
  ('e0000000-0000-0000-0000-00000000000a', 'nuevo-malo@test.cl');

insert into public.profiles (id, club_id, roles, full_name, status, requested_role) values
  ('10000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{head_coach}',    'Head Coach A',   'confirmado', null),
  ('20000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{manager}',       'Manager A',      'confirmado', null),
  ('30000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{kinesiologo}',   'Kine A',         'confirmado', null),
  ('40000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{entrenador}',    'Entrenador A',   'confirmado', null),
  ('50000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{nutricionista}', 'Nutri A',        'confirmado', null),
  ('60000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{jugador}',       'Jugador A1',     'confirmado', null),
  ('70000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{jugador}',       'Jugador Pend A', 'pendiente',  null),
  ('80000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{}',              'Staff Pend A',   'pendiente',  'nutricionista'),
  ('30000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', '{kinesiologo}',   'Kine B',         'confirmado', null),
  ('60000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', '{jugador}',       'Jugador B1',     'confirmado', null);

insert into public.players (id, club_id, full_name, first_name, last_name, position, status, user_id) values
  ('a1000000-1111-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Jugador A1',    'Jugador', 'A1',   'Pilar',   'confirmado', '60000000-0000-0000-0000-00000000000a'),
  ('a1000000-1111-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Jugador A2',    'Jugador', 'A2',   'Hooker',  'confirmado', null),
  ('a1000000-1111-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Jugador Pend',  'Jugador', 'Pend', 'Apertura','pendiente',  '70000000-0000-0000-0000-00000000000a'),
  ('b1000000-1111-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Jugador B1',    'Jugador', 'B1',   'Portero', 'confirmado', '60000000-0000-0000-0000-00000000000b');

insert into public.injuries (id, club_id, player_id, type, severity) values
  ('a2000000-2222-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000001', 'Esguince', 'leve'),
  ('b2000000-2222-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'b1000000-1111-0000-0000-000000000001', 'Esguince', 'leve');

insert into public.injury_phases (club_id, injury_id, name, position) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a2000000-2222-0000-0000-000000000001', 'Reposo', 1);

insert into public.documents (club_id, player_id, storage_path, file_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000002/informe.pdf', 'informe.pdf'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b1000000-1111-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000002/b1000000-1111-0000-0000-000000000001/informe.pdf', 'informe.pdf');

-- archivo existente de otro jugador (para probar que no se puede referenciar)
insert into storage.objects (bucket_id, name) values ('medical-docs', 'aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000002/ajeno.pdf');

-- =======================================================================
-- 1. Kinesiólogo A: ve su club, no el B, y puede registrar lesiones
-- =======================================================================
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');

select pg_temp.expect_count($q$select 1 from public.players$q$, 2, 'kine A ve el plantel confirmado (2), sin pendientes ni del club B');
select pg_temp.expect_count($q$select 1 from public.players where club_id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$, 0, 'kine A no ve jugadores del club B');
select pg_temp.expect_count($q$select 1 from public.injuries where club_id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$, 0, 'kine A no ve lesiones del club B');
select pg_temp.expect_count($q$select 1 from public.documents where club_id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$, 0, 'kine A no ve documentos del club B');
select pg_temp.expect_count($q$select 1 from public.profiles where club_id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$, 0, 'kine A no ve perfiles del club B');
select pg_temp.expect_count($q$select 1 from public.clubs$q$, 1, 'kine A ve solo su club');
select pg_temp.expect_count($q$select 1 from public.documents where club_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 1, 'kine A ve los documentos de su club');

select pg_temp.expect_fail($q$insert into public.injuries (club_id, player_id, type, severity)
  values ('bbbbbbbb-0000-0000-0000-000000000002', 'b1000000-1111-0000-0000-000000000001', 'x', 'leve')$q$,
  'kine A registra lesión en el club B');
select pg_temp.expect_fail($q$insert into public.injuries (club_id, player_id, type, severity)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'b1000000-1111-0000-0000-000000000001', 'x', 'leve')$q$,
  'kine A cruza una lesión de A con un jugador de B');
select pg_temp.expect_ok($q$insert into public.injuries (club_id, player_id, type, severity)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000002', 'Rotura fibrilar', 'moderada')$q$,
  'kine A registra una lesión en su club');
select pg_temp.expect_ok($q$update public.players set availability = 'reintegro' where id = 'a1000000-1111-0000-0000-000000000002'$q$,
  'kine A actualiza disponibilidad');
select pg_temp.expect_no_rows($q$update public.players set status = 'rechazado' where id = 'a1000000-1111-0000-0000-000000000002'$q$,
  'kine A cambia el estado de validación de un jugador');
select pg_temp.expect_fail($q$select public.review_member('70000000-0000-0000-0000-00000000000a', 'confirmar')$q$,
  'kine A confirma un registro');
select pg_temp.expect_fail($q$select public.set_kine_delegate('40000000-0000-0000-0000-00000000000a')$q$,
  'kine A delega funciones de kinesiólogo');

select pg_temp.back();

-- =======================================================================
-- 2. Entrenador y nutricionista: solo ven dashboard y lesiones
-- =======================================================================
select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.players$q$, 2, 'entrenador A ve el plantel confirmado');
select pg_temp.expect_count($q$select 1 from public.injuries where club_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 2, 'entrenador A ve las lesiones de su club');
select pg_temp.expect_count($q$select 1 from public.injury_phases$q$, 1, 'entrenador A ve las fases de su club');
select pg_temp.expect_count($q$select 1 from public.documents$q$, 0, 'entrenador A no ve documentos médicos');
select pg_temp.expect_fail($q$insert into public.injuries (club_id, player_id, type, severity)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000002', 'x', 'leve')$q$,
  'entrenador A registra una lesión');
select pg_temp.expect_no_rows($q$update public.players set availability = 'lesionado'$q$, 'entrenador A cambia disponibilidad');
select pg_temp.back();

select pg_temp.as_user('50000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.players$q$, 2, 'nutricionista A ve el plantel confirmado');
select pg_temp.expect_count($q$select 1 from public.injuries where club_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 2, 'nutricionista A ve lesiones');
select pg_temp.expect_count($q$select 1 from public.documents$q$, 0, 'nutricionista A no ve documentos médicos');
select pg_temp.expect_fail($q$insert into public.injuries (club_id, player_id, type, severity)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000002', 'x', 'leve')$q$,
  'nutricionista A registra una lesión');
select pg_temp.back();

-- =======================================================================
-- 3. Head coach: ve pendientes, lesiones y documentos; no escribe directo
-- =======================================================================
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.players$q$, 3, 'head coach A ve el plantel y al pendiente');
select pg_temp.expect_count($q$select 1 from public.profiles where status = 'pendiente'$q$, 2, 'head coach A ve los 2 perfiles pendientes');
select pg_temp.expect_count($q$select 1 from public.injuries where club_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 2, 'head coach A ve lesiones');
select pg_temp.expect_count($q$select 1 from public.documents$q$, 1, 'head coach A ve los documentos médicos');
select pg_temp.expect_no_rows($q$update public.profiles set roles = '{head_coach}' where id = '40000000-0000-0000-0000-00000000000a'$q$,
  'head coach A modifica perfiles directamente');
select pg_temp.expect_no_rows($q$update public.clubs set kine_delegate_id = '40000000-0000-0000-0000-00000000000a'$q$,
  'head coach A modifica el club directamente');
select pg_temp.expect_fail($q$select public.review_member('10000000-0000-0000-0000-00000000000a', 'confirmar')$q$,
  'head coach A se revisa a sí mismo');
select pg_temp.expect_fail($q$select public.review_member('30000000-0000-0000-0000-00000000000b', 'confirmar')$q$,
  'head coach A revisa un perfil del club B');
select pg_temp.back();

-- =======================================================================
-- 4. Delegación de las funciones de kinesiólogo
-- =======================================================================
select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$insert into public.injuries (club_id, player_id, type, severity)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000002', 'x', 'leve')$q$,
  'entrenador sin delegación registra lesión');
select pg_temp.back();

select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select public.set_kine_delegate('60000000-0000-0000-0000-00000000000a')$q$,
  'delegar en un jugador');
select pg_temp.expect_fail($q$select public.set_kine_delegate('30000000-0000-0000-0000-00000000000b')$q$,
  'delegar en alguien de otro club');
select pg_temp.expect_ok($q$select public.set_kine_delegate('40000000-0000-0000-0000-00000000000a')$q$,
  'head coach delega en el entrenador');
select pg_temp.back();

select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$insert into public.injuries (club_id, player_id, type, severity)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000002', 'Contractura', 'leve')$q$,
  'el delegado registra lesión');
select pg_temp.expect_count($q$select 1 from public.documents where club_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 1,
  'el delegado ve los documentos');
select pg_temp.back();

select pg_temp.as_user('20000000-0000-0000-0000-00000000000a');   -- el manager también puede quitar la delegación
select pg_temp.expect_ok($q$select public.set_kine_delegate(null)$q$, 'manager quita la delegación');
select pg_temp.back();

select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$insert into public.injuries (club_id, player_id, type, severity)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000002', 'y', 'leve')$q$,
  'sin delegación, el entrenador vuelve a no poder registrar lesiones');
select pg_temp.back();

-- =======================================================================
-- 5. Usuarios pendientes: no ven datos del club
-- =======================================================================
select pg_temp.as_user('70000000-0000-0000-0000-00000000000a');   -- jugador pendiente
select pg_temp.expect_count($q$select 1 from public.players$q$, 0, 'jugador pendiente ve plantel');
select pg_temp.expect_count($q$select 1 from public.injuries$q$, 0, 'jugador pendiente ve lesiones');
select pg_temp.expect_count($q$select 1 from public.profiles$q$, 1, 'jugador pendiente ve solo su propio perfil');
select pg_temp.expect_count($q$select 1 from public.clubs$q$, 1, 'jugador pendiente ve el nombre de su club');
select pg_temp.expect_fail($q$insert into public.documents (club_id, player_id, storage_path, file_name, uploaded_by)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000003', 'x/y/z.pdf', 'z.pdf', '70000000-0000-0000-0000-00000000000a')$q$,
  'jugador pendiente sube documentos');
select pg_temp.back();

select pg_temp.as_user('80000000-0000-0000-0000-00000000000a');   -- staff pendiente
select pg_temp.expect_count($q$select 1 from public.players$q$, 0, 'staff pendiente ve plantel');
select pg_temp.expect_count($q$select 1 from public.injuries$q$, 0, 'staff pendiente ve lesiones');
select pg_temp.back();

-- =======================================================================
-- 6. Validación: la dirección confirma y los usuarios ganan acceso
-- =======================================================================
select pg_temp.as_user('20000000-0000-0000-0000-00000000000a');   -- manager
select pg_temp.expect_ok($q$select public.review_member('70000000-0000-0000-0000-00000000000a', 'confirmar')$q$, 'manager confirma al jugador pendiente');
select pg_temp.expect_ok($q$select public.review_member('80000000-0000-0000-0000-00000000000a', 'confirmar')$q$, 'manager confirma al staff pendiente con su puesto');
select pg_temp.expect_fail($q$select public.review_member('80000000-0000-0000-0000-00000000000a', 'confirmar')$q$, 'revisar dos veces el mismo perfil');
select pg_temp.back();

select pg_temp.as_user('70000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.players$q$, 3, 'jugador recién confirmado ve el plantel');
select pg_temp.expect_count($q$select 1 from public.injuries$q$, 0, 'jugador recién confirmado sigue sin ver lesiones');
select pg_temp.back();

select pg_temp.as_user('80000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.injuries where club_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 3, 'staff recién confirmado ve lesiones');
select pg_temp.back();

select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.set_staff_roles('80000000-0000-0000-0000-00000000000a', array['preparador_fisico']::public.user_role[])$q$, 'head coach cambia el rol de un staff');
select pg_temp.expect_fail($q$select public.set_staff_roles('60000000-0000-0000-0000-00000000000a', array['entrenador']::public.user_role[])$q$, 'dar rol de staff a un jugador');
select pg_temp.expect_ok($q$select public.set_staff_roles('80000000-0000-0000-0000-00000000000a', array[]::public.user_role[])$q$, 'head coach quita a alguien del staff');
select pg_temp.back();

select pg_temp.as_user('80000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.injuries$q$, 0, 'staff removido ya no ve lesiones');
select pg_temp.back();

-- =======================================================================
-- 7. Jugador confirmado: registra su lesión, ve solo lo suyo
-- =======================================================================
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.players$q$, 3, 'jugador A1 ve el plantel');
select pg_temp.expect_count($q$select 1 from public.injuries$q$, 1, 'jugador A1 ve solo su lesión');
select pg_temp.expect_count($q$select 1 from public.injury_phases$q$, 1, 'jugador A1 ve solo las fases de su propia lesión');
select pg_temp.expect_count($q$select 1 from public.documents$q$, 0, 'jugador A1 no ve documentos ajenos');
-- no puede insertar documentos directo (solo vía report_injury)
select pg_temp.expect_fail($q$insert into public.documents (club_id, player_id, storage_path, file_name, uploaded_by)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/directo.pdf', 'directo.pdf', '60000000-0000-0000-0000-00000000000a')$q$,
  'jugador A1 inserta documentos directo');
-- sube el archivo y registra la lesión
select pg_temp.expect_ok($q$insert into storage.objects (bucket_id, name) values ('medical-docs', 'aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/mio.pdf')$q$,
  'jugador A1 sube su archivo');
-- archivo que no existe en storage
select pg_temp.expect_fail($q$select public.report_injury('Esguince', current_date - 2, 6, 'semanas', null,
  '[{"path":"aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/noexiste.pdf","name":"x.pdf"}]'::jsonb)$q$, 'reporta con archivo inexistente');
-- ruta de otro jugador
select pg_temp.expect_fail($q$select public.report_injury('Esguince', current_date - 2, 6, 'semanas', null,
  '[{"path":"aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000002/ajeno.pdf","name":"x.pdf"}]'::jsonb)$q$, 'reporta con ruta de otro jugador');
-- duración inválida y fecha futura
select pg_temp.expect_fail($q$select public.report_injury('Esguince', current_date - 2, 0, 'semanas', null,
  '[{"path":"aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/mio.pdf","name":"mio.pdf"}]'::jsonb)$q$, 'reporta duración 0');
select pg_temp.expect_fail($q$select public.report_injury('Esguince', current_date - 2, 3, 'años', null,
  '[{"path":"aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/mio.pdf","name":"mio.pdf"}]'::jsonb)$q$, 'reporta unidad inválida');
select pg_temp.expect_fail($q$select public.report_injury('Esguince', current_date + 5, 3, 'semanas', null,
  '[{"path":"aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/mio.pdf","name":"mio.pdf"}]'::jsonb)$q$, 'reporta fecha futura');
-- el reporte válido
select pg_temp.expect_ok($q$select public.report_injury('Esguince de tobillo', current_date - 2, 8, 'semanas', 'Me torcí en el entrenamiento',
  '[{"path":"aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/mio.pdf","name":"mio.pdf"}]'::jsonb)$q$, 'jugador A1 registra su lesión');
select pg_temp.expect_count($q$select 1 from public.injuries$q$, 2, 'jugador A1 ve su lesión nueva');
select pg_temp.expect_count($q$select 1 from public.injuries where reported_by_player and severity is null
  and expected_return_on = current_date - 2 + 56 and doctor_estimate_value = 8 and doctor_estimate_unit = 'semanas'$q$, 1,
  'la lesión queda con la fecha estimada y lo que dijo el médico');
select pg_temp.expect_count($q$select 1 from public.documents$q$, 1, 'jugador A1 ve su documento');
select pg_temp.expect_count($q$select 1 from public.documents where injury_id is not null and status = 'borrador'$q$, 1,
  'el documento queda ligado a la lesión y en borrador');
-- no se puede escribir directo
select pg_temp.expect_no_rows($q$update public.injuries set expected_return_on = current_date$q$, 'jugador A1 edita su lesión');
select pg_temp.expect_no_rows($q$update public.injury_phases set name = 'x'$q$, 'jugador A1 edita fases');
select pg_temp.expect_count($q$select 1 from public.injuries where reported_by_player$q$, 1, 'una sola lesión reportada y sin fases generadas');
select pg_temp.expect_count($q$select 1 from public.injury_phases where name <> 'Reposo'$q$, 0, 'no se generan fases automáticas');
select pg_temp.expect_fail($q$insert into public.injuries (club_id, player_id, type, severity)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000001', 'x', 'leve')$q$,
  'jugador A1 registra una lesión');
select pg_temp.expect_no_rows($q$update public.players set availability = 'lesionado'$q$, 'jugador A1 cambia disponibilidad');
select pg_temp.expect_no_rows($q$update public.documents set status = 'revisado'$q$, 'jugador A1 modifica documentos');
select pg_temp.expect_fail($q$select public.review_member('80000000-0000-0000-0000-00000000000a', 'confirmar')$q$, 'jugador A1 confirma registros');
select pg_temp.back();

select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
select pg_temp.expect_count($q$select 1 from public.players$q$, 1, 'jugador B1 ve solo el plantel de su club');
select pg_temp.expect_fail($q$insert into public.documents (club_id, player_id, storage_path, file_name, uploaded_by)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000001', 'a/b/z.pdf', 'z.pdf', '60000000-0000-0000-0000-00000000000b')$q$,
  'jugador B1 sube documentos al club A');
select pg_temp.back();

-- =======================================================================
-- 8. Registro desde el link del club
-- =======================================================================
select pg_temp.as_anon();
select pg_temp.expect_count($q$select * from public.club_public_info('club-a')$q$, 1, 'el link del club muestra su nombre sin sesión');
select pg_temp.expect_count($q$select * from public.club_public_info('no-existe')$q$, 0, 'un link inexistente no devuelve nada');
select pg_temp.expect_count($q$select 1 from public.positions where sport = 'rugby'$q$, 10, 'las posiciones de rugby son públicas');
select pg_temp.expect_fail($q$select public.register_member('club-a', 'jugador', 'A', 'B', 'Pilar')$q$, 'anónimo se registra sin cuenta');
select pg_temp.expect_fail($q$select 1 from public.players$q$, 'anónimo lee players');
select pg_temp.expect_fail($q$select 1 from public.profiles$q$, 'anónimo lee profiles');
select pg_temp.back();

select pg_temp.as_user('c0000000-0000-0000-0000-00000000000a');   -- cuenta nueva sin perfil
select pg_temp.expect_fail($q$select public.register_member('club-a', 'jugador', 'Juan', 'Pérez', 'Portero')$q$, 'posición de otro deporte');
select pg_temp.expect_fail($q$select public.register_member('club-a', 'jugador', 'Juan', 'Pérez', null)$q$, 'posición principal obligatoria');
select pg_temp.expect_fail($q$select public.register_member('club-a', 'jugador', 'Juan', 'Pérez', 'Pilar', 'Pilar')$q$, 'posición secundaria igual a la principal');
select pg_temp.expect_fail($q$select public.register_member('club-a', 'jugador', '', 'Pérez', 'Pilar')$q$, 'nombre vacío');
select pg_temp.expect_fail($q$select public.register_member('no-existe', 'jugador', 'Juan', 'Pérez', 'Pilar')$q$, 'club inexistente');
select pg_temp.expect_fail($q$select public.register_member('club-a', 'jugador', 'Juan', 'Pérez', 'Pilar', null, 20, 90)$q$, 'estatura fuera de rango');
select pg_temp.expect_ok($q$select public.register_member('club-a', 'jugador', 'Juan', 'Pérez', 'Pilar', 'Hooker', 185, 95.5)$q$, 'registro válido de jugador');
select pg_temp.expect_fail($q$select public.register_member('club-a', 'jugador', 'Juan', 'Pérez', 'Pilar')$q$, 'registrarse dos veces');
select pg_temp.expect_count($q$select 1 from public.profiles$q$, 1, 'el nuevo jugador ve solo su perfil');
select pg_temp.expect_count($q$select 1 from public.players$q$, 0, 'el nuevo jugador no ve el plantel hasta ser confirmado');
select pg_temp.back();

select pg_temp.as_user('d0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select public.register_member('club-a', 'staff', 'Ana', 'Soto', null, null, null, null, 'jugador')$q$, 'staff pide el puesto de jugador');
select pg_temp.expect_fail($q$select public.register_member('club-a', 'staff', 'Ana', 'Soto', null, null, null, null, 'head_coach')$q$, 'staff se auto-asigna head coach');
select pg_temp.expect_fail($q$select public.register_member('club-a', 'staff', 'Ana', 'Soto')$q$, 'staff sin puesto');
select pg_temp.expect_ok($q$select public.register_member('club-a', 'staff', 'Ana', 'Soto', null, null, null, null, 'kinesiologo')$q$, 'registro válido de staff');
select pg_temp.expect_count($q$select 1 from public.injuries$q$, 0, 'el staff nuevo no ve lesiones hasta ser confirmado');
select pg_temp.back();

select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.players where status = 'pendiente'$q$, 1, 'la dirección ve al jugador nuevo en pendientes');
select pg_temp.expect_ok($q$select public.review_member('d0000000-0000-0000-0000-00000000000a', 'rechazar')$q$, 'la dirección rechaza un registro');
select pg_temp.back();

select pg_temp.as_user('d0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.injuries$q$, 0, 'el rechazado no ve datos');
select pg_temp.expect_count($q$select 1 from public.players$q$, 0, 'el rechazado no ve el plantel');
select pg_temp.back();

-- =======================================================================
-- 9. Storage
-- =======================================================================
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$insert into storage.objects (bucket_id, name)
  values ('medical-docs', 'aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/segundo.pdf')$q$,
  'jugador A1 sube a su propia carpeta');
select pg_temp.expect_fail($q$insert into storage.objects (bucket_id, name)
  values ('medical-docs', 'aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000002/ajeno.pdf')$q$,
  'jugador A1 sube a la carpeta de otro jugador');
select pg_temp.expect_count($q$select 1 from storage.objects where bucket_id = 'medical-docs'$q$, 2, 'jugador A1 ve solo sus archivos');
select pg_temp.back();

select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from storage.objects where bucket_id = 'medical-docs'$q$, 3, 'kine A ve los archivos de su club');
select pg_temp.back();

select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from storage.objects where bucket_id = 'medical-docs'$q$, 0, 'entrenador A no ve archivos médicos');
select pg_temp.back();

select pg_temp.as_user('30000000-0000-0000-0000-00000000000b');
select pg_temp.expect_count($q$select 1 from storage.objects where bucket_id = 'medical-docs'$q$, 0, 'kine B no ve archivos del club A');
select pg_temp.back();

-- =======================================================================
-- 10. Kinesiólogo revisa la lesión reportada; staff sin permisos no la edita
-- =======================================================================
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.injuries where reported_by_player$q$, 1, 'kine A ve la lesión reportada');
select pg_temp.expect_ok($q$update public.injuries set severity = 'moderada', expected_return_on = expected_return_on + 7,
  reviewed_by = '30000000-0000-0000-0000-00000000000a', reviewed_at = now() where reported_by_player$q$, 'kine A revisa y mueve la fecha');
select pg_temp.expect_count($q$select 1 from public.injuries where reported_by_player and doctor_estimate_value = 8$q$, 1,
  'lo que dijo el médico se conserva');
select pg_temp.back();

select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.injuries where reported_by_player$q$, 1, 'entrenador A ve la lesión reportada');
select pg_temp.expect_no_rows($q$update public.injuries set severity = 'grave' where reported_by_player$q$, 'entrenador A edita la lesión');
select pg_temp.back();

select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
select pg_temp.expect_count($q$select 1 from public.injuries$q$, 1, 'jugador B1 solo ve su lesión, no la del club A');
select pg_temp.back();

-- =======================================================================
-- 11. Foto de perfil (0007)
-- =======================================================================
-- jugador confirmado: sube su foto y la fija en su perfil
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$insert into storage.objects (bucket_id, name)
  values ('avatars', 'aaaaaaaa-0000-0000-0000-000000000001/60000000-0000-0000-0000-00000000000a/foto.jpg')$q$, 'jugador A1 sube su foto');
select pg_temp.expect_fail($q$insert into storage.objects (bucket_id, name)
  values ('avatars', 'aaaaaaaa-0000-0000-0000-000000000001/40000000-0000-0000-0000-00000000000a/foto.jpg')$q$, 'jugador A1 sube a la carpeta de otro');
select pg_temp.expect_fail($q$insert into storage.objects (bucket_id, name)
  values ('avatars', 'bbbbbbbb-0000-0000-0000-000000000002/60000000-0000-0000-0000-00000000000a/foto.jpg')$q$, 'jugador A1 sube en la carpeta del club B');
select pg_temp.expect_fail($q$select public.set_my_avatar('aaaaaaaa-0000-0000-0000-000000000001/60000000-0000-0000-0000-00000000000a/no-existe.jpg')$q$, 'fijar una foto que no se subió');
select pg_temp.expect_fail($q$select public.set_my_avatar('aaaaaaaa-0000-0000-0000-000000000001/40000000-0000-0000-0000-00000000000a/foto.jpg')$q$, 'fijar la ruta de otro');
select pg_temp.expect_ok($q$select public.set_my_avatar('aaaaaaaa-0000-0000-0000-000000000001/60000000-0000-0000-0000-00000000000a/foto.jpg')$q$, 'jugador A1 fija su foto');
select pg_temp.expect_no_rows($q$update public.profiles set avatar_path = null where id = '40000000-0000-0000-0000-00000000000a'$q$, 'no se edita el perfil de otro directo');
select pg_temp.back();

-- usuario pendiente: puede poner foto durante el registro
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$insert into storage.objects (bucket_id, name)
  values ('avatars', 'aaaaaaaa-0000-0000-0000-000000000001/c0000000-0000-0000-0000-00000000000a/foto.jpg')$q$, 'jugador pendiente sube su foto');
select pg_temp.expect_ok($q$select public.set_my_avatar('aaaaaaaa-0000-0000-0000-000000000001/c0000000-0000-0000-0000-00000000000a/foto.jpg')$q$, 'jugador pendiente fija su foto');
select pg_temp.expect_count($q$select 1 from storage.objects where bucket_id = 'avatars'$q$, 1, 'el pendiente ve solo su foto');
select pg_temp.back();

-- quién ve las fotos
select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.profiles where avatar_path is not null$q$, 1, 'entrenador A ve la foto del confirmado');
select pg_temp.expect_count($q$select 1 from storage.objects where bucket_id = 'avatars'$q$, 1, 'entrenador A no ve la foto del pendiente');
select pg_temp.expect_no_rows($q$delete from storage.objects where bucket_id = 'avatars'$q$, 'entrenador A borra fotos ajenas');
select pg_temp.back();

select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from storage.objects where bucket_id = 'avatars'$q$, 2, 'la dirección ve también la foto del pendiente');
select pg_temp.back();

select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
select pg_temp.expect_count($q$select 1 from storage.objects where bucket_id = 'avatars'$q$, 0, 'jugador B1 no ve fotos del club A');
select pg_temp.expect_count($q$select 1 from public.profiles where avatar_path is not null$q$, 0, 'jugador B1 no ve rutas de fotos del club A');
select pg_temp.back();

select pg_temp.as_anon();
select pg_temp.expect_fail($q$select public.set_my_avatar(null)$q$, 'anónimo fija una foto');
select pg_temp.back();

-- =======================================================================
-- 12. Disponibilidad: kinesiólogo (o delegado) y head coach (0008)
-- =======================================================================
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');   -- head coach
select pg_temp.expect_ok($q$select public.set_player_availability('a1000000-1111-0000-0000-000000000002', 'lesionado')$q$, 'head coach cambia la disponibilidad');
select pg_temp.expect_count($q$select 1 from public.players where id = 'a1000000-1111-0000-0000-000000000002' and availability = 'lesionado'$q$, 1, 'la disponibilidad quedó cambiada');
select pg_temp.expect_fail($q$select public.set_player_availability('b1000000-1111-0000-0000-000000000001', 'lesionado')$q$, 'head coach cambia un jugador del club B');
select pg_temp.expect_fail($q$select public.set_player_availability('a1000000-1111-0000-0000-000000000002', null)$q$, 'disponibilidad vacía');
select pg_temp.expect_no_rows($q$update public.players set availability = 'disponible'$q$, 'head coach sigue sin editar players directo');
select pg_temp.back();

select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');   -- kine
select pg_temp.expect_ok($q$select public.set_player_availability('a1000000-1111-0000-0000-000000000002', 'reintegro')$q$, 'kine A cambia la disponibilidad');
select pg_temp.back();

select pg_temp.as_user('20000000-0000-0000-0000-00000000000a');   -- manager
select pg_temp.expect_fail($q$select public.set_player_availability('a1000000-1111-0000-0000-000000000002', 'disponible')$q$, 'manager cambia la disponibilidad');
select pg_temp.back();

select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');   -- entrenador sin delegación
select pg_temp.expect_fail($q$select public.set_player_availability('a1000000-1111-0000-0000-000000000002', 'disponible')$q$, 'entrenador cambia la disponibilidad');
select pg_temp.back();

select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');   -- jugador
select pg_temp.expect_fail($q$select public.set_player_availability('a1000000-1111-0000-0000-000000000001', 'disponible')$q$, 'jugador cambia su propia disponibilidad');
select pg_temp.back();

select pg_temp.as_user('30000000-0000-0000-0000-00000000000b');   -- kine B
select pg_temp.expect_fail($q$select public.set_player_availability('a1000000-1111-0000-0000-000000000002', 'disponible')$q$, 'kine B cambia un jugador del club A');
select pg_temp.back();

select pg_temp.as_anon();
select pg_temp.expect_fail($q$select public.set_player_availability('a1000000-1111-0000-0000-000000000002', 'disponible')$q$, 'anónimo cambia la disponibilidad');
select pg_temp.back();

-- =======================================================================
-- 13. Catálogo de deportes y validación de posición por trigger (0016)
-- =======================================================================
-- anon lee el catálogo y no puede modificarlo
select pg_temp.as_anon();
select pg_temp.expect_count($q$select 1 from public.sports$q$, 7, 'hay 7 deportes');
select pg_temp.expect_count($q$select 1 from public.positions$q$, 44, 'hay 44 posiciones en total');
select pg_temp.expect_count($q$select 1 from public.positions where sport = 'futbol'$q$, 8, 'fútbol tiene 8 posiciones');
select pg_temp.expect_count($q$select 1 from public.positions where sport = 'futsal'$q$, 4, 'futsal tiene 4 posiciones');
select pg_temp.expect_count($q$select 1 from public.positions where sport = 'rugby'$q$, 10, 'rugby tiene 10 posiciones');
select pg_temp.expect_count($q$select 1 from public.positions where sport = 'handball'$q$, 5, 'handball tiene 5 posiciones');
select pg_temp.expect_count($q$select 1 from public.positions where sport = 'voleibol'$q$, 5, 'vóleibol tiene 5 posiciones');
select pg_temp.expect_count($q$select 1 from public.positions where sport = 'basquetbol'$q$, 5, 'básquetbol tiene 5 posiciones');
select pg_temp.expect_count($q$select 1 from public.positions where sport = 'hockey'$q$, 7, 'hockey tiene 7 posiciones');
select pg_temp.expect_count($q$select 1 from public.positions where sport = 'rugby' and name = 'Flanker'$q$, 1, 'Flanker existe en rugby');
select pg_temp.expect_count($q$select 1 from public.positions where sport = 'rugby' and name = 'Ala'$q$, 0, 'Ala ya no existe en rugby');
select pg_temp.expect_fail($q$insert into public.sports (slug, name) values ('tenis', 'Tenis')$q$, 'anónimo inserta deportes');
select pg_temp.expect_fail($q$insert into public.positions (sport, name, sort) values ('rugby', 'Utility', 11)$q$, 'anónimo inserta posiciones');
select pg_temp.expect_fail($q$update public.positions set name = 'x' where sport = 'rugby'$q$, 'anónimo actualiza posiciones');
select pg_temp.expect_fail($q$update public.sports set name = 'x'$q$, 'anónimo actualiza deportes');
select pg_temp.expect_fail($q$delete from public.positions where sport = 'hockey'$q$, 'anónimo borra posiciones');
select pg_temp.expect_fail($q$delete from public.sports where slug = 'futbol'$q$, 'anónimo borra deportes');
select pg_temp.back();

-- INSERT directo (como postgres): el trigger valida aunque no pase por register_member
select pg_temp.expect_fail($q$insert into public.players (club_id, full_name, position, status)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'Inválido 1', 'Portero', 'confirmado')$q$, 'insert directo con posición de otro deporte');
select pg_temp.expect_fail($q$insert into public.players (club_id, full_name, position, secondary_position, status)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'Inválido 2', 'Pilar', 'Base', 'confirmado')$q$, 'insert directo con posición secundaria inválida');
select pg_temp.expect_ok($q$insert into public.players (club_id, full_name, position, status)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'Sin posición', null, 'confirmado')$q$, 'posición NULL sigue permitida');
select pg_temp.expect_ok($q$insert into public.players (club_id, full_name, position, secondary_position, status)
  values ('bbbbbbbb-0000-0000-0000-000000000002', 'Hockey válido', 'Defensa central', 'Portero', 'confirmado')$q$, 'posición válida del deporte del club');

-- UPDATE directo como kinesiólogo del club (players_update lo permite; el trigger valida)
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$update public.players set position = 'Portero' where id = 'a1000000-1111-0000-0000-000000000002'$q$,
  'kine A cambia la posición a una de otro deporte');
select pg_temp.expect_fail($q$update public.players set secondary_position = 'Base' where id = 'a1000000-1111-0000-0000-000000000002'$q$,
  'kine A pone una posición secundaria inválida');
select pg_temp.expect_ok($q$update public.players set position = 'Flanker' where id = 'a1000000-1111-0000-0000-000000000002'$q$,
  'kine A cambia a una posición válida de rugby');
select pg_temp.expect_count($q$select 1 from public.players where id = 'a1000000-1111-0000-0000-000000000002' and position = 'Flanker'$q$, 1,
  'la posición válida quedó guardada');
select pg_temp.back();

rollback;
