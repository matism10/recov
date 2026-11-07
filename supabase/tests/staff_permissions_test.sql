-- Recov · Test de permisos del staff (20261106120000, 121000 y 122000)
-- Roles por defecto sin cambios, ajustes por persona, co-head coach, head coach principal,
-- último head coach y aislamiento entre clubes. El cambio de posición va en la fase 2b.
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
begin
  execute 'reset role';
end $$;
create function pg_temp.expect_count(q text, expected int, label text) returns void language plpgsql as $$
declare n int;
begin
  execute 'select count(*) from (' || q || ') s' into n;
  if n <> expected then raise exception 'FAIL: % (esperado %, hay %)', label, expected, n; end if;
end $$;
create function pg_temp.expect_ok(q text, label text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    raise exception 'FAIL: % (debía funcionar y falló: %)', label, sqlerrm;
  end;
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
create function pg_temp.expect_eq(q text, expected text, label text) returns void language plpgsql as $$
declare got text;
begin
  execute q into got;
  if got is distinct from expected then raise exception 'FAIL: % (esperado %, llegó %)', label, expected, got; end if;
end $$;
-- Permisos efectivos de una persona (my_permissions, como esa persona).
create function pg_temp.perms_of(uid uuid) returns text language plpgsql as $$
declare v text;
begin
  perform pg_temp.as_user(uid);
  select array_to_string(public.my_permissions(), ',') into v;
  perform pg_temp.back();
  return v;
end $$;

-- =======================================================================
-- Datos ficticios: club A (rugby) con cada rol y club B (hockey).
-- =======================================================================
insert into public.clubs (id, name, sport, slug) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'Permisos A', 'rugby',  'permisos-a'),
  ('bbbbbbbb-0000-0000-0000-0000000000f1', 'Permisos B', 'hockey', 'permisos-b');
insert into auth.users (id, email) values
  ('f1000000-0000-0000-0000-000000000001', 'hc@perm.test'),
  ('f1000000-0000-0000-0000-000000000002', 'manager@perm.test'),
  ('f1000000-0000-0000-0000-000000000003', 'kine@perm.test'),
  ('f1000000-0000-0000-0000-000000000004', 'coach@perm.test'),
  ('f1000000-0000-0000-0000-000000000005', 'nutri@perm.test'),
  ('f1000000-0000-0000-0000-000000000006', 'pf@perm.test'),
  ('f1000000-0000-0000-0000-000000000007', 'jugador@perm.test'),
  ('f1000000-0000-0000-0000-000000000008', 'pend@perm.test'),
  ('f1000000-0000-0000-0000-000000000009', 'coach2@perm.test'),
  ('f2000000-0000-0000-0000-000000000001', 'hc-b@perm.test'),
  ('f2000000-0000-0000-0000-000000000002', 'coach-b@perm.test');
insert into public.profiles (id, full_name) select id, email from auth.users where email like '%@perm.test';
-- El primer head coach confirmado queda como principal (trigger).
insert into public.club_members (user_id, club_id, roles, status, requested_role) values
  ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000f1', '{head_coach}',        'confirmado', null),
  ('f1000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-0000000000f1', '{manager}',           'confirmado', null),
  ('f1000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-0000000000f1', '{kinesiologo}',       'confirmado', null),
  ('f1000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-0000000000f1', '{entrenador}',        'confirmado', null),
  ('f1000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-0000000000f1', '{nutricionista}',     'confirmado', null),
  ('f1000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-0000000000f1', '{preparador_fisico}', 'confirmado', null),
  ('f1000000-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-0000000000f1', '{jugador}',           'confirmado', null),
  ('f1000000-0000-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-0000000000f1', '{}',                  'pendiente',  'entrenador'),
  ('f1000000-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-0000000000f1', '{entrenador}',        'confirmado', null),
  ('f2000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-0000000000f1', '{head_coach}',        'confirmado', null),
  ('f2000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-0000000000f1', '{entrenador}',        'confirmado', null);
