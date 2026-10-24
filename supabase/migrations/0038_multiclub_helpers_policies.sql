-- Recov · 0038 · Multi-plantel (2 de 4): helpers con club_id y políticas RLS que los usan
-- Los helpers nuevos reciben el plantel y leen club_members (0037). Con un solo
-- plantel por cuenta el resultado es el mismo que hoy. Los helpers sin argumento
-- (current_club_id, has_role(r), is_staff(), etc.) no se tocan: las funciones
-- públicas los siguen usando hasta la migración 3.
-- avatars_select se aprieta: hay que ser el dueño o compartir un plantel
-- confirmado (o ser la dirección del plantel del dueño).

-- Conversión segura de texto a uuid (rutas de storage malformadas devuelven null, no error)
create function private.safe_uuid(p text)
returns uuid language sql immutable set search_path = ''
as $$ select case when p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p::uuid end $$;

create function private.is_member(p_club uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.club_members
       where user_id = (select auth.uid()) and club_id = p_club) $$;

create function private.is_confirmed_member(p_club uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.club_members
       where user_id = (select auth.uid()) and club_id = p_club and status = 'confirmado') $$;

create function private.has_role(p_club uuid, r public.user_role)
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce((select r = any (roles) from public.club_members
       where user_id = (select auth.uid()) and club_id = p_club and status = 'confirmado'), false) $$;

create function private.is_staff(p_club uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.club_members
       where user_id = (select auth.uid()) and club_id = p_club and status = 'confirmado'
         and roles && private.staff_roles()) $$;

