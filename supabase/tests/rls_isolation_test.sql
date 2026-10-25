-- Recov · Test de aislamiento entre clubes y de permisos por rol
-- Correr en el SQL Editor de Supabase DESPUÉS de las migraciones 0001 a 0040.
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
-- Desde 0039 insertar en profiles ya no crea la membresía: se crea aquí (preparación).
insert into public.club_members (user_id, club_id, roles, status, requested_role)
select id, club_id, roles, status, requested_role from public.profiles on conflict do nothing;

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
  '[{"path":"aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/noexiste.pdf","name":"x.pdf"}]'::jsonb, 'entrenamiento')$q$, 'reporta con archivo inexistente');
-- ruta de otro jugador
select pg_temp.expect_fail($q$select public.report_injury('Esguince', current_date - 2, 6, 'semanas', null,
  '[{"path":"aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000002/ajeno.pdf","name":"x.pdf"}]'::jsonb, 'entrenamiento')$q$, 'reporta con ruta de otro jugador');
-- duración inválida y fecha futura
select pg_temp.expect_fail($q$select public.report_injury('Esguince', current_date - 2, 0, 'semanas', null,
  '[{"path":"aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/mio.pdf","name":"mio.pdf"}]'::jsonb, 'entrenamiento')$q$, 'reporta duración 0');
select pg_temp.expect_fail($q$select public.report_injury('Esguince', current_date - 2, 3, 'años', null,
  '[{"path":"aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/mio.pdf","name":"mio.pdf"}]'::jsonb, 'entrenamiento')$q$, 'reporta unidad inválida');
select pg_temp.expect_fail($q$select public.report_injury('Esguince', current_date + 5, 3, 'semanas', null,
  '[{"path":"aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/mio.pdf","name":"mio.pdf"}]'::jsonb, 'entrenamiento')$q$, 'reporta fecha futura');
-- el reporte válido
select pg_temp.expect_ok($q$select public.report_injury('Esguince de tobillo', current_date - 2, 8, 'semanas', 'Me torcí en el entrenamiento',
  '[{"path":"aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/mio.pdf","name":"mio.pdf"}]'::jsonb, 'entrenamiento')$q$, 'jugador A1 registra su lesión');
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

-- =======================================================================
-- 14. El usuario edita su propio perfil (0017)
-- =======================================================================
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');   -- jugador A1 (rugby)
select pg_temp.expect_ok($q$select public.update_my_profile('Juana', 'Pérez Soto', 'Flanker', 'Octavo', 178, 80.5)$q$, 'jugador A1 edita su perfil');
select pg_temp.expect_count($q$select 1 from public.players where id = 'a1000000-1111-0000-0000-000000000001'
  and first_name = 'Juana' and last_name = 'Pérez Soto' and full_name = 'Juana Pérez Soto'
  and position = 'Flanker' and secondary_position = 'Octavo' and height_cm = 178 and weight_kg = 80.5$q$, 1, 'los datos del jugador quedaron guardados');
select pg_temp.expect_count($q$select 1 from public.profiles where id = '60000000-0000-0000-0000-00000000000a' and full_name = 'Juana Pérez Soto'$q$, 1, 'el nombre del perfil quedó guardado');
select pg_temp.expect_fail($q$select public.update_my_profile('Juana', 'Pérez', 'Portero')$q$, 'posición de otro deporte');
select pg_temp.expect_fail($q$select public.update_my_profile('Juana', 'Pérez', null)$q$, 'jugador sin posición principal');
select pg_temp.expect_fail($q$select public.update_my_profile('Juana', 'Pérez', 'Pilar', 'Pilar')$q$, 'secundaria igual a la principal');
select pg_temp.expect_fail($q$select public.update_my_profile('', 'Pérez', 'Pilar')$q$, 'nombre vacío');
select pg_temp.expect_fail($q$select public.update_my_profile('Juana', 'Pérez', 'Pilar', null, 20)$q$, 'altura fuera de rango');
select pg_temp.expect_fail($q$select public.update_my_profile('Juana', 'Pérez', 'Pilar', null, null, 500)$q$, 'peso fuera de rango');
select pg_temp.expect_no_rows($q$update public.profiles set full_name = 'x' where id = '60000000-0000-0000-0000-00000000000a'$q$, 'el jugador sigue sin editar profiles directo');
select pg_temp.back();

select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');   -- kine A (staff)
select pg_temp.expect_ok($q$select public.update_my_profile('Kine', 'Nuevo')$q$, 'el staff edita su nombre');
select pg_temp.expect_count($q$select 1 from public.profiles where id = '30000000-0000-0000-0000-00000000000a' and full_name = 'Kine Nuevo'$q$, 1, 'el nombre del staff quedó guardado');
select pg_temp.expect_count($q$select 1 from public.profiles where id = '60000000-0000-0000-0000-00000000000a' and full_name = 'Juana Pérez Soto'$q$, 1, 'editar el propio perfil no toca el de otros');
select pg_temp.back();

select pg_temp.as_user('c0000000-0000-0000-0000-00000000000a');   -- jugador pendiente
select pg_temp.expect_fail($q$select public.update_my_profile('Juan', 'Pérez', 'Pilar')$q$, 'un pendiente no edita su perfil');
select pg_temp.back();

select pg_temp.as_anon();
select pg_temp.expect_fail($q$select public.update_my_profile('A', 'B')$q$, 'anónimo edita un perfil');
select pg_temp.back();

-- =======================================================================
-- 15. report_injury con lugar obligatorio (0018)
-- =======================================================================
select pg_temp.as_anon();
select pg_temp.expect_fail($q$select public.report_injury('Esguince', current_date - 2, 6, 'semanas', null,
  '[{"path":"aaaaaaaa-0000-0000-0000-000000000001/a1000000-1111-0000-0000-000000000001/mio.pdf","name":"mio.pdf"}]'::jsonb, 'entrenamiento')$q$,
  'anónimo ejecuta report_injury (7 argumentos)');
select pg_temp.back();

-- =======================================================================
-- 16. availability_log: historial de disponibilidad (0019)
-- =======================================================================
-- Los fixtures insertan 3 jugadores en el club A y 1 en el B: cada uno deja al menos su fila inicial.
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');   -- kine A
select pg_temp.expect_count($q$select 1 where (select count(*) from public.availability_log where club_id = 'aaaaaaaa-0000-0000-0000-000000000001') >= 3
  and not exists (select 1 from public.availability_log where club_id <> 'aaaaaaaa-0000-0000-0000-000000000001')$q$, 1, 'kine A ve el historial del club A y nada del B');
select pg_temp.expect_fail($q$insert into public.availability_log (club_id, player_id, to_status)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000001', 'lesionado')$q$, 'kine A inserta en el historial');
select pg_temp.expect_fail($q$update public.availability_log set to_status = 'disponible'$q$, 'kine A edita el historial');
select pg_temp.expect_fail($q$delete from public.availability_log$q$, 'kine A borra el historial');
select pg_temp.expect_fail($q$select private.log_availability_change()$q$, 'authenticated ejecuta la función del trigger');
select pg_temp.back();

select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');   -- head coach A
select pg_temp.expect_count($q$select 1 where (select count(*) from public.availability_log where club_id = 'aaaaaaaa-0000-0000-0000-000000000001') >= 3
  and not exists (select 1 from public.availability_log where club_id <> 'aaaaaaaa-0000-0000-0000-000000000001')$q$, 1, 'head coach A ve el historial del club A y nada del B');
select pg_temp.back();

select pg_temp.as_user('20000000-0000-0000-0000-00000000000a');   -- manager A
select pg_temp.expect_count($q$select 1 where (select count(*) from public.availability_log where club_id = 'aaaaaaaa-0000-0000-0000-000000000001') >= 3
  and not exists (select 1 from public.availability_log where club_id <> 'aaaaaaaa-0000-0000-0000-000000000001')$q$, 1, 'manager A ve el historial del club A y nada del B');
select pg_temp.back();

select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');   -- entrenador A
select pg_temp.expect_count($q$select 1 where (select count(*) from public.availability_log where club_id = 'aaaaaaaa-0000-0000-0000-000000000001') >= 3
  and not exists (select 1 from public.availability_log where club_id <> 'aaaaaaaa-0000-0000-0000-000000000001')$q$, 1, 'entrenador A (staff) lee el historial del club A');
select pg_temp.back();

select pg_temp.as_user('30000000-0000-0000-0000-00000000000b');   -- kine B
select pg_temp.expect_count($q$select 1 from public.availability_log where club_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 0, 'staff del club B no ve el historial del club A');
select pg_temp.back();

select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');   -- jugador A1
select pg_temp.expect_count($q$select 1 from public.availability_log$q$, 0, 'el jugador no ve el historial');
select pg_temp.back();

select pg_temp.as_anon();
select pg_temp.expect_fail($q$select 1 from public.availability_log$q$, 'anónimo lee el historial');
select pg_temp.back();

-- =======================================================================
-- 17. Métricas del dashboard: funciones dash_* (0020)
-- =======================================================================
-- Las 7 funciones deben fallar para quien no es staff confirmado.
create function pg_temp.expect_dash_fail(who text) returns void language plpgsql as $$
begin
  perform pg_temp.expect_fail('select * from public.dash_summary()',              who || ' ejecuta dash_summary');
  perform pg_temp.expect_fail('select * from public.dash_availability_series()',  who || ' ejecuta dash_availability_series');
  perform pg_temp.expect_fail('select * from public.dash_injuries_by_week()',     who || ' ejecuta dash_injuries_by_week');
  perform pg_temp.expect_fail('select * from public.dash_injuries_by_place()',    who || ' ejecuta dash_injuries_by_place');
  perform pg_temp.expect_fail('select * from public.dash_injuries_by_position()', who || ' ejecuta dash_injuries_by_position');
  perform pg_temp.expect_fail('select * from public.dash_recurring_players()',     who || ' ejecuta dash_recurring_players');
  perform pg_temp.expect_fail('select * from public.dash_upcoming_returns()',      who || ' ejecuta dash_upcoming_returns');
end $$;

-- A esta altura del test, confirmados y activos: club A = A1, A2, A3 (confirmado en la
-- sección 6) y "Sin posición" (sección 13) = 4; club B = B1 y "Hockey válido" = 2.
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');   -- kine A
select pg_temp.expect_count($q$select 1 from public.dash_summary() where total = 4$q$, 1, 'kine A: dash_summary cuenta los 4 confirmados activos del club A');
select pg_temp.back();
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');   -- head coach A
select pg_temp.expect_count($q$select 1 from public.dash_summary() where total = 4$q$, 1, 'head coach A: dash_summary del club A');
select pg_temp.back();
select pg_temp.as_user('20000000-0000-0000-0000-00000000000a');   -- manager A
select pg_temp.expect_count($q$select 1 from public.dash_summary() where total = 4$q$, 1, 'manager A: dash_summary del club A');
select pg_temp.back();
select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');   -- entrenador A
select pg_temp.expect_count($q$select 1 from public.dash_summary() where total = 4$q$, 1, 'entrenador A: dash_summary del club A');
select pg_temp.back();

-- Sin acceso: jugador, staff pendiente, jugador pendiente, cuenta sin perfil y anónimo.
-- 8…a quedó sin roles en la sección 6: se vuelve a dejar pendiente con un puesto de staff.
-- Desde 0039 el estado se cambia en club_members (se refleja en profiles).
update public.club_members set status = 'pendiente', roles = '{nutricionista}' where user_id = '80000000-0000-0000-0000-00000000000a' and club_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
select pg_temp.expect_dash_fail('jugador A1');
select pg_temp.back();
select pg_temp.as_user('80000000-0000-0000-0000-00000000000a');
select pg_temp.expect_dash_fail('staff pendiente');
select pg_temp.back();
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_dash_fail('jugador pendiente');
select pg_temp.back();
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_dash_fail('cuenta sin perfil');
select pg_temp.back();
select pg_temp.as_anon();
select pg_temp.expect_dash_fail('anónimo');
select pg_temp.back();

-- Aislamiento: una lesión "externo" en el club A no aparece en los agregados del club B.
insert into public.injuries (club_id, player_id, type, severity, occurred_during) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-1111-0000-0000-000000000002', 'Golpe fuera del club', 'leve', 'externo');
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');   -- kine A (control: en A sí cuenta)
select pg_temp.expect_count($q$select 1 from public.dash_injuries_by_place() where place_key = 'externo' and injuries_count = 1$q$, 1, 'kine A ve la lesión externa en su club');
select pg_temp.back();
select pg_temp.as_user('30000000-0000-0000-0000-00000000000b');   -- kine B
select pg_temp.expect_count($q$select 1 from public.dash_summary() where total = 2$q$, 1, 'kine B: dash_summary cuenta los 2 confirmados activos del club B');
select pg_temp.expect_count($q$select 1 from public.dash_injuries_by_place() where place_key = 'externo' and injuries_count = 0$q$, 1, 'kine B no ve la lesión externa del club A');
select pg_temp.expect_count($q$select 1 from public.dash_injuries_by_place()$q$, 4, 'by_place de B devuelve las 4 claves');
select pg_temp.expect_count($q$select 1 from public.dash_injuries_by_position()
  where position_name in (select name from public.positions where sport = 'rugby')$q$, 0, 'by_position de B no trae posiciones de rugby');
select pg_temp.expect_count($q$select 1 from public.dash_recurring_players() where player_id::text like 'a1000000-%'$q$, 0, 'recurrentes de B no trae jugadores del club A');
select pg_temp.expect_count($q$select 1 from public.dash_upcoming_returns() where player_id::text like 'a1000000-%'$q$, 0, 'próximas altas de B no trae jugadores del club A');
select pg_temp.back();

-- Rango de semanas
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select * from public.dash_availability_series(0)$q$, 'dash_availability_series con 0 semanas');
select pg_temp.expect_fail($q$select * from public.dash_availability_series(53)$q$, 'dash_availability_series con 53 semanas');
select pg_temp.expect_fail($q$select * from public.dash_injuries_by_week(0)$q$, 'dash_injuries_by_week con 0 semanas');
select pg_temp.expect_fail($q$select * from public.dash_injuries_by_week(53)$q$, 'dash_injuries_by_week con 53 semanas');
select pg_temp.expect_count($q$select 1 from public.dash_availability_series(4)$q$, 4, 'dash_availability_series(4) devuelve 4 semanas');
select pg_temp.expect_count($q$select 1 from public.dash_injuries_by_week(4)$q$, 4, 'dash_injuries_by_week(4) devuelve 4 semanas');
select pg_temp.back();