insert into public.players (id, club_id, full_name, position, status, user_id) values
  ('f1100000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'Jugador Uno', 'Pilar', 'confirmado', 'f1000000-0000-0000-0000-000000000007'),
  ('f1100000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'Jugador Dos', 'Wing',  'confirmado', null);
insert into public.injuries (club_id, player_id, type, severity) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'f1100000-0000-0000-0000-000000000002', 'Esguince', 'leve');

-- =======================================================================
-- 1. Roles por defecto: los mismos permisos que antes de esta fase.
-- =======================================================================
select pg_temp.expect_eq($q$select pg_temp.perms_of('f1000000-0000-0000-0000-000000000001')$q$,
  (select string_agg(key, ',' order by key) from private.permissions), 'head coach: todos los permisos');
select pg_temp.expect_eq($q$select pg_temp.perms_of('f1000000-0000-0000-0000-000000000002')$q$,
  'carga_ver,check_dias,eventos_cancelar,eventos_editar,lesiones_ver,lista_pasar,nomina_armar,participacion_cargar,registros_aprobar,sevens_activar,sevens_grupo,staff_gestionar',
  'manager: lo de hoy');
select pg_temp.expect_eq($q$select pg_temp.perms_of('f1000000-0000-0000-0000-000000000003')$q$,
  'carga_ver,disponibilidad_cambiar,documentos_ver,evaluaciones_cargar,lesionado_marcar,lesiones_revisar,lesiones_ver,lista_pasar,tests_catalogo',
  'kinesiólogo: lo de hoy');
select pg_temp.expect_eq($q$select pg_temp.perms_of('f1000000-0000-0000-0000-000000000004')$q$,
  'carga_ver,eventos_cancelar,eventos_editar,lesiones_ver,lista_pasar', 'entrenador: lo de hoy');
select pg_temp.expect_eq($q$select pg_temp.perms_of('f1000000-0000-0000-0000-000000000005')$q$,
  'carga_ver,lesiones_ver,lista_pasar', 'nutricionista: lo de hoy');
select pg_temp.expect_eq($q$select pg_temp.perms_of('f1000000-0000-0000-0000-000000000006')$q$,
  'carga_ver,check_dias,evaluaciones_cargar,gimnasio_planes,lesiones_ver,lista_pasar,tests_catalogo', 'preparador físico: lo de hoy');
select pg_temp.expect_eq($q$select pg_temp.perms_of('f1000000-0000-0000-0000-000000000007')$q$, '', 'jugador: sin permisos de staff');
select pg_temp.expect_eq($q$select pg_temp.perms_of('f1000000-0000-0000-0000-000000000008')$q$, '', 'staff pendiente: sin permisos');
-- Delegados: el entrenador delegado suma lo del kine (o de nóminas) y nada más.
update public.clubs set kine_delegate_id = 'f1000000-0000-0000-0000-000000000009',
                        nomina_delegate_id = 'f1000000-0000-0000-0000-000000000009'
 where id = 'aaaaaaaa-0000-0000-0000-0000000000f1';
select pg_temp.expect_eq($q$select pg_temp.perms_of('f1000000-0000-0000-0000-000000000009')$q$,
  'carga_ver,disponibilidad_cambiar,documentos_ver,eventos_cancelar,eventos_editar,lesionado_marcar,lesiones_revisar,lesiones_ver,lista_pasar,nomina_armar,participacion_cargar',
  'entrenador delegado (kine y nóminas)');
update public.clubs set kine_delegate_id = null, nomina_delegate_id = null where id = 'aaaaaaaa-0000-0000-0000-0000000000f1';
select pg_temp.expect_count($q$select 1 from public.club_members where club_id = 'aaaaaaaa-0000-0000-0000-0000000000f1' and is_principal
  and user_id = 'f1000000-0000-0000-0000-000000000001'$q$, 1, 'el primer head coach queda como principal');

-- Funciones con el rol de hoy: el entrenador no marca lesionados; el kine sí.
select pg_temp.as_user('f1000000-0000-0000-0000-000000000004');
select pg_temp.expect_fail($q$select public.mark_player_injured('f1100000-0000-0000-0000-000000000001', 'entrenamiento', 'Golpe en la rodilla')$q$, 'entrenador marca lesionado (sin ajuste)');
select pg_temp.back();

-- =======================================================================
-- 2. Ajustes por persona (solo el head coach).
-- =======================================================================
select pg_temp.as_user('f1000000-0000-0000-0000-000000000002');   -- manager
select pg_temp.expect_fail($q$select public.set_member_permission('f1000000-0000-0000-0000-000000000004', 'lesionado_marcar', true)$q$, 'el manager no edita permisos');
select pg_temp.expect_fail($q$select public.reset_member_permissions('f1000000-0000-0000-0000-000000000004')$q$, 'el manager no restablece permisos');
select pg_temp.expect_ok($q$select * from public.staff_permissions()$q$, 'el manager ve el detalle del staff');
select pg_temp.back();
select pg_temp.as_user('f1000000-0000-0000-0000-000000000004');   -- entrenador
select pg_temp.expect_fail($q$select * from public.staff_permissions()$q$, 'el entrenador no ve el detalle del staff');
select pg_temp.expect_fail($q$insert into public.member_permissions (club_id, user_id, perm, granted)
  values ('aaaaaaaa-0000-0000-0000-0000000000f1', 'f1000000-0000-0000-0000-000000000004', 'lesionado_marcar', true)$q$, 'escritura directa en member_permissions');
select pg_temp.back();

select pg_temp.as_user('f1000000-0000-0000-0000-000000000001');   -- head coach
select pg_temp.expect_ok($q$select public.set_member_permission('f1000000-0000-0000-0000-000000000004', 'lesionado_marcar', true)$q$, 'head coach da "marcar lesionado" al entrenador');
select pg_temp.expect_ok($q$select public.set_member_permission('f1000000-0000-0000-0000-000000000005', 'lesiones_ver', false)$q$, 'head coach quita "ver lesiones" a la nutricionista');
select pg_temp.expect_ok($q$select public.set_member_permission('f1000000-0000-0000-0000-000000000006', 'lista_pasar', true)$q$, 'igual a su rol: no guarda ajuste');
select pg_temp.expect_fail($q$select public.set_member_permission('f1000000-0000-0000-0000-000000000004', 'staff_gestionar', true)$q$, 'un permiso no delegable');
select pg_temp.expect_fail($q$select public.set_member_permission('f1000000-0000-0000-0000-000000000004', 'inventado', true)$q$, 'un permiso fuera del catálogo');
select pg_temp.expect_fail($q$select public.set_member_permission('f1000000-0000-0000-0000-000000000007', 'lesiones_ver', true)$q$, 'ajustes a un jugador');
select pg_temp.expect_fail($q$select public.set_member_permission('f1000000-0000-0000-0000-000000000004', 'lesiones_ver', null)$q$, 'ajuste nulo');
select pg_temp.expect_count($q$select 1 from public.staff_permissions() where user_id = 'f1000000-0000-0000-0000-000000000004'
  and 'lesionado_marcar' = any (perms) and not ('lesionado_marcar' = any (defaults)) and overrides = '{"lesionado_marcar": true}'$q$, 1,
  'el detalle muestra el ajuste ("Personalizado · 1 extra")');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.member_permissions where user_id = 'f1000000-0000-0000-0000-000000000006'$q$, 0, 'sin fila para el preparador físico');

