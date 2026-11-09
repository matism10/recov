-- Recov · Test de aceptación legal (20261109120000). Datos ficticios. Termina en ROLLBACK.
-- Si algo falla, lanza un error que empieza con "FAIL".
begin;

create function pg_temp.as_user(uid uuid, club uuid default null) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', case when club is null then '' else json_build_object('x-club-id', club)::text end, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.back() returns void language plpgsql as $$
begin execute 'reset role'; end $$;
create function pg_temp.expect_fail(q text, label text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then return; end;
  raise exception 'FAIL: % (debía fallar y no falló)', label;
end $$;

insert into public.clubs (id, name, sport, slug) values
  ('aaaaaaaa-0000-0000-0000-0000000000e1', 'Legal A', 'rugby', 'legal-a'),
  ('bbbbbbbb-0000-0000-0000-0000000000e1', 'Legal B', 'hockey', 'legal-b');
insert into auth.users (id, email) values
  ('e1000000-0000-0000-0000-000000000001', 'hc@legal.test'),
  ('e1000000-0000-0000-0000-000000000002', 'manager@legal.test'),
  ('e1000000-0000-0000-0000-000000000003', 'jugador@legal.test'),
  ('e1000000-0000-0000-0000-000000000004', 'nuevo@legal.test'),
  ('e2000000-0000-0000-0000-000000000001', 'hc-b@legal.test');
insert into public.profiles (id, full_name)
  select id, email from auth.users where email in
  ('hc@legal.test','manager@legal.test','jugador@legal.test','hc-b@legal.test');
insert into public.club_members (user_id, club_id, roles, status) values
  ('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000e1', '{head_coach}', 'confirmado'),
  ('e1000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-0000000000e1', '{manager}',    'confirmado'),
  ('e1000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-0000000000e1', '{jugador}',    'confirmado'),
  ('e2000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-0000000000e1', '{head_coach}', 'confirmado');

-- 1. Cada persona acepta solo por sí misma.
select pg_temp.as_user('e1000000-0000-0000-0000-000000000003');
select public.accept_terms('2026-11-09');
select pg_temp.expect_fail($q$select public.accept_terms('x')$q$, 'versión inválida aceptada');
-- Sin escritura directa: el update no cambia ninguna fila.
do $$
declare n int;
begin
  update public.profiles set terms_accepted_at = null, terms_version = 'hack'
   where id = 'e1000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: update directo sobre otro perfil'; end if;
  update public.profiles set terms_version = 'hack' where id = 'e1000000-0000-0000-0000-000000000003';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: update directo sobre el propio perfil'; end if;
end $$;
select pg_temp.back();
do $$
begin
  if (select terms_version from public.profiles where id = 'e1000000-0000-0000-0000-000000000003') <> '2026-11-09'
     or (select terms_accepted_at from public.profiles where id = 'e1000000-0000-0000-0000-000000000003') is null then
    raise exception 'FAIL: el jugador no quedó con su aceptación';
  end if;
  if (select terms_accepted_at from public.profiles where id = 'e1000000-0000-0000-0000-000000000001') is not null then
    raise exception 'FAIL: el jugador aceptó por el head coach';
  end if;
end $$;

-- 2. Un jugador no puede declarar; tampoco escribir la columna directo.
select pg_temp.as_user('e1000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-0000000000e1');
select pg_temp.expect_fail($q$select public.declare_guardian_authorization()$q$, 'jugador declaró');
do $$
declare n int;
begin
  update public.clubs set guardian_declared_at = now() where id = 'aaaaaaaa-0000-0000-0000-0000000000e1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: update directo de clubs'; end if;
end $$;
select pg_temp.back();

-- 3. El head coach declara; idempotente.
select pg_temp.as_user('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000e1');
select public.declare_guardian_authorization();
select pg_temp.back();
do $$
declare t1 timestamptz;
begin
  select guardian_declared_at into t1 from public.clubs where id = 'aaaaaaaa-0000-0000-0000-0000000000e1';
  if t1 is null or (select guardian_declared_by from public.clubs where id = 'aaaaaaaa-0000-0000-0000-0000000000e1') <> 'e1000000-0000-0000-0000-000000000001' then
    raise exception 'FAIL: head coach no quedó como declarante';
  end if;
end $$;
select pg_temp.as_user('e1000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-0000000000e1');
select public.declare_guardian_authorization();  -- segunda vez, por el manager: no falla ni cambia nada
select pg_temp.back();
do $$
begin
  if (select guardian_declared_by from public.clubs where id = 'aaaaaaaa-0000-0000-0000-0000000000e1') <> 'e1000000-0000-0000-0000-000000000001' then
    raise exception 'FAIL: la segunda declaración cambió al declarante';
  end if;
end $$;

-- 4. Manager sí puede en un plantel nuevo (reinicia la declaración para probarlo).
update public.clubs set guardian_declared_at = null, guardian_declared_by = null where id = 'aaaaaaaa-0000-0000-0000-0000000000e1';
select pg_temp.as_user('e1000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-0000000000e1');
select public.declare_guardian_authorization();
select pg_temp.back();
do $$
begin
  if (select guardian_declared_by from public.clubs where id = 'aaaaaaaa-0000-0000-0000-0000000000e1') <> 'e1000000-0000-0000-0000-000000000002' then
    raise exception 'FAIL: el manager no pudo declarar';
  end if;
  -- 5. Otro plantel no se ve afectado.
  if (select guardian_declared_at from public.clubs where id = 'bbbbbbbb-0000-0000-0000-0000000000e1') is not null then
    raise exception 'FAIL: la declaración tocó otro plantel';
  end if;
end $$;
-- El head coach del plantel B no declara por el A (su plantel activo es B).
select pg_temp.as_user('e2000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-0000000000e1');
select public.declare_guardian_authorization();
select pg_temp.back();
do $$
begin
  if (select guardian_declared_by from public.clubs where id = 'aaaaaaaa-0000-0000-0000-0000000000e1') <> 'e1000000-0000-0000-0000-000000000002' then
    raise exception 'FAIL: head coach de B modificó el plantel A';
  end if;
  if (select guardian_declared_by from public.clubs where id = 'bbbbbbbb-0000-0000-0000-0000000000e1') <> 'e2000000-0000-0000-0000-000000000001' then
    raise exception 'FAIL: head coach de B no pudo declarar en B';
  end if;
end $$;

-- 6. Registro: exige aceptación y la guarda junto con el registro.
select pg_temp.as_user('e1000000-0000-0000-0000-000000000004');
select pg_temp.expect_fail($q$select public.register_member('legal-a','staff','Nueva','Persona',null,null,null,null,'entrenador')$q$, 'registro sin aceptación');
select public.register_member('legal-a','staff','Nueva','Persona',null,null,null,null,'entrenador','2026-11-09');
select pg_temp.back();
do $$
begin
  if (select terms_version from public.profiles where id = 'e1000000-0000-0000-0000-000000000004') <> '2026-11-09' then
    raise exception 'FAIL: el registro no guardó la aceptación';
  end if;
  if not exists (select 1 from public.club_members where user_id = 'e1000000-0000-0000-0000-000000000004' and status = 'pendiente') then
    raise exception 'FAIL: el registro no creó la membresía';
  end if;
end $$;
-- Una cuenta que ya aceptó puede unirse a otro plantel sin repetir la aceptación.
select pg_temp.as_user('e1000000-0000-0000-0000-000000000004');
select public.register_member('legal-b','staff','Nueva','Persona',null,null,null,null,'entrenador');
select pg_temp.back();

rollback;