-- Privilegios y search_path de las funciones
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'dash\_%'$q$, 7, 'existen las 7 funciones dash_*');
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'dash\_%' and p.proacl is null$q$, 0, 'ninguna dash_* usa los permisos por defecto (PUBLIC)');
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(p.proacl) a
  where n.nspname = 'public' and p.proname like 'dash\_%' and (a.grantee = 0 or a.grantee = 'anon'::regrole)$q$, 0, 'ninguna dash_* da permisos a PUBLIC ni a anon');
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(p.proacl) a
  where n.nspname = 'public' and p.proname like 'dash\_%' and a.grantee = 'authenticated'::regrole and a.privilege_type = 'EXECUTE'$q$, 7, 'authenticated ejecuta las 7 dash_*');
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'dash\_%' and p.proconfig = array['search_path=""']$q$, 7, 'las 7 dash_* fijan search_path vacío');

-- =======================================================================
-- 18. Logo del club (0021)
-- =======================================================================
-- Head coach A: sube a la carpeta de su club y fija el logo.
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$insert into storage.objects (bucket_id, name)
  values ('club-logos', 'aaaaaaaa-0000-0000-0000-000000000001/logo.png')$q$, 'head coach A sube el logo de su club');
select pg_temp.expect_fail($q$insert into storage.objects (bucket_id, name)
  values ('club-logos', 'bbbbbbbb-0000-0000-0000-000000000002/logo.png')$q$, 'head coach A sube a la carpeta del club B');
select pg_temp.expect_fail($q$select public.set_club_logo('bbbbbbbb-0000-0000-0000-000000000002/logo.png')$q$, 'fijar una ruta de otro club');
select pg_temp.expect_fail($q$select public.set_club_logo('aaaaaaaa-0000-0000-0000-000000000001/no-existe.png')$q$, 'fijar un logo que no se subió');
select pg_temp.expect_ok($q$select public.set_club_logo('aaaaaaaa-0000-0000-0000-000000000001/logo.png')$q$, 'head coach A fija el logo');
select pg_temp.expect_count($q$select 1 from public.clubs where logo_path = 'aaaaaaaa-0000-0000-0000-000000000001/logo.png'$q$, 1, 'el logo quedó guardado');
select pg_temp.expect_no_rows($q$update public.clubs set logo_path = null$q$, 'head coach A edita el club directo');
select pg_temp.back();

-- El link de registro lee la ruta del logo sin sesión.
select pg_temp.as_anon();
select pg_temp.expect_count($q$select 1 where public.club_logo_path('club-a') = 'aaaaaaaa-0000-0000-0000-000000000001/logo.png'$q$, 1, 'anónimo lee el logo del link de registro');
select pg_temp.expect_count($q$select 1 where public.club_logo_path('no-existe') is null$q$, 1, 'un link inexistente no tiene logo');
select pg_temp.expect_fail($q$select public.set_club_logo(null)$q$, 'anónimo cambia el logo');
select pg_temp.expect_fail($q$insert into storage.objects (bucket_id, name)
  values ('club-logos', 'aaaaaaaa-0000-0000-0000-000000000001/anon.png')$q$, 'anónimo sube un logo');
select pg_temp.back();

-- Sin permiso: kine, jugador y staff de otro club.
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');   -- kine A
select pg_temp.expect_fail($q$insert into storage.objects (bucket_id, name)
  values ('club-logos', 'aaaaaaaa-0000-0000-0000-000000000001/kine.png')$q$, 'kine A sube un logo');
select pg_temp.expect_fail($q$select public.set_club_logo(null)$q$, 'kine A cambia el logo');
select pg_temp.expect_no_rows($q$delete from storage.objects where bucket_id = 'club-logos'$q$, 'kine A borra el logo');
select pg_temp.back();
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');   -- jugador A1
select pg_temp.expect_fail($q$insert into storage.objects (bucket_id, name)
  values ('club-logos', 'aaaaaaaa-0000-0000-0000-000000000001/jugador.png')$q$, 'jugador A1 sube un logo');
select pg_temp.expect_fail($q$select public.set_club_logo(null)$q$, 'jugador A1 cambia el logo');
select pg_temp.back();
select pg_temp.as_user('30000000-0000-0000-0000-00000000000b');   -- kine B
select pg_temp.expect_fail($q$insert into storage.objects (bucket_id, name)
  values ('club-logos', 'aaaaaaaa-0000-0000-0000-000000000001/b.png')$q$, 'kine B sube a la carpeta del club A');
select pg_temp.back();

-- Manager A también puede; NULL quita el logo.
select pg_temp.as_user('20000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.set_club_logo(null)$q$, 'manager A quita el logo');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.clubs where id = 'aaaaaaaa-0000-0000-0000-000000000001' and logo_path is null$q$, 1, 'el club queda sin logo');

-- La ruta debe estar en la carpeta del propio club, también en un update directo.
select pg_temp.expect_fail($q$update public.clubs set logo_path = 'bbbbbbbb-0000-0000-0000-000000000002/x.png'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 'logo con ruta de otro club (CHECK)');

-- Permisos de las funciones y del bucket
select pg_temp.expect_count($q$select 1 where has_function_privilege('anon', 'public.set_club_logo(text)', 'EXECUTE')$q$, 0, 'anon no ejecuta set_club_logo');
select pg_temp.expect_count($q$select 1 where has_function_privilege('anon', 'public.club_logo_path(text)', 'EXECUTE')$q$, 1, 'anon ejecuta club_logo_path');
select pg_temp.expect_count($q$select 1 from storage.buckets where id = 'club-logos' and public and file_size_limit = 1048576$q$, 1, 'bucket club-logos público y de 1 MB');

-- =======================================================================
-- 19. Métricas del Resumen (0023)
-- =======================================================================
-- Por defecto (NULL), y cualquier miembro confirmado del club lo lee.
select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');   -- entrenador A
select pg_temp.expect_count($q$select 1 from public.clubs where dashboard_metrics is null$q$, 1, 'entrenador A lee las métricas del Resumen (por defecto)');
select pg_temp.back();

-- Head coach A elige, en orden; puede dejarlas vacías o volver a las de siempre.
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.set_dashboard_metrics(array['lesionados', 'proximas_altas', 'total'])$q$, 'head coach A elige métricas');
select pg_temp.expect_count($q$select 1 from public.clubs
  where id = 'aaaaaaaa-0000-0000-0000-000000000001' and dashboard_metrics = array['lesionados', 'proximas_altas', 'total']$q$, 1, 'quedan guardadas y en orden');
select pg_temp.expect_fail($q$select public.set_dashboard_metrics(array['total', 'inventada'])$q$, 'clave fuera del catálogo');
select pg_temp.expect_fail($q$select public.set_dashboard_metrics(array['total', 'total'])$q$, 'clave repetida');
select pg_temp.expect_fail($q$select public.set_dashboard_metrics(array['total', null])$q$, 'clave nula');
select pg_temp.expect_ok($q$select public.set_dashboard_metrics(array[]::text[])$q$, 'head coach A deja el Resumen sin métricas');
select pg_temp.expect_count($q$select 1 from public.clubs where cardinality(dashboard_metrics) = 0$q$, 1, 'queda vacío');
select pg_temp.expect_no_rows($q$update public.clubs set dashboard_metrics = array['total']$q$, 'head coach A edita el club directo');
select pg_temp.back();

-- Nadie más puede cambiarlas: manager, kine, jugador, pendiente, anónimo ni otro club.
select pg_temp.as_user('20000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select public.set_dashboard_metrics(null)$q$, 'manager A cambia las métricas');
select pg_temp.back();
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select public.set_dashboard_metrics(null)$q$, 'kine A cambia las métricas');
select pg_temp.back();
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select public.set_dashboard_metrics(null)$q$, 'jugador A1 cambia las métricas');
select pg_temp.back();
select pg_temp.as_user('80000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select public.set_dashboard_metrics(null)$q$, 'staff pendiente A cambia las métricas');
select pg_temp.back();
select pg_temp.as_anon();
select pg_temp.expect_fail($q$select public.set_dashboard_metrics(null)$q$, 'anónimo cambia las métricas');
select pg_temp.back();
select pg_temp.as_user('30000000-0000-0000-0000-00000000000b');   -- kine B
select pg_temp.expect_fail($q$select public.set_dashboard_metrics(null)$q$, 'kine B cambia las métricas');
select pg_temp.expect_count($q$select 1 from public.clubs where id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 0, 'kine B no ve las métricas del club A');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.clubs where id = 'bbbbbbbb-0000-0000-0000-000000000002' and dashboard_metrics is null$q$, 1, 'el club B no cambió');

-- Head coach A vuelve a las de siempre (NULL).
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.set_dashboard_metrics(null)$q$, 'head coach A vuelve a las métricas por defecto');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.clubs where id = 'aaaaaaaa-0000-0000-0000-000000000001' and dashboard_metrics is null$q$, 1, 'vuelve a NULL');

-- El CHECK rechaza claves fuera del catálogo también en un update directo (como postgres).
select pg_temp.expect_fail($q$update public.clubs set dashboard_metrics = array['inventada']
  where id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 'clave fuera del catálogo (CHECK)');

-- Permisos de la función
select pg_temp.expect_count($q$select 1 where has_function_privilege('anon', 'public.set_dashboard_metrics(text[])', 'EXECUTE')$q$, 0, 'anon no ejecuta set_dashboard_metrics');
select pg_temp.expect_count($q$select 1 where has_function_privilege('authenticated', 'public.set_dashboard_metrics(text[])', 'EXECUTE')$q$, 1, 'authenticated ejecuta set_dashboard_metrics');
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'set_dashboard_metrics' and p.prosecdef and p.proconfig = array['search_path=""']$q$, 1, 'set_dashboard_metrics es SECURITY DEFINER con search_path vacío');

-- =======================================================================
-- 20. Métricas del Resumen en celular, por separado (0024)
-- =======================================================================
select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');   -- entrenador A
select pg_temp.expect_count($q$select 1 from public.clubs where dashboard_metrics_mobile is null$q$, 1, 'entrenador A lee las métricas de celular (por defecto)');
select pg_temp.back();

