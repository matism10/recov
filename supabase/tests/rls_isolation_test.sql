-- Recov · Test de aislamiento entre clubes y de permisos por rol
-- Correr en el SQL Editor de Supabase DESPUÉS de las migraciones 0001, 0002 y 0003.
-- Todo ocurre dentro de una transacción que termina en ROLLBACK: no deja datos.
-- Si algo falla, lanza una excepción que empieza con "FAIL".

begin;

-- Datos de prueba (como postgres) ------------------------------------
insert into public.clubs (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Club A'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Club B');

insert into auth.users (id, email) values
  ('a1000000-0000-0000-0000-000000000001', 'kine-a@test.cl'),
  ('a2000000-0000-0000-0000-000000000002', 'coach-a@test.cl'),
  ('a3000000-0000-0000-0000-000000000003', 'admin-a@test.cl'),
  ('a4000000-0000-0000-0000-000000000004', 'jugador-a1@test.cl'),
  ('b1000000-0000-0000-0000-000000000001', 'kine-b@test.cl'),
  ('b2000000-0000-0000-0000-000000000002', 'jugador-b1@test.cl');

insert into public.profiles (id, club_id, roles, full_name) values
  ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '{kinesiologo}', 'Kine A'),
  ('a2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '{entrenador}',  'Coach A'),
  ('a3000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', '{admin}',       'Admin A'),
  ('a4000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', '{jugador}',     'Jugador A1'),
  ('b1000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', '{kinesiologo}', 'Kine B'),
  ('b2000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', '{jugador}',     'Jugador B1');

insert into public.players (id, club_id, full_name, user_id) values
  ('a0000000-1111-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Jugador A1', 'a4000000-0000-0000-0000-000000000004'),
  ('a0000000-1111-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Jugador A2', null),
  ('b0000000-1111-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Jugador B1', 'b2000000-0000-0000-0000-000000000002');

insert into public.injuries (id, club_id, player_id, type, severity) values
  ('a0000000-2222-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'a0000000-1111-0000-0000-000000000001', 'Esguince', 'leve'),
  ('b0000000-2222-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'b0000000-1111-0000-0000-000000000001', 'Esguince', 'leve');

insert into public.injury_phases (club_id, injury_id, name, position) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a0000000-2222-0000-0000-000000000001', 'Reposo', 1);

insert into public.documents (club_id, player_id, storage_path, file_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a0000000-1111-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000001/a0000000-1111-0000-0000-000000000002/informe.pdf', 'informe.pdf'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b0000000-1111-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000002/b0000000-1111-0000-0000-000000000001/informe.pdf', 'informe.pdf');

-- Tests ---------------------------------------------------------------
do $$
declare
  n int;
  ok boolean;
  kine_a   uuid := 'a1000000-0000-0000-0000-000000000001';
  coach_a  uuid := 'a2000000-0000-0000-0000-000000000002';
  admin_a  uuid := 'a3000000-0000-0000-0000-000000000003';
  jug_a1   uuid := 'a4000000-0000-0000-0000-000000000004';
  jug_b1   uuid := 'b2000000-0000-0000-0000-000000000002';
  club_a   uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  club_b   uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  player_a1 uuid := 'a0000000-1111-0000-0000-000000000001';
  player_a2 uuid := 'a0000000-1111-0000-0000-000000000002';
  player_b1 uuid := 'b0000000-1111-0000-0000-000000000001';
begin
  ---------------------------------------------------------------- kine A
  perform set_config('request.jwt.claims', json_build_object('sub', kine_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.players;
  if n <> 2 then raise exception 'FAIL kine A: ve % jugadores (esperado 2)', n; end if;

  select count(*) into n from public.players where club_id = club_b;
  if n <> 0 then raise exception 'FAIL kine A: ve jugadores del club B'; end if;

  select count(*) into n from public.injuries where club_id = club_b;
  if n <> 0 then raise exception 'FAIL kine A: ve lesiones del club B'; end if;

  select count(*) into n from public.documents where club_id = club_b;
  if n <> 0 then raise exception 'FAIL kine A: ve documentos del club B'; end if;

  select count(*) into n from public.profiles where club_id = club_b;
  if n <> 0 then raise exception 'FAIL kine A: ve perfiles del club B'; end if;

  select count(*) into n from public.documents where club_id = club_a;
  if n <> 1 then raise exception 'FAIL kine A: no ve los documentos de su club (ve %)', n; end if;

  ok := false;
  begin
    insert into public.injuries (club_id, player_id, type, severity)
    values (club_b, player_b1, 'x', 'leve');
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL kine A: pudo insertar lesión en club B'; end if;

  ok := false;
  begin
    insert into public.injuries (club_id, player_id, type, severity)
    values (club_a, player_b1, 'x', 'leve');
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL kine A: cruzó una lesión de A con un jugador de B'; end if;

  insert into public.injuries (club_id, player_id, type, severity)
  values (club_a, player_a2, 'Rotura fibrilar', 'moderada');

  reset role;

  ------------------------------------------------------------ entrenador A
  perform set_config('request.jwt.claims', json_build_object('sub', coach_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.players;
  if n <> 2 then raise exception 'FAIL entrenador A: ve % jugadores (esperado 2)', n; end if;

  select count(*) into n from public.injuries where club_id = club_a;
  if n < 1 then raise exception 'FAIL entrenador A: no ve las lesiones de su club'; end if;

  select count(*) into n from public.documents;
  if n <> 0 then raise exception 'FAIL entrenador A: ve documentos médicos'; end if;

  ok := false;
  begin
    insert into public.injuries (club_id, player_id, type, severity)
    values (club_a, player_a2, 'x', 'leve');
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL entrenador A: pudo registrar una lesión'; end if;

  reset role;

  ----------------------------------------------------------- jugador A1
  perform set_config('request.jwt.claims', json_build_object('sub', jug_a1, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.players;
  if n <> 2 then raise exception 'FAIL jugador A1: ve % jugadores (esperado 2, el plantel)', n; end if;

  select count(*) into n from public.injuries;
  if n <> 0 then raise exception 'FAIL jugador A1: ve lesiones'; end if;

  select count(*) into n from public.injury_phases;
  if n <> 0 then raise exception 'FAIL jugador A1: ve fases de recuperación'; end if;

  select count(*) into n from public.documents;
  if n <> 0 then raise exception 'FAIL jugador A1: ve documentos ajenos (ve %)', n; end if;

  -- sube su propio documento: debe funcionar
  insert into public.documents (club_id, player_id, storage_path, file_name, uploaded_by)
  values (club_a, player_a1,
          club_a::text || '/' || player_a1::text || '/mio.pdf', 'mio.pdf', jug_a1);

  select count(*) into n from public.documents;
  if n <> 1 then raise exception 'FAIL jugador A1: debería ver solo su documento (ve %)', n; end if;

  -- documento a nombre de otro jugador: debe fallar
  ok := false;
  begin
    insert into public.documents (club_id, player_id, storage_path, file_name, uploaded_by)
    values (club_a, player_a2, club_a::text || '/' || player_a2::text || '/x.pdf', 'x.pdf', jug_a1);
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL jugador A1: subió documentos a nombre de otro jugador'; end if;

  -- documento ya "revisado": debe fallar
  ok := false;
  begin
    insert into public.documents (club_id, player_id, storage_path, file_name, status, uploaded_by)
    values (club_a, player_a1, club_a::text || '/' || player_a1::text || '/y.pdf', 'y.pdf', 'revisado', jug_a1);
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL jugador A1: se auto-revisó un documento'; end if;

  -- registrar lesión: debe fallar
  ok := false;
  begin
    insert into public.injuries (club_id, player_id, type, severity)
    values (club_a, player_a1, 'x', 'leve');
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL jugador A1: pudo registrar una lesión'; end if;

  -- cambiar disponibilidad: no debe afectar filas
  update public.players set availability = 'de_baja';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL jugador A1: modificó la disponibilidad de jugadores'; end if;

  -- cambiar estado de documentos: no debe afectar filas
  update public.documents set status = 'revisado';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL jugador A1: modificó documentos'; end if;

  reset role;

  ----------------------------------------------------------- jugador B1
  perform set_config('request.jwt.claims', json_build_object('sub', jug_b1, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.players;
  if n <> 1 then raise exception 'FAIL jugador B1: ve % jugadores (esperado 1)', n; end if;

  ok := false;
  begin
    insert into public.documents (club_id, player_id, storage_path, file_name, uploaded_by)
    values (club_a, player_a1, club_a::text || '/' || player_a1::text || '/z.pdf', 'z.pdf', jug_b1);
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL jugador B1: subió documentos al club A'; end if;

  reset role;

  ----------------------------------------------------------------- admin A
  perform set_config('request.jwt.claims', json_build_object('sub', admin_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  update public.profiles set full_name = 'hack' where club_id = club_b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL admin A: modificó perfiles del club B'; end if;

  insert into public.players (club_id, full_name) values (club_a, 'Jugador A3');

  ok := false;
  begin
    insert into public.players (club_id, full_name) values (club_b, 'Intruso');
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL admin A: creó un jugador en el club B'; end if;

  reset role;

  --------------------------------------------------------------------- anon
  set local role anon;
  ok := false;
  begin
    perform 1 from public.players limit 1;
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL anon: puede leer players'; end if;
  reset role;

  raise notice 'OK: aislamiento entre clubes y permisos por rol verificados (tablas)';
end $$;

-- Storage (bloque aparte: si falla acá y el anterior pasó, el problema es de Storage) ----
do $$
declare
  n int;
  ok boolean;
  jug_a1   uuid := 'a4000000-0000-0000-0000-000000000004';
  coach_a  uuid := 'a2000000-0000-0000-0000-000000000002';
  club_a   uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  player_a1 uuid := 'a0000000-1111-0000-0000-000000000001';
  player_a2 uuid := 'a0000000-1111-0000-0000-000000000002';
begin
  perform set_config('request.jwt.claims', json_build_object('sub', jug_a1, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- subir a su propia carpeta: debe funcionar
  insert into storage.objects (bucket_id, name)
  values ('medical-docs', club_a::text || '/' || player_a1::text || '/mio.pdf');

  -- subir a la carpeta de otro jugador: debe fallar por RLS
  ok := false;
  begin
    insert into storage.objects (bucket_id, name)
    values ('medical-docs', club_a::text || '/' || player_a2::text || '/ajeno.pdf');
  exception when sqlstate '42501' then ok := true; end;
  if not ok then raise exception 'FAIL storage: jugador A1 subió archivos a la carpeta de otro jugador'; end if;

  select count(*) into n from storage.objects where bucket_id = 'medical-docs';
  if n <> 1 then raise exception 'FAIL storage: jugador A1 ve % archivos (esperado 1)', n; end if;

  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', coach_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from storage.objects where bucket_id = 'medical-docs';
  if n <> 0 then raise exception 'FAIL storage: entrenador ve % archivos médicos', n; end if;

  reset role;

  raise notice 'OK: Storage verificado';
end $$;

rollback;