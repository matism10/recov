-- Recov · Permisos del staff (fase 2a, paso 3 de 3): las políticas RLS pasan a has_perm.
-- Con la plantilla por defecto (20261106120000) cada política deja pasar exactamente lo
-- mismo que antes. Los documentos médicos ya siguen documentos_ver desde el paso 2
-- (private.can_view_documents).

-- ---------------------------------------------------------------------------
-- 1. Lesiones, fases e historial de disponibilidad: ver lesiones (antes: todo el staff)
-- ---------------------------------------------------------------------------
alter policy injuries_select on public.injuries
  using (private.has_perm(club_id, 'lesiones_ver'));
alter policy phases_select on public.injury_phases
  using (private.has_perm(club_id, 'lesiones_ver'));
alter policy availability_log_select on public.availability_log
  using (private.has_perm(club_id, 'lesiones_ver'));

-- ---------------------------------------------------------------------------
-- 2. Escritura directa del kine (la app no la usa; quitarla queda para una limpieza aparte).
--    Se exige además el permiso: quitarlo no se puede evadir por la API. Se mantiene
--    has_kine_powers para que el head coach no gane una escritura directa que hoy no tiene.
-- ---------------------------------------------------------------------------
alter policy injuries_write on public.injuries
  using (private.has_kine_powers(club_id) and private.has_perm(club_id, 'lesiones_revisar'))
  with check (private.has_kine_powers(club_id) and private.has_perm(club_id, 'lesiones_revisar'));
alter policy phases_write on public.injury_phases
  using (private.has_kine_powers(club_id) and private.has_perm(club_id, 'lesiones_revisar'))
  with check (private.has_kine_powers(club_id) and private.has_perm(club_id, 'lesiones_revisar'));
alter policy players_update on public.players
  using (private.has_kine_powers(club_id) and private.has_perm(club_id, 'disponibilidad_cambiar')
         and status = 'confirmado'::public.member_status)
  with check (private.has_kine_powers(club_id) and private.has_perm(club_id, 'disponibilidad_cambiar')
              and status = 'confirmado'::public.member_status);

-- ---------------------------------------------------------------------------
-- 3. sRPE y bienestar: la parte del staff pasa a ver reportes (antes: todo el staff)
-- ---------------------------------------------------------------------------
alter policy session_rpe_select on public.session_rpe
  using (private.is_confirmed_member(club_id)
         and (private.has_perm(club_id, 'carga_ver') or player_id = private.current_player_id(club_id)));
alter policy wellness_reports_select on public.wellness_reports
  using (private.is_confirmed_member(club_id)
         and (private.has_perm(club_id, 'carga_ver') or player_id = private.current_player_id(club_id)));

-- ---------------------------------------------------------------------------
-- 4. Miembros pendientes (registros): antes la dirección (head coach o manager); ahora
--    quien aprueba registros o gestiona el staff (por defecto, los mismos).
-- ---------------------------------------------------------------------------
create or replace function private.sees_pending(p_club uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_perm(p_club, 'registros_aprobar') or private.has_perm(p_club, 'staff_gestionar')
$$;
revoke all on function private.sees_pending(uuid) from public;
grant execute on function private.sees_pending(uuid) to authenticated;

alter policy club_members_select_club on public.club_members
  using ((status = 'confirmado'::public.member_status and private.is_confirmed_member(club_id))
         or private.sees_pending(club_id));
alter policy players_select on public.players
  using (private.is_confirmed_member(club_id)
         and (status = 'confirmado'::public.member_status or private.sees_pending(club_id)));

-- profiles_select y la foto (avatars_select) usan can_see_member.
create or replace function private.can_see_member(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.club_members m
       where m.user_id = p_user
         and ((m.status = 'confirmado' and private.is_confirmed_member(m.club_id))
              or private.sees_pending(m.club_id)))
$$;

-- ---------------------------------------------------------------------------
-- 5. Resultados de evaluaciones: los roles que hoy los ven, más quien carga resultados o
--    administra tests (por defecto ya están en esos roles; con un ajuste, p. ej. un manager
--    con "Cargar evaluaciones", ve los resultados que carga).
-- ---------------------------------------------------------------------------
alter policy test_results_select_staff on public.test_results
  using (private.has_any_role(club_id, array['head_coach', 'kinesiologo', 'entrenador',
                                             'nutricionista', 'preparador_fisico']::public.user_role[])
         or private.has_perm(club_id, 'evaluaciones_cargar')
         or private.has_perm(club_id, 'tests_catalogo'));