select pg_temp.as_user('f1000000-0000-0000-0000-000000000004');   -- entrenador con el ajuste
select pg_temp.expect_ok($q$select public.mark_player_injured('f1100000-0000-0000-0000-000000000001', 'entrenamiento', 'Golpe en la rodilla')$q$, 'el entrenador ahora marca lesionado');
select pg_temp.expect_fail($q$select public.set_player_availability('f1100000-0000-0000-0000-000000000002', 'reintegro')$q$, 'solo ganó ese permiso (no cambia disponibilidad)');
select pg_temp.expect_count($q$select 1 from public.member_permissions$q$, 1, 'la persona ve sus propios ajustes');
select pg_temp.back();
select pg_temp.as_user('f1000000-0000-0000-0000-000000000005');   -- nutricionista sin "ver lesiones"
select pg_temp.expect_count($q$select 1 from public.injuries$q$, 0, 'sin "ver lesiones" no lee lesiones (RLS)');
select pg_temp.expect_fail($q$select * from public.dash_summary()$q$, 'sin "ver lesiones" no ve las métricas de lesiones');
select pg_temp.back();
select pg_temp.as_user('f1000000-0000-0000-0000-000000000003');   -- kine (control)
select pg_temp.expect_count($q$select 1 from public.injuries$q$, 2, 'el kine sigue viendo las lesiones');
select pg_temp.back();

-- Restablecer al rol: archiva (no borra).
select pg_temp.as_user('f1000000-0000-0000-0000-000000000001');
select pg_temp.expect_ok($q$select public.reset_member_permissions('f1000000-0000-0000-0000-000000000005')$q$, 'restablece a la nutricionista');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.member_permissions where user_id = 'f1000000-0000-0000-0000-000000000005' and archived_at is not null$q$, 1, 'el ajuste queda archivado');
select pg_temp.as_user('f1000000-0000-0000-0000-000000000005');
select pg_temp.expect_count($q$select 1 from public.injuries$q$, 2, 'restablecida, vuelve a ver lesiones');
select pg_temp.back();

