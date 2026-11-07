-- Recov · Permisos del staff (fase 2a, paso 2 de 3): las funciones pasan a has_perm.
-- Con la plantilla por defecto (20261106120000) cada rol hace exactamente lo mismo que antes.
-- Firmas iguales: create or replace conserva los permisos de ejecución.
--
-- Para no reescribir a mano funciones largas, pg_temp.swap toma la definición vigente
-- (pg_get_functiondef), cambia solo el texto del chequeo y la vuelve a crear. Si no
-- encuentra el texto exacto, la migración falla y no cambia nada.

create function pg_temp.swap(p_fn regprocedure, p_from text, p_to text)
returns void language plpgsql as $$
declare
  v_def text := pg_get_functiondef(p_fn);
begin
  if position(p_from in v_def) = 0 then
    raise exception 'swap: % no contiene «%»', p_fn, p_from;
  end if;
  execute replace(v_def, p_from, p_to);
end $$;

-- ---------------------------------------------------------------------------
-- 1. Helpers que equivalen a un solo permiso
-- ---------------------------------------------------------------------------
-- review_injury, set_injury_phases, advance_injury_phase.
create or replace function private.can_manage_injuries()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_perm('lesiones_revisar')
$$;

-- set_player_availability.
create or replace function private.can_set_availability()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_perm('disponibilidad_cambiar')
$$;