create function private.is_direction(p_club uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_role(p_club, 'head_coach') or private.has_role(p_club, 'manager') $$;

create function private.has_kine_powers(p_club uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_role(p_club, 'kinesiologo')
      or exists (select 1 from public.clubs c
                   join public.club_members m on m.user_id = c.kine_delegate_id and m.club_id = c.id
                  where c.id = p_club and m.user_id = (select auth.uid()) and m.status = 'confirmado') $$;

create function private.can_manage_nominas(p_club uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_role(p_club, 'head_coach') or private.has_role(p_club, 'manager')
      or exists (select 1 from public.clubs c
                   join public.club_members m on m.user_id = c.nomina_delegate_id and m.club_id = c.id
                  where c.id = p_club and m.user_id = (select auth.uid()) and m.status = 'confirmado'
                    and m.roles && private.staff_roles()) $$;

create function private.can_view_documents(p_club uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_kine_powers(p_club) or private.has_role(p_club, 'head_coach') $$;

create function private.current_player_id(p_club uuid)
returns uuid language sql stable security definer set search_path = ''
as $$ select id from public.players
       where user_id = (select auth.uid()) and club_id = p_club $$;

create function private.can_see_member(p_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.club_members m
       where m.user_id = p_user
         and ((m.status = 'confirmado' and private.is_confirmed_member(m.club_id))
              or private.is_direction(m.club_id))) $$;

-- Permisos: los mismos de sus pares sin argumento. Los helpers que usan las
-- políticas los ejecuta authenticated (como is_staff() o has_role(r));
-- can_manage_nominas solo postgres (como can_manage_nominas()). Nadie más.
revoke all on function private.safe_uuid(text) from public;
revoke all on function private.is_member(uuid) from public;
revoke all on function private.is_confirmed_member(uuid) from public;
revoke all on function private.has_role(uuid, public.user_role) from public;
revoke all on function private.is_staff(uuid) from public;
revoke all on function private.is_direction(uuid) from public;
revoke all on function private.has_kine_powers(uuid) from public;
revoke all on function private.can_manage_nominas(uuid) from public;
revoke all on function private.can_view_documents(uuid) from public;
revoke all on function private.current_player_id(uuid) from public;
revoke all on function private.can_see_member(uuid) from public;

grant execute on function private.safe_uuid(text) to authenticated;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.is_confirmed_member(uuid) to authenticated;
grant execute on function private.has_role(uuid, public.user_role) to authenticated;
grant execute on function private.is_staff(uuid) to authenticated;
grant execute on function private.is_direction(uuid) to authenticated;
grant execute on function private.has_kine_powers(uuid) to authenticated;
grant execute on function private.can_view_documents(uuid) to authenticated;
grant execute on function private.current_player_id(uuid) to authenticated;
grant execute on function private.can_see_member(uuid) to authenticated;

-- Políticas de tablas
alter policy availability_log_select on public.availability_log
  using (private.is_staff(club_id));

alter policy clubs_select on public.clubs
  using (private.is_member(id));

alter policy documents_all on public.documents
  using (private.can_view_documents(club_id))
  with check (private.can_view_documents(club_id));

alter policy documents_player_select on public.documents
  using (private.has_role(club_id, 'jugador') and player_id = private.current_player_id(club_id));

alter policy event_callups_select on public.event_callups
  using (private.is_confirmed_member(club_id)
         and (private.is_staff(club_id) or player_id = private.current_player_id(club_id)));

alter policy event_participations_select on public.event_participations
  using (private.is_confirmed_member(club_id)
         and (private.is_staff(club_id) or player_id = private.current_player_id(club_id)));

alter policy events_select on public.events
  using (private.is_confirmed_member(club_id));

alter policy injuries_player_select on public.injuries
  using (private.has_role(club_id, 'jugador') and player_id = private.current_player_id(club_id));

alter policy injuries_select on public.injuries
  using (private.is_staff(club_id));

alter policy injuries_write on public.injuries
  using (private.has_kine_powers(club_id))
  with check (private.has_kine_powers(club_id));

alter policy phases_player_select on public.injury_phases
  using (private.is_confirmed_member(club_id)
         and exists (select 1 from public.injuries i
                      where i.id = injury_phases.injury_id
                        and i.club_id = injury_phases.club_id
                        and i.player_id = private.current_player_id(injury_phases.club_id)));

alter policy phases_select on public.injury_phases
  using (private.is_staff(club_id));

alter policy phases_write on public.injury_phases
  using (private.has_kine_powers(club_id))
  with check (private.has_kine_powers(club_id));

alter policy players_select on public.players
  using (private.is_confirmed_member(club_id)
         and (status = 'confirmado' or private.is_direction(club_id)));

alter policy players_update on public.players
  using (private.has_kine_powers(club_id) and status = 'confirmado')
  with check (private.has_kine_powers(club_id) and status = 'confirmado');

alter policy profiles_select on public.profiles
  using (id = (select auth.uid()) or private.can_see_member(id));

create policy club_members_select_club on public.club_members
  for select to authenticated
  using ((status = 'confirmado' and private.is_confirmed_member(club_id))
         or private.is_direction(club_id));

-- Políticas de storage (la carpeta [1] es el club_id; en avatars la [2] es el user_id)
alter policy avatars_insert on storage.objects
  with check (bucket_id = 'avatars'
    and private.is_member(private.safe_uuid((storage.foldername(name))[1]))
    and (storage.foldername(name))[2] = (select auth.uid())::text);

alter policy avatars_update on storage.objects
  using (bucket_id = 'avatars'
    and private.is_member(private.safe_uuid((storage.foldername(name))[1]))
    and (storage.foldername(name))[2] = (select auth.uid())::text)
  with check (bucket_id = 'avatars'
    and private.is_member(private.safe_uuid((storage.foldername(name))[1]))
    and (storage.foldername(name))[2] = (select auth.uid())::text);

alter policy avatars_delete on storage.objects
  using (bucket_id = 'avatars'
    and private.is_member(private.safe_uuid((storage.foldername(name))[1]))
    and (storage.foldername(name))[2] = (select auth.uid())::text);

-- Se aprieta: ahora exige ser el dueño o compartir un plantel confirmado (o ser dirección)
alter policy avatars_select on storage.objects
  using (bucket_id = 'avatars'
    and ((storage.foldername(name))[2] = (select auth.uid())::text
         or private.can_see_member(private.safe_uuid((storage.foldername(name))[2]))));

alter policy club_covers_select on storage.objects
  using (bucket_id = 'club-covers'
    and private.is_confirmed_member(private.safe_uuid((storage.foldername(name))[1])));

alter policy club_covers_insert on storage.objects
  with check (bucket_id = 'club-covers'
    and private.is_direction(private.safe_uuid((storage.foldername(name))[1])));

alter policy club_covers_update on storage.objects
  using (bucket_id = 'club-covers'
    and private.is_direction(private.safe_uuid((storage.foldername(name))[1])))
  with check (bucket_id = 'club-covers'
    and private.is_direction(private.safe_uuid((storage.foldername(name))[1])));

alter policy club_covers_delete on storage.objects
  using (bucket_id = 'club-covers'
    and private.is_direction(private.safe_uuid((storage.foldername(name))[1])));

alter policy club_logos_insert on storage.objects
  with check (bucket_id = 'club-logos'
    and private.is_direction(private.safe_uuid((storage.foldername(name))[1])));

alter policy club_logos_update on storage.objects
  using (bucket_id = 'club-logos'
    and private.is_direction(private.safe_uuid((storage.foldername(name))[1])))
  with check (bucket_id = 'club-logos'
    and private.is_direction(private.safe_uuid((storage.foldername(name))[1])));

alter policy club_logos_delete on storage.objects
  using (bucket_id = 'club-logos'
    and private.is_direction(private.safe_uuid((storage.foldername(name))[1])));

alter policy medical_docs_kine on storage.objects
  using (bucket_id = 'medical-docs'
    and private.can_view_documents(private.safe_uuid((storage.foldername(name))[1])))
  with check (bucket_id = 'medical-docs'
    and private.can_view_documents(private.safe_uuid((storage.foldername(name))[1])));

alter policy medical_docs_player_insert on storage.objects
  with check (bucket_id = 'medical-docs'
    and private.has_role(private.safe_uuid((storage.foldername(name))[1]), 'jugador')
    and (storage.foldername(name))[2]
        = private.current_player_id(private.safe_uuid((storage.foldername(name))[1]))::text);

alter policy medical_docs_player_select on storage.objects
  using (bucket_id = 'medical-docs'
    and private.has_role(private.safe_uuid((storage.foldername(name))[1]), 'jugador')
    and (storage.foldername(name))[2]
        = private.current_player_id(private.safe_uuid((storage.foldername(name))[1]))::text);