select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.set_dashboard_metrics(array['disponibles', 'lesionados', 'disponibilidad'])$q$, 'head coach A elige 3 métricas en computador');
select pg_temp.expect_ok($q$select public.set_dashboard_metrics_mobile(array['disponibles', 'lesionados'])$q$, 'head coach A elige 2 métricas en celular');
select pg_temp.expect_count($q$select 1 from public.clubs where id = 'aaaaaaaa-0000-0000-0000-000000000001'
  and dashboard_metrics = array['disponibles', 'lesionados', 'disponibilidad']
  and dashboard_metrics_mobile = array['disponibles', 'lesionados']$q$, 1, 'computador y celular quedan por separado');
select pg_temp.expect_ok($q$select public.set_dashboard_metrics_mobile(array['total'])$q$, 'cambiar celular');
select pg_temp.expect_count($q$select 1 from public.clubs where id = 'aaaaaaaa-0000-0000-0000-000000000001'
  and dashboard_metrics = array['disponibles', 'lesionados', 'disponibilidad']$q$, 1, 'cambiar celular no toca computador');
select pg_temp.expect_fail($q$select public.set_dashboard_metrics_mobile(array['inventada'])$q$, 'celular: clave fuera del catálogo');
select pg_temp.expect_fail($q$select public.set_dashboard_metrics_mobile(array['total', 'total'])$q$, 'celular: clave repetida');
select pg_temp.expect_fail($q$select public.set_dashboard_metrics_mobile(array['total', null])$q$, 'celular: clave nula');
select pg_temp.expect_ok($q$select public.set_dashboard_metrics_mobile(array[]::text[])$q$, 'celular sin métricas');
select pg_temp.expect_no_rows($q$update public.clubs set dashboard_metrics_mobile = array['total']$q$, 'head coach A edita el club directo (celular)');
select pg_temp.expect_ok($q$select public.set_dashboard_metrics_mobile(null)$q$, 'celular vuelve a las de siempre');
select pg_temp.expect_ok($q$select public.set_dashboard_metrics(null)$q$, 'computador vuelve a las de siempre');
select pg_temp.back();

select pg_temp.as_user('20000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select public.set_dashboard_metrics_mobile(null)$q$, 'manager A cambia las métricas de celular');
select pg_temp.back();
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select public.set_dashboard_metrics_mobile(null)$q$, 'kine A cambia las métricas de celular');
select pg_temp.back();
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select public.set_dashboard_metrics_mobile(null)$q$, 'jugador A1 cambia las métricas de celular');
select pg_temp.back();
select pg_temp.as_user('80000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select public.set_dashboard_metrics_mobile(null)$q$, 'staff pendiente A cambia las métricas de celular');
select pg_temp.back();
select pg_temp.as_anon();
select pg_temp.expect_fail($q$select public.set_dashboard_metrics_mobile(null)$q$, 'anónimo cambia las métricas de celular');
select pg_temp.back();
select pg_temp.as_user('30000000-0000-0000-0000-00000000000b');
select pg_temp.expect_fail($q$select public.set_dashboard_metrics_mobile(null)$q$, 'kine B cambia las métricas de celular');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.clubs where id = 'bbbbbbbb-0000-0000-0000-000000000002' and dashboard_metrics_mobile is null$q$, 1, 'el club B no cambió (celular)');

select pg_temp.expect_fail($q$update public.clubs set dashboard_metrics_mobile = array['inventada']
  where id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 'celular: clave fuera del catálogo (CHECK)');

select pg_temp.expect_count($q$select 1 where has_function_privilege('anon', 'public.set_dashboard_metrics_mobile(text[])', 'EXECUTE')$q$, 0, 'anon no ejecuta set_dashboard_metrics_mobile');
select pg_temp.expect_count($q$select 1 where has_function_privilege('authenticated', 'public.set_dashboard_metrics_mobile(text[])', 'EXECUTE')$q$, 1, 'authenticated ejecuta set_dashboard_metrics_mobile');
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'set_dashboard_metrics_mobile' and p.prosecdef and p.proconfig = array['search_path=""']$q$, 1, 'set_dashboard_metrics_mobile es SECURITY DEFINER con search_path vacío');

-- =======================================================================
-- 21. Portada, encuadre y categoría fija del club (0025, 0026)
-- =======================================================================
-- La categoría la fijamos nosotros al crear el club (como postgres).
update public.clubs set category = 'Adulta' where id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Head coach A: sube la portada a la carpeta de su club, la fija y la encuadra.
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$insert into storage.objects (bucket_id, name)
  values ('club-covers', 'aaaaaaaa-0000-0000-0000-000000000001/portada.jpg')$q$, 'head coach A sube la portada de su club');
select pg_temp.expect_fail($q$insert into storage.objects (bucket_id, name)
  values ('club-covers', 'bbbbbbbb-0000-0000-0000-000000000002/portada.jpg')$q$, 'head coach A sube a la carpeta del club B');
select pg_temp.expect_fail($q$select public.set_club_cover_position(30, 30)$q$, 'encuadrar sin portada');
select pg_temp.expect_fail($q$select public.set_club_cover('bbbbbbbb-0000-0000-0000-000000000002/portada.jpg')$q$, 'fijar una portada de otro club');
select pg_temp.expect_fail($q$select public.set_club_cover('aaaaaaaa-0000-0000-0000-000000000001/no-existe.jpg')$q$, 'fijar una portada que no se subió');
select pg_temp.expect_ok($q$select public.set_club_cover('aaaaaaaa-0000-0000-0000-000000000001/portada.jpg')$q$, 'head coach A fija la portada');
select pg_temp.expect_count($q$select 1 from public.clubs where cover_path = 'aaaaaaaa-0000-0000-0000-000000000001/portada.jpg'
  and cover_position_x = 50 and cover_position_y = 50$q$, 1, 'la portada queda guardada y centrada');
select pg_temp.expect_ok($q$select public.set_club_cover_position(40, 22)$q$, 'head coach A encuadra la portada');
select pg_temp.expect_count($q$select 1 from public.clubs where cover_position_x = 40 and cover_position_y = 22$q$, 1, 'el encuadre queda guardado');
select pg_temp.expect_fail($q$select public.set_club_cover_position(-1, 50)$q$, 'encuadre horizontal bajo 0');
select pg_temp.expect_fail($q$select public.set_club_cover_position(50, 101)$q$, 'encuadre vertical sobre 100');
select pg_temp.expect_fail($q$select public.set_club_cover_position(null, 50)$q$, 'encuadre nulo');
select pg_temp.expect_ok($q$select public.set_club_cover('aaaaaaaa-0000-0000-0000-000000000001/portada.jpg')$q$, 'head coach A vuelve a fijar la portada');
select pg_temp.expect_count($q$select 1 from public.clubs where cover_position_x = 50 and cover_position_y = 50$q$, 1, 'una portada fijada de nuevo vuelve al centro');
select pg_temp.expect_fail($q$select public.set_club_category('Juvenil')$q$, 'head coach A ya no cambia la categoría');
select pg_temp.expect_no_rows($q$update public.clubs set category = 'Juvenil', cover_path = null, cover_position_y = 0$q$, 'head coach A edita el club directo');
select pg_temp.back();

-- Miembros confirmados del club leen la portada y la categoría; nadie de otro club ni anónimos.
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');   -- jugador A1
select pg_temp.expect_count($q$select 1 from storage.objects where bucket_id = 'club-covers'$q$, 1, 'jugador A1 ve la portada de su club');
select pg_temp.expect_count($q$select 1 from public.clubs where category = 'Adulta'$q$, 1, 'jugador A1 lee la categoría');
select pg_temp.expect_fail($q$insert into storage.objects (bucket_id, name)
  values ('club-covers', 'aaaaaaaa-0000-0000-0000-000000000001/jugador.jpg')$q$, 'jugador A1 sube una portada');
select pg_temp.expect_fail($q$select public.set_club_cover(null)$q$, 'jugador A1 cambia la portada');
select pg_temp.expect_fail($q$select public.set_club_cover_position(10, 10)$q$, 'jugador A1 encuadra la portada');
select pg_temp.back();
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');   -- kine A
select pg_temp.expect_count($q$select 1 from storage.objects where bucket_id = 'club-covers'$q$, 1, 'kine A ve la portada de su club');
select pg_temp.expect_fail($q$select public.set_club_cover(null)$q$, 'kine A cambia la portada');
select pg_temp.expect_fail($q$select public.set_club_cover_position(10, 10)$q$, 'kine A encuadra la portada');
select pg_temp.back();
select pg_temp.as_user('80000000-0000-0000-0000-00000000000a');   -- staff pendiente A
select pg_temp.expect_count($q$select 1 from storage.objects where bucket_id = 'club-covers'$q$, 0, 'staff pendiente A no ve la portada');
select pg_temp.back();
select pg_temp.as_user('30000000-0000-0000-0000-00000000000b');   -- kine B
select pg_temp.expect_count($q$select 1 from storage.objects where bucket_id = 'club-covers'$q$, 0, 'kine B no ve la portada del club A');
select pg_temp.expect_fail($q$insert into storage.objects (bucket_id, name)
  values ('club-covers', 'aaaaaaaa-0000-0000-0000-000000000001/b.jpg')$q$, 'kine B sube a la carpeta del club A');
select pg_temp.expect_fail($q$select public.set_club_cover_position(10, 10)$q$, 'kine B encuadra (su club no tiene portada)');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.clubs where id = 'aaaaaaaa-0000-0000-0000-000000000001'
  and cover_position_x = 50 and cover_position_y = 50$q$, 1, 'nadie sin permiso movió el encuadre del club A');
select pg_temp.as_anon();
select pg_temp.expect_count($q$select 1 from storage.objects where bucket_id = 'club-covers'$q$, 0, 'anónimo no ve portadas');
select pg_temp.expect_fail($q$select public.set_club_cover(null)$q$, 'anónimo cambia la portada');
select pg_temp.expect_fail($q$select public.set_club_cover_position(10, 10)$q$, 'anónimo encuadra la portada');
select pg_temp.back();

-- Manager A también puede encuadrar y quitar la portada; la categoría no cambia.
select pg_temp.as_user('20000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.set_club_cover_position(0, 100)$q$, 'manager A encuadra en los extremos');
select pg_temp.expect_ok($q$select public.set_club_cover(null)$q$, 'manager A quita la portada');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.clubs where id = 'aaaaaaaa-0000-0000-0000-000000000001' and cover_path is null and category = 'Adulta'$q$, 1, 'el club queda sin portada y con su categoría');

-- CHECK también en un update directo (como postgres).
select pg_temp.expect_fail($q$update public.clubs set cover_path = 'bbbbbbbb-0000-0000-0000-000000000002/x.jpg'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 'portada con ruta de otro club (CHECK)');
select pg_temp.expect_fail($q$update public.clubs set category = 'x'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 'categoría de 1 carácter (CHECK)');
select pg_temp.expect_fail($q$update public.clubs set cover_position_y = 101
  where id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 'encuadre fuera de rango (CHECK)');

-- Permisos de las funciones y del bucket
select pg_temp.expect_count($q$select 1 where has_function_privilege('authenticated', 'public.set_club_category(text)', 'EXECUTE')
  or has_function_privilege('anon', 'public.set_club_category(text)', 'EXECUTE')$q$, 0, 'nadie ejecuta set_club_category');
select pg_temp.expect_count($q$select 1 where has_function_privilege('anon', 'public.set_club_cover(text)', 'EXECUTE')
  or has_function_privilege('anon', 'public.set_club_cover_position(integer, integer)', 'EXECUTE')$q$, 0, 'anon no ejecuta set_club_cover ni set_club_cover_position');
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('set_club_cover', 'set_club_cover_position')
  and p.prosecdef and p.proconfig = array['search_path=""']$q$, 2, 'set_club_cover y set_club_cover_position son SECURITY DEFINER con search_path vacío');
select pg_temp.expect_count($q$select 1 from storage.buckets where id = 'club-covers' and not public and file_size_limit = 5242880$q$, 1, 'bucket club-covers privado y de 5 MB');