-- Documentos médicos (RLS de documents y del bucket medical-docs).
create or replace function private.can_view_documents()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_perm('documentos_ver')
$$;
create or replace function private.can_view_documents(p_club uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_perm(p_club, 'documentos_ver')
$$;

-- create_event y update_event (cancel_event pasa a eventos_cancelar más abajo).
create or replace function private.events_actor_club()
returns uuid language sql stable security definer set search_path = '' as $$
  select case when private.has_perm('eventos_editar') then private.current_club_id() end
$$;

-- set_event_callups y set_event_lineup (la participación pasa a participacion_cargar).
create or replace function private.can_manage_nominas(p_club uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_perm(p_club, 'nomina_armar')
$$;

-- save_gym_plan, publish_gym_plan, archive_gym_plan.
create or replace function private.gym_planner_club()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  v_club uuid := private.current_club_id();
begin
  if v_club is null or not private.has_perm(v_club, 'gimnasio_planes') then
    raise exception 'No tienes permiso para esta acción' using errcode = '42501';
  end if;
  return v_club;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Funciones donde un helper agrupaba permisos distintos
-- ---------------------------------------------------------------------------
select pg_temp.swap('public.mark_player_injured(uuid,text,text,public.availability_status,date)',
  'not private.can_manage_injuries()', 'not private.has_perm(''lesionado_marcar'')');

select pg_temp.swap('public.cancel_event(uuid)',
  'private.events_actor_club()',
  'case when private.has_perm(''eventos_cancelar'') then private.current_club_id() end');

select pg_temp.swap('public.set_event_participation(uuid,jsonb)',
  'not private.can_manage_nominas()', 'not private.has_perm(''participacion_cargar'')');

-- ---------------------------------------------------------------------------
-- 3. Chequeos por rol escritos en la función
-- ---------------------------------------------------------------------------
-- Evaluaciones: cargar y anular resultados / catálogo de tests (head coach, kine, pf).
select pg_temp.swap('public.record_test_results(uuid,date,jsonb)',
  'private.has_any_role(v_club, array[''head_coach'', ''kinesiologo'', ''preparador_fisico'']::public.user_role[])',
  'private.has_perm(v_club, ''evaluaciones_cargar'')');
select pg_temp.swap('public.void_test_result(uuid)',
  'private.has_any_role(v_club, array[''head_coach'', ''kinesiologo'', ''preparador_fisico'']::public.user_role[])',
  'private.has_perm(v_club, ''evaluaciones_cargar'')');
select pg_temp.swap('public.create_test_definition(uuid,text,text,boolean,text)',
  'private.has_any_role(p_club, array[''head_coach'', ''kinesiologo'', ''preparador_fisico'']::public.user_role[])',
  'private.has_perm(p_club, ''tests_catalogo'')');
select pg_temp.swap('public.archive_test_definition(uuid)',
  'private.has_any_role(v_club, array[''head_coach'', ''kinesiologo'', ''preparador_fisico'']::public.user_role[])',
  'private.has_perm(v_club, ''tests_catalogo'')');

-- Días del check de bienestar (head coach, manager, pf).
select pg_temp.swap('public.set_wellness_days(smallint[])',
  'not (private.has_role(v_club, ''head_coach'')
                            or private.has_role(v_club, ''manager'')
                            or private.has_role(v_club, ''preparador_fisico''))',
  'not private.has_perm(v_club, ''check_dias'')');

-- ---------------------------------------------------------------------------
-- 4. Chequeos de "cualquier staff" que pasan a un permiso
-- ---------------------------------------------------------------------------
-- Pasar lista.
select pg_temp.swap('public.set_event_attendance(uuid,uuid[])',
  'not private.is_staff(v_club)', 'not private.has_perm(v_club, ''lista_pasar'')');

-- Reportes sRPE y bienestar.
select pg_temp.swap('public.event_rpe_summary(uuid)',
  'not private.is_staff(v_club)', 'not private.has_perm(v_club, ''carga_ver'')');
select pg_temp.swap('public.team_srpe_load(text)',
  'not private.is_staff(v_club)', 'not private.has_perm(v_club, ''carga_ver'')');
select pg_temp.swap('public.team_load_breakdown(text)',
  'not private.is_staff(v_club)', 'not private.has_perm(v_club, ''carga_ver'')');
select pg_temp.swap('public.wellness_flags(text)',
  'not private.is_staff(v_club)', 'not private.has_perm(v_club, ''carga_ver'')');
select pg_temp.swap('public.player_weekly_load(uuid,integer,text)',
  'private.is_staff(v_club) or p_player_id', 'private.has_perm(v_club, ''carga_ver'') or p_player_id');

-- Métricas de lesiones del Resumen (dash_* y su chequeo por formato).
select pg_temp.swap('public.dash_summary()',             'not private.is_staff()', 'not private.has_perm(''lesiones_ver'')');
select pg_temp.swap('public.dash_availability_series(integer)', 'not private.is_staff()', 'not private.has_perm(''lesiones_ver'')');
select pg_temp.swap('public.dash_injuries_by_place()',   'not private.is_staff()', 'not private.has_perm(''lesiones_ver'')');
select pg_temp.swap('public.dash_injuries_by_position()', 'not private.is_staff()', 'not private.has_perm(''lesiones_ver'')');
select pg_temp.swap('public.dash_injuries_by_week(integer)', 'not private.is_staff()', 'not private.has_perm(''lesiones_ver'')');
select pg_temp.swap('public.dash_recurring_players()',   'not private.is_staff()', 'not private.has_perm(''lesiones_ver'')');
select pg_temp.swap('public.dash_upcoming_returns()',    'not private.is_staff()', 'not private.has_perm(''lesiones_ver'')');
select pg_temp.swap('private.check_dash(text)',          'not private.is_staff()', 'not private.has_perm(''lesiones_ver'')');

-- ---------------------------------------------------------------------------
-- 5. Dirección: delegaciones y Sevens (no delegables: head coach y manager, como hoy)
-- ---------------------------------------------------------------------------
select pg_temp.swap('public.set_kine_delegate(uuid,uuid)',
  'not private.is_direction(v_club)', 'not private.has_perm(v_club, ''staff_gestionar'')');
select pg_temp.swap('public.set_nomina_delegate(uuid,uuid)',
  'not private.is_direction(v_club)', 'not private.has_perm(v_club, ''staff_gestionar'')');
select pg_temp.swap('public.set_club_sevens(boolean)',
  'not private.is_direction(v_club)', 'not private.has_perm(v_club, ''sevens_activar'')');
select pg_temp.swap('public.set_sevens_group(uuid[])',
  'not private.is_direction(v_club)', 'not private.has_perm(v_club, ''sevens_grupo'')');

-- ---------------------------------------------------------------------------
-- 6. review_member: aprobar registros es un permiso; aprobar a alguien como head coach,
--    solo un head coach.
-- ---------------------------------------------------------------------------
create or replace function public.review_member(
  p_profile_id uuid, p_decision text, p_roles public.user_role[] default null, p_club_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_club   uuid := private.resolve_club(p_club_id);
  v_target public.club_members%rowtype;
  v_roles  public.user_role[];
  v_status public.member_status;
begin
  if v_club is null or not private.has_perm(v_club, 'registros_aprobar') then raise exception 'No tienes permiso para esta acción'; end if;
  if p_profile_id = (select auth.uid()) then raise exception 'No puedes modificar tu propio perfil'; end if;
  if p_decision not in ('confirmar', 'rechazar') then raise exception 'Decisión inválida'; end if;

  select * into v_target from public.club_members where user_id = p_profile_id and club_id = v_club;
  if not found then raise exception 'Perfil no encontrado'; end if;
  if v_target.status <> 'pendiente' then raise exception 'Este perfil ya fue revisado'; end if;

  v_status := case when p_decision = 'confirmar' then 'confirmado' else 'rechazado' end::public.member_status;

  if exists (select 1 from public.players where user_id = p_profile_id and club_id = v_club) then
    update public.players set status = v_status where user_id = p_profile_id and club_id = v_club;
    update public.club_members set status = v_status where user_id = p_profile_id and club_id = v_club;
  elsif p_decision = 'confirmar' then
    v_roles := coalesce(p_roles,
                        case when v_target.requested_role is null then null
                             else array[v_target.requested_role] end);
    if v_roles is null or cardinality(v_roles) = 0 or not (v_roles <@ private.staff_roles()) then
      raise exception 'Roles de staff inválidos';
    end if;
    if 'head_coach' = any (v_roles) and not private.has_role(v_club, 'head_coach') then
      raise exception 'Solo un head coach puede aprobar a alguien como head coach';
    end if;
    update public.club_members set status = 'confirmado', roles = v_roles
     where user_id = p_profile_id and club_id = v_club;
  else
    update public.club_members set status = 'rechazado', roles = '{}'
     where user_id = p_profile_id and club_id = v_club;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Barra inferior: las pantallas siguen permisos (set_nav_slots usa esta función).
--    Evaluaciones: quienes ven resultados (por rol, como hoy) o quien carga o administra tests.
-- ---------------------------------------------------------------------------
create or replace function private.nav_allowed_screens(p_club uuid)
returns text[] language sql stable security definer set search_path = '' as $$
  select case when not private.is_confirmed_member(p_club) then '{}'::text[] else
    array['resumen', 'calendario', 'plantel', 'nominas']
    || case when private.has_perm(p_club, 'lesiones_ver') then array['lesiones'] else '{}' end
    || case when private.is_staff(p_club) then array['metricas'] else '{}' end
    || case when private.has_any_role(p_club, array['head_coach', 'kinesiologo', 'entrenador',
                                                    'nutricionista', 'preparador_fisico']::public.user_role[])
              or private.has_perm(p_club, 'evaluaciones_cargar')
              or private.has_perm(p_club, 'tests_catalogo')
            then array['evaluaciones'] else '{}' end
    || case when private.has_perm(p_club, 'registros_aprobar') then array['registros'] else '{}' end
    || case when private.has_perm(p_club, 'staff_gestionar') then array['staff'] else '{}' end
    || case when private.has_perm(p_club, 'gimnasio_planes') then array['planes'] else '{}' end
    || case when private.has_role(p_club, 'jugador') and not private.is_staff(p_club)
            then array['mis_lesiones'] else '{}' end
    || case when private.has_role(p_club, 'jugador') and private.current_player_id(p_club) is not null
            then array['mis_evaluaciones', 'mi_plan'] else '{}' end
  end
$$;
