-- Recov · 0003 · Jugadores con login
-- Ejecutar DESPUÉS de 0002 (en una consulta aparte).
--
-- El jugador puede, por ahora, solo dos cosas:
--   1) subir su propia documentación médica (queda en borrador) y verla
--   2) ver la disponibilidad del plantel
-- No ve lesiones, fases ni documentos de otros jugadores.

-- ---------------------------------------------------------------------
-- Vínculo jugador <-> usuario
-- ---------------------------------------------------------------------
alter table public.players
  add column user_id uuid unique references auth.users (id) on delete set null;

create or replace function private.current_player_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.players where user_id = (select auth.uid())
$$;

revoke all on function private.current_player_id() from public, anon;
grant execute on function private.current_player_id() to authenticated;

-- ---------------------------------------------------------------------
-- Lesiones y fases: solo staff (admin, kinesiólogo, entrenador)
-- ---------------------------------------------------------------------
drop policy injuries_select on public.injuries;
create policy injuries_select on public.injuries
  for select to authenticated
  using (
    club_id = private.current_club_id()
    and (private.has_role('admin') or private.has_role('kinesiologo') or private.has_role('entrenador'))
  );

drop policy phases_select on public.injury_phases;
create policy phases_select on public.injury_phases
  for select to authenticated
  using (
    club_id = private.current_club_id()
    and (private.has_role('admin') or private.has_role('kinesiologo') or private.has_role('entrenador'))
  );

-- ---------------------------------------------------------------------
-- Documentos: el jugador sube y ve solo los suyos
-- ---------------------------------------------------------------------
create policy documents_player_insert on public.documents
  for insert to authenticated
  with check (
    club_id = private.current_club_id()
    and private.has_role('jugador')
    and player_id = private.current_player_id()
    and status = 'borrador'
    and injury_id is null
    and reviewed_by is null
    and uploaded_by = (select auth.uid())
  );

create policy documents_player_select on public.documents
  for select to authenticated
  using (
    club_id = private.current_club_id()
    and private.has_role('jugador')
    and player_id = private.current_player_id()
  );

-- ---------------------------------------------------------------------
-- Storage: ruta {club_id}/{player_id}/{archivo}
-- ---------------------------------------------------------------------
create policy medical_docs_player_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'medical-docs'
    and private.has_role('jugador')
    and (storage.foldername(name))[1] = private.current_club_id()::text
    and (storage.foldername(name))[2] = private.current_player_id()::text
  );

create policy medical_docs_player_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'medical-docs'
    and private.has_role('jugador')
    and (storage.foldername(name))[1] = private.current_club_id()::text
    and (storage.foldername(name))[2] = private.current_player_id()::text
  );