-- =======================================================================
-- 22. Teléfono del jugador (0030)
-- =======================================================================
-- Jugador A1 guarda su número; nadie lee la tabla directo.
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');   -- jugador A1
select pg_temp.expect_ok($q$select public.set_my_phone('+56912345678')$q$, 'jugador A1 guarda su teléfono');
select pg_temp.expect_ok($q$select public.set_my_phone('+56987654321')$q$, 'jugador A1 cambia su teléfono (upsert)');
select pg_temp.expect_fail($q$select 1 from public.player_contacts$q$, 'jugador A1 lee player_contacts directo');
select pg_temp.expect_fail($q$insert into public.player_contacts (player_id, club_id, phone)
  values ('a1000000-1111-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '+56911111111')$q$, 'jugador A1 escribe player_contacts directo');
select pg_temp.expect_count($q$select 1 where public.get_player_phone('a1000000-1111-0000-0000-000000000001') = '+56987654321'$q$, 1, 'jugador A1 lee su propio teléfono');
select pg_temp.expect_fail($q$select public.set_my_phone('56912345678')$q$, 'teléfono sin +');
select pg_temp.expect_fail($q$select public.set_my_phone('+5691234')$q$, 'teléfono demasiado corto');
select pg_temp.expect_fail($q$select public.set_my_phone('+0912345678')$q$, 'teléfono que empieza en 0');
select pg_temp.expect_fail($q$select public.set_my_phone('+56 9 1234 5678')$q$, 'teléfono con espacios');
select pg_temp.expect_count($q$select 1 where public.get_player_phone('a1000000-1111-0000-0000-000000000001') = '+56987654321'$q$, 1, 'un formato inválido no cambia el número');
select pg_temp.back();

-- Otros jugadores no lo ven: compañero del club A y jugador del club B.
select pg_temp.as_user('70000000-0000-0000-0000-00000000000a');   -- jugador del club A (confirmado en la sección 6)
select pg_temp.expect_count($q$select 1 where public.get_player_phone('a1000000-1111-0000-0000-000000000001') is null$q$, 1, 'otro jugador del club A no ve el teléfono de A1');
select pg_temp.back();
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');   -- jugador B1
select pg_temp.expect_count($q$select 1 where public.get_player_phone('a1000000-1111-0000-0000-000000000001') is null$q$, 1, 'jugador B1 no ve el teléfono de A1');
select pg_temp.expect_fail($q$select 1 from public.player_contacts$q$, 'jugador B1 lee player_contacts directo');
select pg_temp.back();

-- Staff confirmado del club A sí lo ve (los 6 roles de staff).
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');   -- head coach A
select pg_temp.expect_count($q$select 1 where public.get_player_phone('a1000000-1111-0000-0000-000000000001') = '+56987654321'$q$, 1, 'head coach A ve el teléfono de A1');
select pg_temp.expect_fail($q$select public.set_my_phone('+56911111111')$q$, 'head coach A (sin ficha de jugador) guarda un teléfono');
select pg_temp.expect_fail($q$select 1 from public.player_contacts$q$, 'head coach A lee player_contacts directo');
select pg_temp.back();
select pg_temp.as_user('20000000-0000-0000-0000-00000000000a');   -- manager A
select pg_temp.expect_count($q$select 1 where public.get_player_phone('a1000000-1111-0000-0000-000000000001') = '+56987654321'$q$, 1, 'manager A ve el teléfono de A1');
select pg_temp.back();
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');   -- kine A
select pg_temp.expect_count($q$select 1 where public.get_player_phone('a1000000-1111-0000-0000-000000000001') = '+56987654321'$q$, 1, 'kine A ve el teléfono de A1');
select pg_temp.expect_fail($q$select public.set_my_phone('+56911111111')$q$, 'kine A guarda un teléfono');
select pg_temp.back();
select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');   -- entrenador A
select pg_temp.expect_count($q$select 1 where public.get_player_phone('a1000000-1111-0000-0000-000000000001') = '+56987654321'$q$, 1, 'entrenador A ve el teléfono de A1');
select pg_temp.back();
select pg_temp.as_user('50000000-0000-0000-0000-00000000000a');   -- nutricionista A
select pg_temp.expect_count($q$select 1 where public.get_player_phone('a1000000-1111-0000-0000-000000000001') = '+56987654321'$q$, 1, 'nutricionista A ve el teléfono de A1');
select pg_temp.back();
-- Preparador físico: se le da el rol al nutricionista solo para esta prueba.
update public.club_members set roles = '{preparador_fisico}' where user_id = '50000000-0000-0000-0000-00000000000a' and club_id = 'aaaaaaaa-0000-0000-0000-000000000001';   -- desde 0039, en club_members
select pg_temp.as_user('50000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 where public.get_player_phone('a1000000-1111-0000-0000-000000000001') = '+56987654321'$q$, 1, 'preparador físico A ve el teléfono de A1');
select pg_temp.back();
update public.club_members set roles = '{nutricionista}' where user_id = '50000000-0000-0000-0000-00000000000a' and club_id = 'aaaaaaaa-0000-0000-0000-000000000001';   -- desde 0039, en club_members

-- Staff de otro club y staff pendiente no lo ven.
select pg_temp.as_user('30000000-0000-0000-0000-00000000000b');   -- kine B
select pg_temp.expect_count($q$select 1 where public.get_player_phone('a1000000-1111-0000-0000-000000000001') is null$q$, 1, 'kine B no ve el teléfono de A1');
select pg_temp.back();
select pg_temp.as_user('80000000-0000-0000-0000-00000000000a');   -- staff pendiente A
select pg_temp.expect_count($q$select 1 where public.get_player_phone('a1000000-1111-0000-0000-000000000001') is null$q$, 1, 'staff pendiente A no ve el teléfono de A1');
select pg_temp.expect_fail($q$select public.set_my_phone('+56911111111')$q$, 'staff pendiente A guarda un teléfono');
select pg_temp.back();

-- Jugador pendiente: guarda su número, pero el staff no lo ve hasta que lo confirmen.
-- (el id de su ficha se guarda en un ajuste de la sesión para usarlo en las consultas)
select set_config('test.pending_player', (select id::text from public.players
  where user_id = 'c0000000-0000-0000-0000-00000000000a'), true);
select pg_temp.expect_count($q$select 1 from public.players where id = current_setting('test.pending_player')::uuid
  and status = 'pendiente'$q$, 1, 'el jugador nuevo sigue pendiente');
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000a');   -- jugador pendiente
select pg_temp.expect_ok($q$select public.set_my_phone('+56922223333')$q$, 'jugador pendiente guarda su teléfono');
select pg_temp.expect_count($q$select 1 where public.get_player_phone(current_setting('test.pending_player')::uuid) = '+56922223333'$q$, 1, 'jugador pendiente lee su propio teléfono');
select pg_temp.back();
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');   -- kine A
select pg_temp.expect_count($q$select 1 where public.get_player_phone(current_setting('test.pending_player')::uuid) is null$q$, 1, 'kine A no ve el teléfono de un jugador pendiente');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.player_contacts pc join public.players p on p.id = pc.player_id
  where p.user_id = 'c0000000-0000-0000-0000-00000000000a' and pc.phone = '+56922223333'$q$, 1, 'el teléfono del jugador pendiente quedó guardado');

-- null o '' lo borran.
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');   -- jugador A1
select pg_temp.expect_ok($q$select public.set_my_phone(null)$q$, 'jugador A1 borra su teléfono con null');
select pg_temp.expect_count($q$select 1 where public.get_player_phone('a1000000-1111-0000-0000-000000000001') is null$q$, 1, 'tras null no hay teléfono');
select pg_temp.expect_ok($q$select public.set_my_phone('+56912345678')$q$, 'jugador A1 lo vuelve a guardar');
select pg_temp.expect_ok($q$select public.set_my_phone('  ')$q$, 'jugador A1 lo borra con texto vacío');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.player_contacts where player_id = 'a1000000-1111-0000-0000-000000000001'$q$, 0, 'la fila de A1 se borró');

-- Anónimo: no ejecuta ninguna de las dos ni lee la tabla.
select pg_temp.as_anon();
select pg_temp.expect_fail($q$select public.set_my_phone('+56912345678')$q$, 'anónimo guarda un teléfono');
select pg_temp.expect_fail($q$select public.get_player_phone('a1000000-1111-0000-0000-000000000001')$q$, 'anónimo lee un teléfono');
select pg_temp.expect_fail($q$select 1 from public.player_contacts$q$, 'anónimo lee player_contacts');
select pg_temp.back();

select pg_temp.expect_count($q$select 1 where has_function_privilege('anon', 'public.set_my_phone(text)', 'EXECUTE')
  or has_function_privilege('anon', 'public.get_player_phone(uuid)', 'EXECUTE')$q$, 0, 'anon no ejecuta set_my_phone ni get_player_phone');
select pg_temp.expect_count($q$select 1 where has_function_privilege('authenticated', 'public.set_my_phone(text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.get_player_phone(uuid)', 'EXECUTE')$q$, 1, 'authenticated ejecuta set_my_phone y get_player_phone');
select pg_temp.expect_count($q$select 1 from pg_class where oid = 'public.player_contacts'::regclass and relrowsecurity$q$, 1, 'player_contacts tiene RLS activo');
select pg_temp.expect_count($q$select 1 from pg_policies where schemaname = 'public' and tablename = 'player_contacts'$q$, 0, 'player_contacts no tiene políticas');
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('set_my_phone', 'get_player_phone')
  and p.prosecdef and p.proconfig = array['search_path=""']$q$, 2, 'set_my_phone y get_player_phone son SECURITY DEFINER con search_path vacío');

-- =======================================================================
-- Correo "ya puedes entrar": sale desde la app, no desde la base (0034)
-- =======================================================================
select pg_temp.expect_count($q$select 1 from pg_trigger where tgname = 'profiles_member_confirmed_email' and not tgisinternal$q$, 0, 'ya no existe el trigger del correo');
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where (n.nspname, p.proname) in (('private', 'queue_member_confirmed_email'), ('public', 'claim_member_email'))$q$, 0, 'ya no existen las funciones del envío por base');
select pg_temp.expect_count($q$select 1 from pg_class where oid = 'private.member_emails'::regclass and relrowsecurity$q$, 1, 'private.member_emails sigue con RLS (sin uso)');
select pg_temp.expect_count($q$select 1 where has_table_privilege('authenticated', 'private.member_emails', 'SELECT')
  or has_table_privilege('anon', 'private.member_emails', 'SELECT')$q$, 0, 'anon y authenticated no leen private.member_emails');

-- =======================================================================
-- Sin verificación de correo (0036) y límite de correos de recuperación (0035)
-- =======================================================================
select pg_temp.expect_count($q$select 1 where has_function_privilege('authenticated', 'public.create_email_verification(uuid)', 'EXECUTE')
  or has_function_privilege('anon', 'public.create_email_verification(uuid)', 'EXECUTE')
  or has_function_privilege('authenticated', 'public.verify_email(text)', 'EXECUTE')
  or has_function_privilege('anon', 'public.verify_email(text)', 'EXECUTE')
  or has_function_privilege('authenticated', 'public.allow_auth_email(text, text)', 'EXECUTE')
  or has_function_privilege('anon', 'public.allow_auth_email(text, text)', 'EXECUTE')$q$, 0, 'la app no usa las funciones de verificación ni el límite de correos');
select pg_temp.expect_count($q$select 1 where has_function_privilege('service_role', 'public.allow_auth_email(text, text)', 'EXECUTE')$q$, 1, 'service_role usa el límite de correos');
select pg_temp.expect_count($q$select 1 where has_table_privilege('authenticated', 'private.email_verification_tokens', 'SELECT')
  or has_table_privilege('anon', 'private.email_verification_tokens', 'SELECT')
  or has_table_privilege('authenticated', 'private.auth_email_log', 'SELECT')
  or has_table_privilege('anon', 'private.auth_email_log', 'SELECT')$q$, 0, 'nadie de la app lee tokens ni el registro de correos');
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('allow_auth_email', 'review_member')
  and p.prosecdef and p.proconfig = array['search_path=""']$q$, 2, 'allow_auth_email y review_member son SECURITY DEFINER con search_path vacío');