-- =======================================================================
-- 3. Co-head coach, principal y último head coach.
-- =======================================================================
select pg_temp.as_user('f1000000-0000-0000-0000-000000000002');   -- manager
select pg_temp.expect_fail($q$select public.set_staff_roles('f1000000-0000-0000-0000-000000000004', '{entrenador,head_coach}')$q$, 'el manager no nombra head coach');
select pg_temp.expect_fail($q$select public.review_member('f1000000-0000-0000-0000-000000000008', 'confirmar', '{head_coach}')$q$, 'el manager no aprueba a alguien como head coach');
select pg_temp.expect_fail($q$select public.set_staff_roles('f1000000-0000-0000-0000-000000000001', '{manager}')$q$, 'el manager no degrada al principal');
select pg_temp.expect_ok($q$select public.set_staff_roles('f1000000-0000-0000-0000-000000000006', '{preparador_fisico,nutricionista}')$q$, 'el manager sigue cambiando roles de staff');
select pg_temp.back();

select pg_temp.as_user('f1000000-0000-0000-0000-000000000001');   -- principal
select pg_temp.expect_ok($q$select public.set_staff_roles('f1000000-0000-0000-0000-000000000004', '{entrenador,head_coach}')$q$, 'el principal nombra co-head coach al entrenador');
select pg_temp.expect_ok($q$select public.set_staff_roles('f1000000-0000-0000-0000-000000000009', '{head_coach}')$q$, 'el principal nombra un segundo co-head coach');
select pg_temp.expect_ok($q$select public.review_member('f1000000-0000-0000-0000-000000000008', 'confirmar', '{entrenador}')$q$, 'el head coach aprueba un registro');
select pg_temp.back();
select pg_temp.expect_eq($q$select pg_temp.perms_of('f1000000-0000-0000-0000-000000000004')$q$,
  (select string_agg(key, ',' order by key) from private.permissions), 'el co-head coach tiene los mismos permisos');
select pg_temp.expect_count($q$select 1 from public.club_members where club_id = 'aaaaaaaa-0000-0000-0000-0000000000f1' and is_principal$q$, 1, 'sigue habiendo un solo principal');

select pg_temp.as_user('f1000000-0000-0000-0000-000000000004');   -- co-head coach
select pg_temp.expect_ok($q$select public.set_member_permission('f1000000-0000-0000-0000-000000000005', 'eventos_editar', true)$q$, 'el co-head coach edita permisos');
select pg_temp.expect_fail($q$select public.set_staff_roles('f1000000-0000-0000-0000-000000000001', '{entrenador}')$q$, 'el co-head coach no degrada al principal');
select pg_temp.expect_fail($q$select public.set_staff_roles('f1000000-0000-0000-0000-000000000001', '{}')$q$, 'el co-head coach no quita al principal');
select pg_temp.expect_fail($q$select public.set_staff_roles('f1000000-0000-0000-0000-000000000009', '{entrenador}')$q$, 'un co-head coach no degrada a otro co-head coach');
select pg_temp.expect_fail($q$select public.set_staff_roles('f1000000-0000-0000-0000-000000000009', '{}')$q$, 'un co-head coach no quita a otro co-head coach');
select pg_temp.expect_fail($q$select public.set_member_permission('f1000000-0000-0000-0000-000000000009', 'lista_pasar', false)$q$, 'un head coach no tiene ajustes');
select pg_temp.back();

select pg_temp.as_user('f1000000-0000-0000-0000-000000000001');   -- principal
select pg_temp.expect_ok($q$select public.set_staff_roles('f1000000-0000-0000-0000-000000000009', '{entrenador}')$q$, 'el principal degrada a un co-head coach');
select pg_temp.expect_ok($q$select public.set_staff_roles('f1000000-0000-0000-0000-000000000004', '{}')$q$, 'el principal quita a un co-head coach del staff');
select pg_temp.expect_fail($q$select public.set_staff_roles('f1000000-0000-0000-0000-000000000001', '{entrenador}')$q$, 'el principal no se degrada a sí mismo');
select pg_temp.back();
select pg_temp.expect_count($q$select 1 from public.member_permissions where user_id = 'f1000000-0000-0000-0000-000000000004' and archived_at is null$q$, 0, 'quitar del staff archiva sus ajustes');

-- Nadie degrada al principal, ni por un update directo (trigger).
select pg_temp.expect_fail($q$update public.club_members set roles = '{entrenador}'
  where user_id = 'f1000000-0000-0000-0000-000000000001' and club_id = 'aaaaaaaa-0000-0000-0000-0000000000f1'$q$, 'update directo que degrada al principal');
select pg_temp.expect_fail($q$update public.club_members set is_principal = true
  where user_id = 'f1000000-0000-0000-0000-000000000002' and club_id = 'aaaaaaaa-0000-0000-0000-0000000000f1'$q$, 'un segundo principal o un principal que no es head coach');
-- Quitarle la marca de principal no deja al club sin principal: el trigger la repone.
update public.club_members set is_principal = false
 where user_id = 'f1000000-0000-0000-0000-000000000001' and club_id = 'aaaaaaaa-0000-0000-0000-0000000000f1';
