-- Recov · Test de aislamiento entre clubes (el POC)
-- Correr en el SQL editor de Supabase DESPUÉS de la migración 0001.
-- Todo ocurre dentro de una transacción que termina en ROLLBACK:
-- no deja datos. Si algo falla, lanza una excepción con "FAIL".

begin;

-- Datos de prueba (como postgres) ------------------------------------
insert into public.clubs (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Club A'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Club B');

insert into auth.users (id, email) values
  ('a1000000-0000-0000-0000-000000000001', 'kine-a@test.cl'),
  ('a2000000-0000-0000-0000-000000000002', 'coach-a@test.cl'),
  ('a3000000-0000-0000-0000-000000000003', 'admin-a@test.cl'),
  ('b1000000-0000-0000-0000-000000000001', 'kine-b@test.cl');

insert into public.profiles (id, club_id, roles, full_name) values
  ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '{kinesiologo}', 'Kine A'),
  ('a2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '{entrenador}',  'Coach A'),
  ('a3000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', '{admin}',       'Admin A'),
  ('b1000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', '{kinesiologo}', 'Kine B');

insert into public.players (id, club_id, full_name) values
  ('a0000000-1111-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Jugador A1'),
  ('a0000000-1111-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Jugador A2'),
  ('b0000000-1111-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Jugador B1');

insert into public.injuries (club_id, player_id, type, severity) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b0000000-1111-0000-0000-000000000001', 'Esguince', 'leve');

insert into public.documents (club_id, player_id, storage_path, file_name) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b0000000-1111-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000002/b0000000-1111-0000-0000-000000000001/informe.pdf', 'informe.pdf');

-- Tests ---------------------------------------------------------------
do $$
declare
  n int;
  kine_a  uuid := 'a1000000-0000-0000-0000-000000000001';
  coach_a uuid := 'a2000000-0000-0000-0000-000000000002';
  admin_a uuid := 'a3000000-0000-0000-0000-000000000003';
  club_a  uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  club_b  uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  ok boolean;
begin
  ---------------------------------------------------------------- kine A
  perform set_config('request.jwt.claims', json_build_object('sub', kine_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.players;
  if n <> 2 then raise exception 'FAIL 1: kine A ve % jugadores (esperado 2)', n; end if;

  select count(*) into n from public.players where club_id = club_b;
  if n <> 0 then raise exception 'FAIL 2: kine A ve jugadores del club B'; end if;

  select count(*) into n from public.injuries;
  if n <> 0 then raise exception 'FAIL 3: kine A ve lesiones del club B'; end if;

  select count(*) into n from public.documents;
  if n <> 0 then raise exception 'FAIL 4: kine A ve documentos del club B'; end if;

  select count(*) into n from public.profiles where club_id = club_b;
  if n <> 0 then raise exception 'FAIL 5: kine A ve perfiles del club B'; end if;

  -- escribir en el club B con club_id ajeno: debe fallar por RLS
  ok := false;
  begin
    insert into public.injuries (club_id, player_id, type, severity)
    values (club_b, 'b0000000-1111-0000-0000-000000000001', 'x', 'leve');
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL 6: kine A pudo insertar lesión en club B'; end if;

  -- club_id propio pero jugador del club B: debe fallar por FK compuesta
  ok := false;
  begin
    insert into public.injuries (club_id, player_id, type, severity)
    values (club_a, 'b0000000-1111-0000-0000-000000000001', 'x', 'leve');
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL 7: se pudo cruzar lesión de A con jugador de B'; end if;

  -- operación legítima sí debe funcionar
  insert into public.injuries (club_id, player_id, type, severity)
  values (club_a, 'a0000000-1111-0000-0000-000000000001', 'Rotura fibrilar', 'moderada');

  reset role;

  ------------------------------------------------------------ entrenador A
  perform set_config('request.jwt.claims', json_build_object('sub', coach_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.players;
  if n <> 2 then raise exception 'FAIL 8: entrenador A ve % jugadores (esperado 2)', n; end if;

  select count(*) into n from public.documents;
  if n <> 0 then raise exception 'FAIL 9: entrenador ve documentos médicos'; end if;

  ok := false;
  begin
    insert into public.injuries (club_id, player_id, type, severity)
    values (club_a, 'a0000000-1111-0000-0000-000000000002', 'x', 'leve');
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL 10: entrenador pudo registrar lesión'; end if;

  reset role;

  ----------------------------------------------------------------- admin A
  perform set_config('request.jwt.claims', json_build_object('sub', admin_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  update public.profiles set full_name = 'hack' where club_id = club_b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 11: admin A modificó perfiles del club B'; end if;

  insert into public.players (club_id, full_name) values (club_a, 'Jugador A3');

  ok := false;
  begin
    insert into public.players (club_id, full_name) values (club_b, 'Intruso');
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL 12: admin A creó jugador en club B'; end if;

  reset role;

  --------------------------------------------------------------------- anon
  set local role anon;
  ok := false;
  begin
    perform 1 from public.players limit 1;
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL 13: anon puede leer players'; end if;
  reset role;

  raise notice 'OK: aislamiento entre clubes verificado (13 chequeos)';
end $$;

rollback;