set local role service_role;
select pg_temp.expect_count($q$select 1 where public.allow_auth_email('Prueba@Test.cl', 'recuperacion')$q$, 1, 'primer correo de recuperación: permitido');
select pg_temp.expect_count($q$select 1 where public.allow_auth_email(' prueba@test.cl ', 'recuperacion')$q$, 0, 'otro en el mismo minuto (mismo correo, otra escritura): bloqueado');
reset role;
update private.auth_email_log set sent_at = sent_at - interval '2 minutes'
  where email_hash = encode(extensions.digest('prueba@test.cl', 'sha256'), 'hex');
insert into private.auth_email_log (email_hash, kind, sent_at)
  select encode(extensions.digest('prueba@test.cl', 'sha256'), 'hex'), 'recuperacion', now() - interval '10 minutes' from generate_series(1, 4);
set local role service_role;
select pg_temp.expect_count($q$select 1 where public.allow_auth_email('prueba@test.cl', 'recuperacion')$q$, 0, 'más de 5 en una hora: bloqueado');
reset role;
select pg_temp.expect_count($q$select 1 from private.auth_email_log where email_hash = encode(extensions.digest('prueba@test.cl', 'sha256'), 'hex') and kind = 'recuperacion'$q$, 5, 'se guarda el hash del correo, no el correo');

-- Confirmar un registro no encola nada en la base.
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');   -- head coach A
select pg_temp.expect_ok($q$select public.review_member('c0000000-0000-0000-0000-00000000000a', 'confirmar')$q$, 'la dirección confirma al jugador pendiente c0 sin verificar su correo');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from private.member_emails where profile_id = 'c0000000-0000-0000-0000-00000000000a'$q$, 0, 'confirmar no deja filas en member_emails');
select pg_temp.expect_count($q$select 1 from net.http_request_queue
  where convert_from(body, 'utf8') like '%c0000000-0000-0000-0000-00000000000a%'$q$, 0, 'confirmar no encola llamados HTTP');

-- =======================================================================
-- Membresías por plantel: club_members (0037, fase "expand")
-- =======================================================================
-- a. Todo perfil tiene su membresía idéntica (mismo club, roles, estado y puesto pedido).
select pg_temp.expect_count($q$select 1 from public.profiles p
  where not exists (select 1 from public.club_members m
                    where m.user_id = p.id and m.club_id = p.club_id and m.roles = p.roles
                      and m.status = p.status and m.requested_role is not distinct from p.requested_role)$q$,
  0, 'ningún perfil queda sin su membresía idéntica');

-- b. (cambió con 0039: la sincronización se invirtió) Los cambios en club_members del
--    plantel principal se reflejan en profiles; un perfil nuevo ya no crea su membresía.
update public.club_members set roles = '{entrenador,preparador_fisico}'
 where user_id = '40000000-0000-0000-0000-00000000000a' and club_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.expect_count($q$select 1 from public.profiles where id = '40000000-0000-0000-0000-00000000000a'
  and roles = '{entrenador,preparador_fisico}'$q$, 1, 'cambiar los roles en club_members (plantel principal) se refleja en profiles');
update public.club_members set status = 'rechazado'
 where user_id = '50000000-0000-0000-0000-00000000000a' and club_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.expect_count($q$select 1 from public.profiles where id = '50000000-0000-0000-0000-00000000000a' and status = 'rechazado'$q$, 1, 'cambiar el status en club_members (plantel principal) se refleja en profiles');
insert into public.profiles (id, club_id, roles, full_name, status, requested_role)
  values ('e0000000-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-000000000002', '{}', 'Nuevo B', 'pendiente', null);
select pg_temp.expect_count($q$select 1 from public.club_members where user_id = 'e0000000-0000-0000-0000-00000000000a'$q$, 0, 'un perfil nuevo ya no crea su membresía');
insert into public.club_members (user_id, club_id, roles, status, requested_role)
  values ('e0000000-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-000000000002', '{}', 'pendiente', 'kinesiologo');
select pg_temp.expect_count($q$select 1 from public.profiles where id = 'e0000000-0000-0000-0000-00000000000a'
  and club_id = 'bbbbbbbb-0000-0000-0000-000000000002' and status = 'pendiente' and requested_role = 'kinesiologo'$q$, 1, 'una membresía nueva en el plantel principal se refleja en profiles');
select pg_temp.expect_count($q$select 1 from public.club_members where user_id = 'e0000000-0000-0000-0000-00000000000a'$q$, 1, 'una sola membresía por perfil nuevo');

-- c. Cada usuario ve sus propias filas. Desde 0038 la dirección ve además las de
--    su club (también pendientes): estas dos pruebas cambiaron con 0038.
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');   -- head coach A
select pg_temp.expect_count($q$select 1 from public.club_members where club_id <> 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 0, 'head coach A no ve membresías de otros planteles');
select pg_temp.expect_count($q$select 1 from public.club_members where user_id = '80000000-0000-0000-0000-00000000000a' and status = 'pendiente'$q$, 1, 'head coach A (dirección) ve las membresías pendientes de su club');
select pg_temp.back();
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');   -- jugador B1
select pg_temp.expect_count($q$select 1 from public.club_members where user_id = '60000000-0000-0000-0000-00000000000b'$q$, 1, 'jugador B1 ve su membresía');
select pg_temp.expect_count($q$select 1 from public.club_members where club_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 0, 'jugador B1 no ve membresías del club A');
select pg_temp.expect_no_rows($q$update public.club_members set status = 'confirmado'$q$, 'jugador B1 edita club_members directo');
select pg_temp.expect_fail($q$insert into public.club_members (user_id, club_id) values ('60000000-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001')$q$, 'jugador B1 se agrega a otro plantel directo');
select pg_temp.back();

-- d. anon no lee club_members.
select pg_temp.as_anon();
select pg_temp.expect_count($q$select 1 from public.club_members$q$, 0, 'anónimo no lee club_members');
select pg_temp.back();
-- (cambió con 0039: la función del trigger ahora es mirror_member_to_profile)
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private' and p.proname = 'sync_profile_to_member'$q$, 0, 'ya no existe la sincronización de profiles a club_members');
select pg_temp.expect_count($q$select 1 where has_function_privilege('authenticated', 'private.mirror_member_to_profile()', 'EXECUTE')
  or has_function_privilege('anon', 'private.mirror_member_to_profile()', 'EXECUTE')$q$, 0, 'nadie de la app ejecuta la función del trigger');

-- =======================================================================
-- Multi-plantel (0038): helpers con club_id y políticas que los usan
-- =======================================================================
-- b. Equivalencia: para cada cuenta (las reales del proyecto y las de esta prueba),
--    los helpers nuevos con el plantel de la cuenta dan lo mismo que los viejos.
create temp table helper_diff (user_id uuid, helper text);
do $$
declare u record; r public.user_role;
begin
  for u in select id, club_id from public.profiles loop
    perform set_config('request.jwt.claims', json_build_object('sub', u.id, 'role', 'authenticated')::text, true);
    foreach r in array enum_range(null::public.user_role) loop
      if private.has_role(r) is distinct from private.has_role(u.club_id, r) then insert into helper_diff values (u.id, 'has_role ' || r); end if;
    end loop;
    if private.is_staff() is distinct from private.is_staff(u.club_id) then insert into helper_diff values (u.id, 'is_staff'); end if;
    if private.is_direction() is distinct from private.is_direction(u.club_id) then insert into helper_diff values (u.id, 'is_direction'); end if;
    if private.has_kine_powers() is distinct from private.has_kine_powers(u.club_id) then insert into helper_diff values (u.id, 'has_kine_powers'); end if;
    if private.can_manage_nominas() is distinct from private.can_manage_nominas(u.club_id) then insert into helper_diff values (u.id, 'can_manage_nominas'); end if;
    if private.can_view_documents() is distinct from private.can_view_documents(u.club_id) then insert into helper_diff values (u.id, 'can_view_documents'); end if;
    if private.current_player_id() is distinct from private.current_player_id(u.club_id) then insert into helper_diff values (u.id, 'current_player_id'); end if;
    if (private.current_club_id() is not null) is distinct from private.is_confirmed_member(u.club_id) then insert into helper_diff values (u.id, 'is_confirmed_member'); end if;
    if (private.member_club_id() = u.club_id) is distinct from private.is_member(u.club_id) then insert into helper_diff values (u.id, 'is_member'); end if;
  end loop;
end $$;
select pg_temp.expect_count($q$select 1 from helper_diff$q$, 0, 'helpers nuevos con el plantel de la cuenta = helpers viejos');

-- Datos ficticios: X es entrenador en el club A y jugador en el club B; P es jugador
-- confirmado en A y tiene una membresía pendiente en B; Q es staff pendiente en A.
insert into auth.users (id, email) values
  ('f1000000-0000-0000-0000-00000000000a', 'multi-x@test.cl'),
  ('f2000000-0000-0000-0000-00000000000a', 'multi-p@test.cl'),
  ('f3000000-0000-0000-0000-00000000000a', 'multi-q@test.cl');
insert into public.profiles (id, club_id, roles, full_name, status, requested_role) values
  ('f1000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{entrenador}', 'Multi X', 'confirmado', null),
  ('f2000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{jugador}',    'Multi P', 'confirmado', null),
  ('f3000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', '{}',           'Multi Q', 'pendiente',  'entrenador');
-- Desde 0039 insertar en profiles ya no crea la membresía: se crea aquí (preparación).
insert into public.club_members (user_id, club_id, roles, status, requested_role)
select id, club_id, roles, status, requested_role from public.profiles on conflict do nothing;
insert into public.club_members (user_id, club_id, roles, status) values
  ('f1000000-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-000000000002', '{jugador}', 'confirmado'),
  ('f2000000-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-000000000002', '{jugador}', 'pendiente');
insert into public.players (id, club_id, full_name, first_name, last_name, position, status, user_id) values
  ('f1b00000-1111-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Multi X', 'Multi', 'X', 'Portero', 'confirmado', 'f1000000-0000-0000-0000-00000000000a');