select pg_temp.expect_count($q$select 1 from public.club_members where club_id = 'aaaaaaaa-0000-0000-0000-0000000000f1' and is_principal$q$, 1, 'el club sigue con su principal');

-- Último head coach: aun en un club sin principal (datos antiguos), nadie deja al club sin head coach.
alter table public.club_members disable trigger club_members_principal;
update public.club_members set is_principal = false where club_id = 'bbbbbbbb-0000-0000-0000-0000000000f1';
alter table public.club_members enable trigger club_members_principal;
select pg_temp.as_user('f2000000-0000-0000-0000-000000000001');   -- único head coach de B
select pg_temp.expect_fail($q$select public.set_staff_roles('f2000000-0000-0000-0000-000000000001', '{entrenador}', 'bbbbbbbb-0000-0000-0000-0000000000f1')$q$,
  'el único head coach no se degrada a sí mismo');
select pg_temp.back();
select pg_temp.expect_fail($q$select private.club_members_principal()$q$, 'la función del trigger no se llama directo');

-- =======================================================================
-- 4. Aislamiento entre clubes.
-- =======================================================================
select pg_temp.as_user('f1000000-0000-0000-0000-000000000001');   -- principal de A
select pg_temp.expect_fail($q$select public.set_member_permission('f2000000-0000-0000-0000-000000000002', 'lesiones_ver', false, 'bbbbbbbb-0000-0000-0000-0000000000f1')$q$, 'head coach de A edita permisos en B');
select pg_temp.expect_fail($q$select public.set_member_permission('f2000000-0000-0000-0000-000000000002', 'lesiones_ver', false)$q$, 'head coach de A edita a alguien de B');
select pg_temp.expect_fail($q$select * from public.staff_permissions('bbbbbbbb-0000-0000-0000-0000000000f1')$q$, 'head coach de A lee el staff de B');
select pg_temp.expect_count($q$select 1 from public.staff_permissions() where user_id::text like 'f2%'$q$, 0, 'el detalle de A no trae gente de B');
select pg_temp.expect_count($q$select 1 from public.member_permissions where club_id = 'bbbbbbbb-0000-0000-0000-0000000000f1'$q$, 0, 'A no lee ajustes de B');
select pg_temp.back();
select pg_temp.as_user('f2000000-0000-0000-0000-000000000002');   -- entrenador de B
select pg_temp.expect_count($q$select 1 from public.member_permissions where club_id = 'aaaaaaaa-0000-0000-0000-0000000000f1'$q$, 0, 'B no lee ajustes de A');
select pg_temp.expect_eq($q$select array_to_string(public.my_permissions(), ',')$q$, 'carga_ver,eventos_cancelar,eventos_editar,lesiones_ver,lista_pasar', 'B: sus permisos no cambian por ajustes de A');
select pg_temp.back();
select pg_temp.as_anon();
select pg_temp.expect_fail($q$select public.my_permissions()$q$, 'anónimo pide permisos');
select pg_temp.expect_fail($q$select 1 from public.member_permissions$q$, 'anónimo lee ajustes');
select pg_temp.back();

-- =======================================================================
-- 5. Permisos de las funciones.
-- =======================================================================
select pg_temp.expect_count($q$select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace
  and p.proname in ('my_permissions', 'staff_permissions', 'set_member_permission', 'reset_member_permissions')
  and p.prosecdef and p.proconfig = array['search_path=""']
  and has_function_privilege('authenticated', p.oid, 'EXECUTE') and not has_function_privilege('anon', p.oid, 'EXECUTE')$q$, 4,
  'las 4 funciones: SECURITY DEFINER, search_path vacío, authenticated sí y anon no');
select pg_temp.expect_count($q$select 1 where has_function_privilege('authenticated', 'private.member_has_perm(uuid, uuid, text)', 'EXECUTE')
  or has_function_privilege('authenticated', 'private.member_perm_default(uuid, uuid, text)', 'EXECUTE')
  or has_function_privilege('anon', 'private.has_perm(uuid, text)', 'EXECUTE')$q$, 0, 'los helpers por persona no los ejecuta la app');
select pg_temp.expect_count($q$select 1 where has_table_privilege('authenticated', 'public.member_permissions', 'INSERT')
  or has_table_privilege('authenticated', 'public.member_permissions', 'UPDATE')
  or has_table_privilege('authenticated', 'public.member_permissions', 'DELETE')$q$, 0, 'sin escritura directa en member_permissions');

select 'staff_permissions_test: OK' as resultado;
rollback;
