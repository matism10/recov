-- Endurecimiento de seguridad (20261116120000). Usa el club-demo; todo termina en ROLLBACK.
-- Kine/head coach: e270b9bf-…; jugador: 6cc84a4f-….
begin;

create or replace function pg_temp.expect_fail(q text, label text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then raise notice 'OK   %: %', label, sqlerrm; return; end;
  raise exception 'FAIL %: debía fallar', label;
end $$;
create or replace function pg_temp.expect_rows(q text, min_rows int, label text) returns void language plpgsql as $$
declare n int;
begin
  execute 'select count(*) from (' || q || ') s' into n;
  if n < min_rows then raise exception 'FAIL %: % filas', label, n; end if;
  raise notice 'OK   %: % filas', label, n;
end $$;
grant execute on function pg_temp.expect_fail(text, text) to public;
grant execute on function pg_temp.expect_rows(text, int, text) to public;

-- Kine
select set_config('request.jwt.claims', '{"sub":"e270b9bf-2197-442d-8c05-ed0367effbd6","role":"authenticated"}', true);
set local role authenticated;
select pg_temp.expect_rows('select id from public.injuries', 1, 'kine lee lesiones');
select pg_temp.expect_rows('select id from public.documents', 0, 'kine lee documentos');
select pg_temp.expect_rows('select * from public.squad_current_phases()', 0, 'kine: squad_current_phases');
select pg_temp.expect_rows('select * from public.dash_summary(''15'')', 1, 'kine: dash_summary con formato');
select pg_temp.expect_fail('delete from public.injuries', 'kine borra lesiones por API');
select pg_temp.expect_fail('delete from public.injury_phases', 'kine borra fases por API');
select pg_temp.expect_fail('delete from public.documents', 'kine borra documentos por API');
select pg_temp.expect_fail('update public.players set availability = ''disponible''', 'kine actualiza players directo');
select pg_temp.expect_fail('update public.injuries set severity = null', 'kine actualiza lesiones directo');
select pg_temp.expect_fail('insert into public.club_members(club_id, user_id) select club_id, user_id from public.club_members limit 1', 'insert directo en club_members');
reset role;

-- Jugador
select set_config('request.jwt.claims', '{"sub":"6cc84a4f-e223-45c0-a347-4482026b4255","role":"authenticated"}', true);
set local role authenticated;
select pg_temp.expect_rows('select id from public.players', 1, 'jugador ve el plantel');
select pg_temp.expect_rows('select * from public.squad_current_phases()', 0, 'jugador: squad_current_phases');
select pg_temp.expect_fail('delete from public.injuries', 'jugador borra lesiones por API');
select pg_temp.expect_fail('update public.players set availability = ''disponible''', 'jugador actualiza players directo');
select pg_temp.expect_fail('delete from public.documents', 'jugador borra documentos por API');
select pg_temp.expect_fail('select * from public.my_match_load()', 'my_match_load() sin formato ya no existe');
select pg_temp.expect_fail('select * from public.team_match_load(5)', 'team_match_load(int) ya no existe');
reset role;

-- anon
set local role anon;
select pg_temp.expect_fail('select * from public.club_members', 'anon lee club_members');
reset role;

select 'security_hardening_test: PASS' as resultado;
rollback;