insert into public.injuries (id, club_id, player_id, type, severity) values
  ('f1b00000-2222-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'f1b00000-1111-0000-0000-000000000001', 'Esguince de X', 'leve');
insert into public.documents (club_id, player_id, storage_path, file_name) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'f1b00000-1111-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000002/f1b00000-1111-0000-0000-000000000001/informe-x.pdf', 'informe-x.pdf');
select set_config('test.a_injuries', (select count(*)::text from public.injuries where club_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
select set_config('test.b_injuries', (select count(*)::text from public.injuries where club_id = 'bbbbbbbb-0000-0000-0000-000000000002'), true);

-- c. Dos planteles: X es staff en A y jugador en B.
select pg_temp.as_user('f1000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 where (select count(*) from public.injuries where club_id = 'aaaaaaaa-0000-0000-0000-000000000001')
  = current_setting('test.a_injuries')::bigint$q$, 1, 'X (entrenador en A) ve todas las lesiones del plantel A');
select pg_temp.expect_count($q$select 1 where current_setting('test.b_injuries')::int > 1$q$, 1, 'el club B tiene lesiones de otros jugadores');
select pg_temp.expect_count($q$select 1 from public.injuries where club_id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$, 1, 'X (jugador en B) ve solo una lesión de B');
select pg_temp.expect_count($q$select 1 from public.injuries where club_id = 'bbbbbbbb-0000-0000-0000-000000000002'
  and player_id = 'f1b00000-1111-0000-0000-000000000001'$q$, 1, 'esa lesión es la suya');
select pg_temp.expect_count($q$select 1 from public.documents where club_id = 'bbbbbbbb-0000-0000-0000-000000000002'
  and player_id <> 'f1b00000-1111-0000-0000-000000000001'$q$, 0, 'X no ve documentos médicos de otros en B');
select pg_temp.expect_count($q$select 1 from public.documents where player_id = 'f1b00000-1111-0000-0000-000000000001'$q$, 1, 'X ve su propio documento en B');
select pg_temp.expect_count($q$select 1 from public.documents where club_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 0, 'X (entrenador) no ve documentos médicos de A');
select pg_temp.expect_count($q$select 1 from public.clubs where id in ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002')$q$, 2, 'X ve sus dos planteles');
select pg_temp.expect_no_rows($q$update public.injuries set severity = 'grave' where club_id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$, 'X (jugador en B) edita lesiones de B');
select pg_temp.back();

-- d. P tiene una membresía pendiente en B: ve la fila del club B y nada más de B.
select pg_temp.as_user('f2000000-0000-0000-0000-00000000000a');
select pg_temp.expect_count($q$select 1 from public.clubs where id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$, 1, 'P (pendiente en B) ve la fila de su club B');
select pg_temp.expect_count($q$select 1 from public.players where club_id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$, 0, 'P no ve jugadores de B');
select pg_temp.expect_count($q$select 1 from public.injuries where club_id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$, 0, 'P no ve lesiones de B');
select pg_temp.expect_count($q$select 1 from public.injury_phases where club_id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$, 0, 'P no ve fases de B');
select pg_temp.expect_count($q$select 1 from public.documents where club_id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$, 0, 'P no ve documentos de B');
select pg_temp.expect_count($q$select 1 from public.events where club_id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$, 0, 'P no ve eventos de B');
select pg_temp.expect_count($q$select 1 from public.availability_log where club_id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$, 0, 'P no ve el historial de B');
select pg_temp.expect_count($q$select 1 from public.profiles where club_id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$, 0, 'P no ve perfiles de B');
select pg_temp.expect_count($q$select 1 from public.club_members where club_id = 'bbbbbbbb-0000-0000-0000-000000000002'
  and user_id <> 'f2000000-0000-0000-0000-00000000000a'$q$, 0, 'P no ve membresías de otros en B');
select pg_temp.expect_count($q$select 1 from public.club_members where user_id = 'f2000000-0000-0000-0000-00000000000a'$q$, 2, 'P ve sus dos membresías');
select pg_temp.back();

-- e. club_members: la dirección ve las pendientes de su club; el resto solo las confirmadas.
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');   -- head coach A
select pg_temp.expect_count($q$select 1 from public.club_members where user_id = 'f3000000-0000-0000-0000-00000000000a'
  and club_id = 'aaaaaaaa-0000-0000-0000-000000000001' and status = 'pendiente'$q$, 1, 'la dirección de A ve la membresía pendiente de Q');
select pg_temp.expect_count($q$select 1 from public.club_members where club_id = 'bbbbbbbb-0000-0000-0000-000000000002'
  and user_id <> '10000000-0000-0000-0000-00000000000a'$q$, 0, 'la dirección de A no ve membresías de B');
select pg_temp.back();
select pg_temp.as_user('f1000000-0000-0000-0000-00000000000a');   -- X: entrenador en A, no dirección
select pg_temp.expect_count($q$select 1 from public.club_members where club_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  and status <> 'confirmado'$q$, 0, 'un entrenador (no dirección) no ve membresías pendientes ni rechazadas');
select pg_temp.expect_count($q$select 1 where (select count(*) from public.club_members
  where club_id = 'aaaaaaaa-0000-0000-0000-000000000001' and status = 'confirmado') > 1$q$, 1, 'un entrenador ve las membresías confirmadas de su club');
select pg_temp.expect_count($q$select 1 from public.club_members where user_id = 'f1000000-0000-0000-0000-00000000000a'$q$, 2, 'X ve sus dos membresías');
select pg_temp.back();
select pg_temp.as_user('30000000-0000-0000-0000-00000000000b');   -- kine B: solo del club B
select pg_temp.expect_count($q$select 1 from public.club_members where club_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 0, 'un usuario de otro club no ve membresías de A');
select pg_temp.back();
select pg_temp.as_user('f3000000-0000-0000-0000-00000000000a');   -- Q: pendiente en A
select pg_temp.expect_count($q$select 1 from public.club_members$q$, 1, 'un pendiente ve solo su membresía');
select pg_temp.back();

-- f. Avatars: dueño, plantel compartido confirmado, dirección y rutas malformadas.
insert into storage.objects (bucket_id, name) values
  ('avatars', 'bbbbbbbb-0000-0000-0000-000000000002/60000000-0000-0000-0000-00000000000b/b1.jpg'),
  ('avatars', 'aaaaaaaa-0000-0000-0000-000000000001/30000000-0000-0000-0000-00000000000a/kine.jpg'),
  ('avatars', 'aaaaaaaa-0000-0000-0000-000000000001/f3000000-0000-0000-0000-00000000000a/q.jpg'),
  ('avatars', 'no-es-uuid/tampoco-uuid/raro.jpg');
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');   -- jugador A1 (solo club A)
select pg_temp.expect_count($q$select 1 from storage.objects where bucket_id = 'avatars' and name like '%/60000000-0000-0000-0000-00000000000b/b1.jpg'$q$, 0, 'sin plantel compartido no se lee el avatar de otro');
select pg_temp.expect_count($q$select 1 from storage.objects where bucket_id = 'avatars' and name like '%/30000000-0000-0000-0000-00000000000a/kine.jpg'$q$, 1, 'con plantel compartido confirmado sí');
select pg_temp.expect_count($q$select 1 from storage.objects where bucket_id = 'avatars' and name like '%/f3000000-0000-0000-0000-00000000000a/q.jpg'$q$, 0, 'un jugador no ve el avatar de un pendiente');
select pg_temp.expect_count($q$select 1 from storage.objects where bucket_id = 'avatars' and name = 'no-es-uuid/tampoco-uuid/raro.jpg'$q$, 0, 'una ruta sin uuid queda denegada sin error');
select pg_temp.back();
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');   -- head coach A
select pg_temp.expect_count($q$select 1 from storage.objects where bucket_id = 'avatars' and name like '%/f3000000-0000-0000-0000-00000000000a/q.jpg'$q$, 1, 'la dirección lee el avatar de un pendiente de su plantel');
select pg_temp.back();
select pg_temp.as_user('f3000000-0000-0000-0000-00000000000a');   -- Q (pendiente): su propio avatar
select pg_temp.expect_count($q$select 1 from storage.objects where bucket_id = 'avatars' and name like '%/f3000000-0000-0000-0000-00000000000a/q.jpg'$q$, 1, 'el dueño siempre lee su avatar');
select pg_temp.expect_fail($q$insert into storage.objects (bucket_id, name) values ('avatars', 'no-es-uuid/f3000000-0000-0000-0000-00000000000a/x.jpg')$q$, 'subir a una carpeta de club sin uuid');
select pg_temp.back();

-- g. anon no accede a nada nuevo; permisos de los helpers iguales a sus pares.
select pg_temp.as_anon();
select pg_temp.expect_count($q$select 1 from public.club_members$q$, 0, 'anónimo no lee club_members');
select pg_temp.expect_count($q$select 1 from storage.objects where bucket_id = 'avatars'$q$, 0, 'anónimo no lee avatars');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private' and p.oid in ('private.safe_uuid(text)'::regprocedure, 'private.is_member(uuid)'::regprocedure,
    'private.is_confirmed_member(uuid)'::regprocedure, 'private.has_role(uuid, public.user_role)'::regprocedure,
    'private.is_staff(uuid)'::regprocedure, 'private.is_direction(uuid)'::regprocedure, 'private.has_kine_powers(uuid)'::regprocedure,
    'private.can_manage_nominas(uuid)'::regprocedure, 'private.can_view_documents(uuid)'::regprocedure,
    'private.current_player_id(uuid)'::regprocedure, 'private.can_see_member(uuid)'::regprocedure)
  and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('service_role', p.oid, 'EXECUTE'))$q$, 0, 'anon y service_role no ejecutan los helpers nuevos');
select pg_temp.expect_count($q$select 1 where has_function_privilege('authenticated', 'private.can_manage_nominas(uuid)', 'EXECUTE')
  or has_function_privilege('authenticated', 'private.can_manage_nominas()', 'EXECUTE')$q$, 0, 'can_manage_nominas (vieja y nueva) solo la ejecuta postgres');
select pg_temp.expect_count($q$select 1 from unnest(array['private.safe_uuid(text)', 'private.is_member(uuid)', 'private.is_confirmed_member(uuid)',
    'private.has_role(uuid, public.user_role)', 'private.is_staff(uuid)', 'private.is_direction(uuid)', 'private.has_kine_powers(uuid)',
    'private.can_view_documents(uuid)', 'private.current_player_id(uuid)', 'private.can_see_member(uuid)']) f
  where has_function_privilege('authenticated', f::regprocedure, 'EXECUTE')$q$, 10, 'authenticated ejecuta los 10 helpers que usan las políticas (como is_staff())');
select pg_temp.expect_count($q$select 1 from pg_proc where oid in ('private.current_club_id()'::regprocedure, 'private.member_club_id()'::regprocedure,
    'private.has_role(public.user_role)'::regprocedure, 'private.is_staff()'::regprocedure, 'private.is_direction()'::regprocedure,
    'private.has_kine_powers()'::regprocedure, 'private.can_manage_nominas()'::regprocedure, 'private.can_view_documents()'::regprocedure,
    'private.current_player_id()'::regprocedure)$q$, 9, 'los 9 helpers viejos siguen existiendo');

-- =======================================================================
-- Multi-plantel (0039): las funciones públicas escriben en club_members
-- =======================================================================
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

-- Datos ficticios: club C sin miembros de prueba, head coach del club B (HB) y cuentas nuevas.
insert into public.clubs (id, name, sport, slug) values ('cccccccc-0000-0000-0000-000000000003', 'Club C', 'futbol', 'club-c');
insert into auth.users (id, email) values
  ('9b000000-0000-0000-0000-000000000001', 'hc-b@test.cl'),
  ('9a000000-0000-0000-0000-000000000001', 'multi-m1@test.cl'),
  ('9a000000-0000-0000-0000-000000000002', 'multi-m2@test.cl'),
  ('9a000000-0000-0000-0000-000000000003', 'multi-m3@test.cl'),
  ('9a000000-0000-0000-0000-000000000004', 'multi-m4@test.cl'),
  ('9a000000-0000-0000-0000-000000000011', 'solo-s1@test.cl'),
  ('9a000000-0000-0000-0000-000000000012', 'solo-s2@test.cl'),
  ('9a000000-0000-0000-0000-000000000013', 'solo-s3@test.cl');
insert into public.profiles (id, club_id, roles, full_name, status) values
  ('9b000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', '{head_coach}', 'Head Coach B', 'confirmado');
insert into public.club_members (user_id, club_id, roles, status) values
  ('9b000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', '{head_coach}', 'confirmado');

-- b. Un solo plantel, sin pasar p_club_id: todo funciona como antes.
select pg_temp.as_user('9a000000-0000-0000-0000-000000000011');   -- S1 se registra como jugador en A
select pg_temp.expect_ok($q$select public.register_member('club-a', 'jugador', 'Sole', 'Uno', 'Wing')$q$, 'S1 se registra como jugador');
select pg_temp.back();
select pg_temp.as_user('9a000000-0000-0000-0000-000000000012');   -- S2 se registra como staff en A
select pg_temp.expect_ok($q$select public.register_member('club-a', 'staff', 'Sara', 'Dos', null, null, null, null, 'nutricionista')$q$, 'S2 se registra como staff');
select pg_temp.back();
select pg_temp.as_user('9a000000-0000-0000-0000-000000000013');   -- S3 se registra como staff en A
select pg_temp.expect_ok($q$select public.register_member('club-a', 'staff', 'Simón', 'Tres', null, null, null, null, 'kinesiologo')$q$, 'S3 se registra como staff');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.profiles p join public.club_members m on m.user_id = p.id and m.club_id = p.club_id
  where p.id in ('9a000000-0000-0000-0000-000000000011', '9a000000-0000-0000-0000-000000000012', '9a000000-0000-0000-0000-000000000013')
    and p.club_id = 'aaaaaaaa-0000-0000-0000-000000000001' and p.status = 'pendiente' and m.status = 'pendiente'
    and m.roles = p.roles and m.requested_role is not distinct from p.requested_role$q$, 3, 'los registros crean perfil y membresía pendientes e iguales');
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');   -- head coach A
select pg_temp.expect_ok($q$select public.review_member('9a000000-0000-0000-0000-000000000011', 'confirmar')$q$, 'head coach A confirma a S1 (jugador)');
select pg_temp.expect_ok($q$select public.review_member('9a000000-0000-0000-0000-000000000012', 'rechazar')$q$, 'head coach A rechaza a S2');
select pg_temp.expect_ok($q$select public.review_member('9a000000-0000-0000-0000-000000000013', 'confirmar')$q$, 'head coach A confirma a S3 con el puesto pedido');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.club_members m join public.profiles p on p.id = m.user_id
  join public.players pl on pl.user_id = m.user_id and pl.club_id = m.club_id
  where m.user_id = '9a000000-0000-0000-0000-000000000011' and m.status = 'confirmado' and p.status = 'confirmado' and pl.status = 'confirmado'$q$, 1, 'S1 queda confirmado en membresía, perfil y ficha');
