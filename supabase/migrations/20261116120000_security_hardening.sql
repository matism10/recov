-- Endurecimiento de seguridad (2026-11-16).
-- La app no escribe directo en injuries, injury_phases, documents ni players: todo va por
-- funciones SECURITY DEFINER (el dueño de la tabla no pasa por RLS). Se quitan las políticas
-- de escritura y los privilegios sobrantes, y las sobrecargas viejas sin uso.
--
-- Fuera de esta migración, a propósito:
--  * register_member de 9 argumentos: la usa /c/[slug] cuando alguien con cuenta se une a otro club.
--  * squad_current_phases sigue mostrando al jugador la fase en curso de sus compañeros
--    (regla del producto, ver 0015); solo se exige ser miembro confirmado del club.

-- a. documents: lectura solo con documentos_ver (las altas van por report_injury / complete_injury_report).
drop policy if exists documents_all on public.documents;
create policy documents_select on public.documents
  for select to authenticated
  using (private.can_view_documents(club_id));

-- b. storage medical-docs: el staff solo lee (el jugador conserva su insert/select propios).
drop policy if exists medical_docs_kine on storage.objects;
create policy medical_docs_staff_select on storage.objects
  for select to authenticated
  using (bucket_id = 'medical-docs'
         and private.can_view_documents(private.safe_uuid((storage.foldername(name))[1])));

-- c. injuries e injury_phases: sin escritura directa.
drop policy if exists injuries_write on public.injuries;
drop policy if exists phases_write on public.injury_phases;

-- d. players: la disponibilidad se cambia con set_player_availability.
drop policy if exists players_update on public.players;

-- e. squad_current_phases: solo miembros confirmados del club.
create or replace function public.squad_current_phases()
returns table(player_id uuid, phase_name text)
language sql stable security definer set search_path = ''
as $function$
  select i.player_id, ph.name
    from public.injury_phases ph
    join public.injuries i on i.id = ph.injury_id and i.club_id = ph.club_id
    join public.players p on p.id = i.player_id and p.club_id = i.club_id
   where ph.club_id = private.current_club_id()
     and private.is_confirmed_member(ph.club_id)
     and i.status = 'activa'
     and ph.status = 'en_curso'
     and ph.archived_at is null
     and p.status = 'confirmado'
$function$;

-- f. privilegios: anon no toca club_members; en tablas sin política de escritura,
--    authenticated no tiene insert/update/delete/truncate; anon no escribe en ninguna.
revoke all on public.club_members from anon;

do $$
declare t record;
begin
  for t in
    select c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and not exists (
         select 1 from pg_policies p
          where p.schemaname = 'public' and p.tablename = c.relname
            and p.cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE'))
  loop
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t.relname);
  end loop;
  for t in
    select c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('revoke insert, update, delete, truncate on public.%I from anon', t.relname);
  end loop;
end $$;

-- g. sobrecargas viejas sin uso (la app y las demás funciones usan las versiones con formato / tipado).
drop function if exists public.dash_summary();
drop function if exists public.dash_availability_series(integer);
drop function if exists public.dash_injuries_by_week(integer);
drop function if exists public.dash_injuries_by_place();
drop function if exists public.dash_injuries_by_position();
drop function if exists public.dash_recurring_players();
drop function if exists public.dash_upcoming_returns();
drop function if exists public.report_injury(text, date, integer, text, text, jsonb, text);
drop function if exists public.complete_injury_report(uuid, text, integer, text, text, jsonb);
drop function if exists public.my_match_load();
drop function if exists public.team_match_load(integer);