select pg_temp.expect_count($q$select 1 from public.club_members m join public.profiles p on p.id = m.user_id
  where m.user_id = '9a000000-0000-0000-0000-000000000012' and m.status = 'rechazado' and m.roles = '{}' and p.status = 'rechazado'$q$, 1, 'S2 queda rechazado en membresía y perfil');
select pg_temp.expect_count($q$select 1 from public.club_members m join public.profiles p on p.id = m.user_id
  where m.user_id = '9a000000-0000-0000-0000-000000000013' and m.roles = '{kinesiologo}' and p.roles = '{kinesiologo}' and p.status = 'confirmado'$q$, 1, 'S3 queda confirmado como kinesiólogo');
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.set_staff_roles('9a000000-0000-0000-0000-000000000013', array['entrenador']::public.user_role[])$q$, 'head coach A cambia el rol de S3');
select pg_temp.expect_count($q$select 1 from public.profiles where id = '9a000000-0000-0000-0000-000000000013' and roles = '{entrenador}'$q$, 1, 'el rol nuevo se ve en el perfil');
select pg_temp.expect_ok($q$select public.set_kine_delegate('9a000000-0000-0000-0000-000000000013')$q$, 'head coach A delega kinesiología en S3');
select pg_temp.expect_ok($q$select public.set_nomina_delegate('9a000000-0000-0000-0000-000000000013')$q$, 'head coach A delega nóminas en S3');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.clubs where id = 'aaaaaaaa-0000-0000-0000-000000000001'
  and kine_delegate_id = '9a000000-0000-0000-0000-000000000013' and nomina_delegate_id = '9a000000-0000-0000-0000-000000000013'$q$, 1, 'S3 es delegado de kinesiología y de nóminas en A');
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.set_staff_roles('9a000000-0000-0000-0000-000000000013', array[]::public.user_role[])$q$, 'head coach A saca a S3 del staff');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.clubs where id = 'aaaaaaaa-0000-0000-0000-000000000001'
  and kine_delegate_id is null and nomina_delegate_id is null$q$, 1, 'sacar a S3 limpia sus dos delegaciones');
select pg_temp.expect_count($q$select 1 from public.profiles where id = '9a000000-0000-0000-0000-000000000013' and status = 'rechazado' and roles = '{}'$q$, 1, 'S3 queda rechazado');
select pg_temp.as_user('9a000000-0000-0000-0000-000000000011');   -- S1
select pg_temp.expect_ok($q$select public.update_my_profile('Sole', 'Uno Dos', 'Centro', null, 170, 70)$q$, 'S1 edita su perfil sin p_club_id');
select pg_temp.expect_ok($q$insert into storage.objects (bucket_id, name)
  values ('avatars', 'aaaaaaaa-0000-0000-0000-000000000001/9a000000-0000-0000-0000-000000000011/s1.jpg')$q$, 'S1 sube su foto');
select pg_temp.expect_ok($q$select public.set_my_avatar('aaaaaaaa-0000-0000-0000-000000000001/9a000000-0000-0000-0000-000000000011/s1.jpg')$q$, 'S1 fija su foto sin p_club_id');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.profiles p join public.players pl on pl.user_id = p.id
  where p.id = '9a000000-0000-0000-0000-000000000011' and p.full_name = 'Sole Uno Dos' and pl.full_name = 'Sole Uno Dos'
    and pl.position = 'Centro' and pl.height_cm = 170 and pl.weight_kg = 70
    and p.avatar_path = 'aaaaaaaa-0000-0000-0000-000000000001/9a000000-0000-0000-0000-000000000011/s1.jpg'$q$, 1, 'perfil, ficha y foto de S1 quedaron guardados');

-- c. Segundo plantel como jugador: M1 (jugador confirmado en A) se registra en B.
select pg_temp.as_user('9a000000-0000-0000-0000-000000000001');
select pg_temp.expect_ok($q$select public.register_member('club-a', 'jugador', 'Mara', 'Uno', 'Pilar')$q$, 'M1 se registra en A');
select pg_temp.back();
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.review_member('9a000000-0000-0000-0000-000000000001', 'confirmar')$q$, 'head coach A confirma a M1');
select pg_temp.back();
select pg_temp.as_user('9a000000-0000-0000-0000-000000000001');
select pg_temp.expect_ok($q$select public.register_member('club-b', 'jugador', 'Otro', 'Nombre', 'Portero')$q$, 'M1 se registra como jugador en B');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.profiles where id = '9a000000-0000-0000-0000-000000000001'
  and full_name = 'Mara Uno' and club_id = 'aaaaaaaa-0000-0000-0000-000000000001' and status = 'confirmado' and roles = '{jugador}'$q$, 1, 'el perfil de M1 no cambia (nombre, club_id, estado)');
select pg_temp.expect_count($q$select 1 from public.club_members where user_id = '9a000000-0000-0000-0000-000000000001'
  and club_id = 'bbbbbbbb-0000-0000-0000-000000000002' and status = 'pendiente' and roles = '{jugador}'$q$, 1, 'M1 queda con membresía pendiente en B');
select pg_temp.expect_count($q$select 1 from public.players where user_id = '9a000000-0000-0000-0000-000000000001'
  and club_id = 'bbbbbbbb-0000-0000-0000-000000000002' and status = 'pendiente' and position = 'Portero'$q$, 1, 'M1 tiene ficha pendiente en B');
select pg_temp.expect_count($q$select 1 from public.club_members m join public.players pl on pl.user_id = m.user_id and pl.club_id = m.club_id
  where m.user_id = '9a000000-0000-0000-0000-000000000001' and m.club_id = 'aaaaaaaa-0000-0000-0000-000000000001'
    and m.status = 'confirmado' and pl.status = 'confirmado' and pl.position = 'Pilar' and pl.full_name = 'Mara Uno'$q$, 1, 'la membresía y la ficha de M1 en A quedan intactas');

-- d. Segundo plantel como staff: M2 (entrenador confirmado en A) pide ser kinesiólogo en B.
select pg_temp.as_user('9a000000-0000-0000-0000-000000000002');
select pg_temp.expect_ok($q$select public.register_member('club-a', 'staff', 'Marta', 'Dos', null, null, null, null, 'entrenador')$q$, 'M2 se registra en A');
select pg_temp.back();
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.review_member('9a000000-0000-0000-0000-000000000002', 'confirmar')$q$, 'head coach A confirma a M2');
select pg_temp.back();
select pg_temp.as_user('9a000000-0000-0000-0000-000000000002');
select pg_temp.expect_ok($q$select public.register_member('club-b', 'staff', 'Otra', 'Persona', null, null, null, null, 'kinesiologo')$q$, 'M2 se registra como staff en B');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.profiles where id = '9a000000-0000-0000-0000-000000000002'
  and full_name = 'Marta Dos' and club_id = 'aaaaaaaa-0000-0000-0000-000000000001' and status = 'confirmado'
  and roles = '{entrenador}' and requested_role = 'entrenador'$q$, 1, 'el perfil de M2 no cambia');
select pg_temp.expect_count($q$select 1 from public.club_members where user_id = '9a000000-0000-0000-0000-000000000002'
  and club_id = 'bbbbbbbb-0000-0000-0000-000000000002' and status = 'pendiente' and roles = '{}' and requested_role = 'kinesiologo'$q$, 1, 'M2 queda pendiente en B con el puesto pedido');
select pg_temp.expect_count($q$select 1 from public.players where user_id = '9a000000-0000-0000-0000-000000000002'$q$, 0, 'el staff no tiene ficha de jugador');
select pg_temp.expect_count($q$select 1 from public.club_members where user_id = '9a000000-0000-0000-0000-000000000002'
  and club_id = 'aaaaaaaa-0000-0000-0000-000000000001' and status = 'confirmado' and roles = '{entrenador}'$q$, 1, 'la membresía de M2 en A queda intacta');

-- e. Registro duplicado en el mismo plantel: mensaje nuevo.
select pg_temp.as_user('9a000000-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$select public.register_member('club-b', 'jugador', 'Otro', 'Nombre', 'Portero')$q$,
  'Ya tienes una solicitud o una cuenta en este plantel', 'M1 se registra dos veces en B');
select pg_temp.expect_error($q$select public.register_member('club-a', 'staff', 'Mara', 'Uno', null, null, null, null, 'entrenador')$q$,
  'Ya tienes una solicitud o una cuenta en este plantel', 'M1 se registra otra vez en A (como staff)');
select pg_temp.back();

-- f. review_member en B.
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');   -- head coach A
select pg_temp.expect_error($q$select public.review_member('9a000000-0000-0000-0000-000000000002', 'confirmar', null, 'bbbbbbbb-0000-0000-0000-000000000002')$q$,
  'No tienes permiso para esta acción', 'la dirección de A revisa en B pasando p_club_id');
select pg_temp.expect_error($q$select public.review_member('9b000000-0000-0000-0000-000000000001', 'confirmar', null, 'aaaaaaaa-0000-0000-0000-000000000001')$q$,
  'Perfil no encontrado', 'la dirección de A revisa en A a alguien que solo está en B');
select pg_temp.back();
select pg_temp.as_user('9b000000-0000-0000-0000-000000000001');   -- head coach B
select pg_temp.expect_ok($q$select public.review_member('9a000000-0000-0000-0000-000000000001', 'confirmar')$q$, 'la dirección de B confirma a M1');
select pg_temp.expect_ok($q$select public.review_member('9a000000-0000-0000-0000-000000000002', 'rechazar')$q$, 'la dirección de B rechaza a M2');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.club_members m join public.players pl on pl.user_id = m.user_id and pl.club_id = m.club_id
  where m.user_id = '9a000000-0000-0000-0000-000000000001' and m.club_id = 'bbbbbbbb-0000-0000-0000-000000000002'
    and m.status = 'confirmado' and pl.status = 'confirmado'$q$, 1, 'M1 queda confirmado en B (membresía y ficha)');
select pg_temp.expect_count($q$select 1 from public.club_members where user_id = '9a000000-0000-0000-0000-000000000002'
  and club_id = 'bbbbbbbb-0000-0000-0000-000000000002' and status = 'rechazado' and roles = '{}'$q$, 1, 'M2 queda rechazado en B');
select pg_temp.expect_count($q$select 1 from public.club_members m join public.profiles p on p.id = m.user_id
  where m.club_id = 'aaaaaaaa-0000-0000-0000-000000000001' and m.status = 'confirmado' and p.status = 'confirmado'
    and m.user_id in ('9a000000-0000-0000-0000-000000000001', '9a000000-0000-0000-0000-000000000002')$q$, 2, 'revisar en B no toca A ni el perfil');
select pg_temp.expect_count($q$select 1 from public.players where user_id = '9a000000-0000-0000-0000-000000000001'
  and club_id = 'aaaaaaaa-0000-0000-0000-000000000001' and status = 'confirmado'$q$, 1, 'la ficha de M1 en A sigue confirmada');

-- g. Delegados: M4 (perfil en A) es staff confirmado en B y puede ser delegado de B.
select pg_temp.as_user('9a000000-0000-0000-0000-000000000004');
select pg_temp.expect_ok($q$select public.register_member('club-a', 'staff', 'Mateo', 'Cuatro', null, null, null, null, 'entrenador')$q$, 'M4 se registra en A');
select pg_temp.back();
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select pg_temp.expect_ok($q$select public.review_member('9a000000-0000-0000-0000-000000000004', 'confirmar')$q$, 'head coach A confirma a M4');
select pg_temp.expect_ok($q$select public.set_nomina_delegate('9a000000-0000-0000-0000-000000000004')$q$, 'head coach A delega nóminas en M4 (en A)');
select pg_temp.back();
select pg_temp.as_user('9a000000-0000-0000-0000-000000000004');
select pg_temp.expect_ok($q$select public.register_member('club-b', 'staff', 'Mateo', 'Cuatro', null, null, null, null, 'kinesiologo')$q$, 'M4 se registra en B');
select pg_temp.back();
select pg_temp.as_user('9b000000-0000-0000-0000-000000000001');   -- head coach B
select pg_temp.expect_ok($q$select public.review_member('9a000000-0000-0000-0000-000000000004', 'confirmar')$q$, 'la dirección de B confirma a M4');
select pg_temp.expect_ok($q$select public.set_kine_delegate('9a000000-0000-0000-0000-000000000004')$q$, 'la dirección de B delega kinesiología en M4');
select pg_temp.expect_ok($q$select public.set_nomina_delegate('9a000000-0000-0000-0000-000000000004')$q$, 'la dirección de B delega nóminas en M4');
select pg_temp.expect_error($q$select public.set_kine_delegate('40000000-0000-0000-0000-00000000000a')$q$,
  'La persona debe ser parte del staff confirmado', 'delegar kinesiología en alguien que no es de B');
select pg_temp.expect_error($q$select public.set_nomina_delegate('40000000-0000-0000-0000-00000000000a')$q$,
  'La persona debe ser parte del staff confirmado', 'delegar nóminas en alguien que no es de B');
select pg_temp.expect_error($q$select public.set_kine_delegate('9a000000-0000-0000-0000-000000000001')$q$,
  'La persona debe ser parte del staff confirmado', 'delegar kinesiología en un jugador de B');
select pg_temp.expect_error($q$select public.set_nomina_delegate('9a000000-0000-0000-0000-000000000001')$q$,
  'La persona debe ser parte del staff confirmado', 'delegar nóminas en un jugador de B');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.clubs c join public.profiles p on p.id = c.kine_delegate_id
  where c.id = 'bbbbbbbb-0000-0000-0000-000000000002' and c.nomina_delegate_id = p.id
    and p.id = '9a000000-0000-0000-0000-000000000004' and p.club_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 1, 'M4 (perfil en A) es delegado de kinesiología y nóminas en B');
select pg_temp.expect_fail($q$update public.clubs set kine_delegate_id = '40000000-0000-0000-0000-00000000000a'
  where id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$, 'FK: delegado de kinesiología sin membresía en B');
select pg_temp.expect_fail($q$update public.clubs set nomina_delegate_id = '40000000-0000-0000-0000-00000000000a'
  where id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$, 'FK: delegado de nóminas sin membresía en B');

-- h. set_staff_roles con '{}' en B: rechazado en B, sin delegaciones en B, A intacto.
select pg_temp.as_user('9b000000-0000-0000-0000-000000000001');
select pg_temp.expect_ok($q$select public.set_staff_roles('9a000000-0000-0000-0000-000000000004', array[]::public.user_role[])$q$, 'la dirección de B saca a M4 del staff');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.club_members where user_id = '9a000000-0000-0000-0000-000000000004'
  and club_id = 'bbbbbbbb-0000-0000-0000-000000000002' and status = 'rechazado' and roles = '{}'$q$, 1, 'M4 queda rechazado en B');
select pg_temp.expect_count($q$select 1 from public.clubs where id = 'bbbbbbbb-0000-0000-0000-000000000002'
  and kine_delegate_id is null and nomina_delegate_id is null$q$, 1, 'B queda sin delegado de kinesiología ni de nóminas');
select pg_temp.expect_count($q$select 1 from public.club_members m join public.profiles p on p.id = m.user_id
  where m.user_id = '9a000000-0000-0000-0000-000000000004' and m.club_id = 'aaaaaaaa-0000-0000-0000-000000000001'
    and m.status = 'confirmado' and m.roles = '{entrenador}' and p.status = 'confirmado' and p.roles = '{entrenador}'$q$, 1, 'M4 sigue confirmado en A');
select pg_temp.expect_count($q$select 1 from public.clubs where id = 'aaaaaaaa-0000-0000-0000-000000000001'
  and nomina_delegate_id = '9a000000-0000-0000-0000-000000000004'$q$, 1, 'M4 sigue siendo delegado de nóminas en A');

-- i. update_my_profile con p_club_id = B.
select pg_temp.as_user('9a000000-0000-0000-0000-000000000001');
select pg_temp.expect_ok($q$select public.update_my_profile('Mara', 'Nueva', 'Defensa central', null, 180, 75, 'bbbbbbbb-0000-0000-0000-000000000002')$q$, 'M1 edita su perfil en B');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.players where user_id = '9a000000-0000-0000-0000-000000000001'
  and club_id = 'bbbbbbbb-0000-0000-0000-000000000002' and position = 'Defensa central' and height_cm = 180 and weight_kg = 75$q$, 1, 'posición, altura y peso cambian en la ficha de B');
select pg_temp.expect_count($q$select 1 from public.players where user_id = '9a000000-0000-0000-0000-000000000001'
  and club_id = 'aaaaaaaa-0000-0000-0000-000000000001' and position = 'Pilar' and height_cm is null and weight_kg is null$q$, 1, 'la ficha de A no cambia de posición, altura ni peso');
select pg_temp.expect_count($q$select 1 from public.players where user_id = '9a000000-0000-0000-0000-000000000001'
  and full_name = 'Mara Nueva' and first_name = 'Mara' and last_name = 'Nueva'$q$, 2, 'el nombre cambia en sus dos fichas');
select pg_temp.expect_count($q$select 1 from public.profiles where id = '9a000000-0000-0000-0000-000000000001' and full_name = 'Mara Nueva'$q$, 1, 'el nombre cambia en el perfil');

-- j. set_my_avatar con p_club_id: vale donde es miembro (aunque esté pendiente), no donde no lo es.
select pg_temp.as_user('9a000000-0000-0000-0000-000000000003');
select pg_temp.expect_ok($q$select public.register_member('club-a', 'jugador', 'Tomás', 'Tres', 'Hooker')$q$, 'M3 se registra en A');
select pg_temp.expect_ok($q$select public.register_member('club-b', 'jugador', 'Tomás', 'Tres', 'Portero')$q$, 'M3 se registra en B');
select pg_temp.expect_ok($q$insert into storage.objects (bucket_id, name)
  values ('avatars', 'bbbbbbbb-0000-0000-0000-000000000002/9a000000-0000-0000-0000-000000000003/m3.jpg')$q$, 'M3 (pendiente en B) sube su foto a la carpeta de B');
select pg_temp.expect_ok($q$select public.set_my_avatar('bbbbbbbb-0000-0000-0000-000000000002/9a000000-0000-0000-0000-000000000003/m3.jpg', 'bbbbbbbb-0000-0000-0000-000000000002')$q$, 'M3 fija su foto con p_club_id de B');
select pg_temp.expect_error($q$select public.set_my_avatar('cccccccc-0000-0000-0000-000000000003/9a000000-0000-0000-0000-000000000003/m3.jpg', 'cccccccc-0000-0000-0000-000000000003')$q$,
  'Debes estar registrado en un club', 'M3 fija una foto en un plantel donde no es miembro');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.profiles where id = '9a000000-0000-0000-0000-000000000003'
  and avatar_path = 'bbbbbbbb-0000-0000-0000-000000000002/9a000000-0000-0000-0000-000000000003/m3.jpg'$q$, 1, 'la foto de M3 quedó guardada');
select pg_temp.expect_fail($q$update public.profiles set avatar_path = 'bbbbbbbb-0000-0000-0000-000000000002/9a000000-0000-0000-0000-000000000001/m3.jpg'
  where id = '9a000000-0000-0000-0000-000000000003'$q$, 'la foto en la carpeta de otra persona no pasa el CHECK (0040)');
select pg_temp.expect_fail($q$update public.profiles set avatar_path = 'no-es-uuid/9a000000-0000-0000-0000-000000000003/m3.jpg'
  where id = '9a000000-0000-0000-0000-000000000003'$q$, 'la foto con una carpeta de plantel inválida no pasa el CHECK (0040)');

-- k. Espejo: el plantel principal se refleja en profiles; uno secundario no.
update public.club_members set roles = '{entrenador,nutricionista}'
 where user_id = '9a000000-0000-0000-0000-000000000004' and club_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.expect_count($q$select 1 from public.profiles where id = '9a000000-0000-0000-0000-000000000004' and roles = '{entrenador,nutricionista}'$q$, 1, 'un cambio en el plantel principal llega a profiles');
update public.club_members set status = 'rechazado', requested_role = 'kinesiologo'
 where user_id = '9a000000-0000-0000-0000-000000000001' and club_id = 'bbbbbbbb-0000-0000-0000-000000000002';
select pg_temp.expect_count($q$select 1 from public.profiles where id = '9a000000-0000-0000-0000-000000000001'
  and status = 'confirmado' and requested_role is null and roles = '{jugador}'$q$, 1, 'un cambio en un plantel secundario no toca profiles');

-- l. member_emails admite una fila por perfil y plantel.
insert into private.member_emails (profile_id, club_id) values
  ('9a000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('9a000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect_count($q$select 1 from private.member_emails where profile_id = '9a000000-0000-0000-0000-000000000001'$q$, 2, 'member_emails guarda (perfil, A) y (perfil, B)');

-- m. Permisos: anon y usuarios sin permiso no ejecutan las funciones.
select pg_temp.as_anon();
select pg_temp.expect_fail($q$select public.review_member('9a000000-0000-0000-0000-000000000003', 'confirmar')$q$, 'anónimo ejecuta review_member');
select pg_temp.expect_fail($q$select public.set_staff_roles('9a000000-0000-0000-0000-000000000002', '{entrenador}')$q$, 'anónimo ejecuta set_staff_roles');
select pg_temp.expect_fail($q$select public.set_kine_delegate(null)$q$, 'anónimo ejecuta set_kine_delegate');
select pg_temp.expect_fail($q$select public.set_nomina_delegate(null)$q$, 'anónimo ejecuta set_nomina_delegate');
select pg_temp.expect_fail($q$select public.set_my_avatar(null)$q$, 'anónimo ejecuta set_my_avatar');
select pg_temp.expect_fail($q$select public.update_my_profile('A', 'B')$q$, 'anónimo ejecuta update_my_profile');
select pg_temp.expect_fail($q$select public.register_member('club-a', 'jugador', 'A', 'B', 'Pilar')$q$, 'anónimo ejecuta register_member');
select pg_temp.back();
select pg_temp.as_user('9a000000-0000-0000-0000-000000000001');   -- M1, jugador en A y B
select pg_temp.expect_fail($q$select public.review_member('9a000000-0000-0000-0000-000000000003', 'confirmar', null, 'bbbbbbbb-0000-0000-0000-000000000002')$q$, 'un jugador revisa registros');
select pg_temp.expect_fail($q$select public.set_staff_roles('9a000000-0000-0000-0000-000000000004', '{entrenador}', 'aaaaaaaa-0000-0000-0000-000000000001')$q$, 'un jugador cambia roles');
select pg_temp.expect_fail($q$select public.set_kine_delegate(null, 'bbbbbbbb-0000-0000-0000-000000000002')$q$, 'un jugador cambia la delegación de kinesiología');
select pg_temp.expect_fail($q$select public.set_nomina_delegate(null, 'bbbbbbbb-0000-0000-0000-000000000002')$q$, 'un jugador cambia la delegación de nóminas');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(p.proacl) a
  where n.nspname = 'public' and p.proname in ('review_member', 'set_staff_roles', 'set_kine_delegate', 'set_nomina_delegate',
    'set_my_avatar', 'update_my_profile', 'register_member')
    and (a.grantee = 0 or a.grantee = 'anon'::regrole)$q$, 0, 'ninguna de las 7 funciones da permisos a PUBLIC ni a anon');
select pg_temp.expect_count($q$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('review_member', 'set_staff_roles', 'set_kine_delegate', 'set_nomina_delegate',
    'set_my_avatar', 'update_my_profile', 'register_member')
    and has_function_privilege('authenticated', p.oid, 'EXECUTE') and has_function_privilege('service_role', p.oid, 'EXECUTE')
    and p.prosecdef and p.proconfig = array['search_path=""']$q$, 7, 'las 7 funciones: una sola firma cada una, authenticated y service_role, SECURITY DEFINER');
select pg_temp.expect_count($q$select 1 where has_function_privilege('authenticated', 'private.resolve_club(uuid)', 'EXECUTE')
  or has_function_privilege('anon', 'private.resolve_club(uuid)', 'EXECUTE')
  or has_function_privilege('authenticated', 'private.mirror_member_to_profile()', 'EXECUTE')$q$, 0, 'la app no ejecuta resolve_club ni la función del espejo');

rollback;
