-- Recov · 0048 · Nóminas en solo lectura para el jugador
-- Aprobado por Mati (2 nov 2026): el jugador confirmado ve la convocatoria completa
-- de cada partido de su club (quién va, titular o banca y su puesto), no solo la
-- suya. No es dato de salud: no trae diagnóstico, fechas ni disponibilidad.
--   event_callups_select: antes staff o la propia fila; ahora todo confirmado del
--   club. Pendientes, anónimos y otros clubes siguen sin ver nada.
--   event_participations (minutos) no cambia: el jugador sigue viendo solo lo suyo.
--   La escritura sigue igual (set_event_callups / set_event_lineup: head coach,
--   manager y el delegado).
-- La barra móvil (0047) ofrece Nóminas también al jugador.

alter policy event_callups_select on public.event_callups
  using (private.is_confirmed_member(club_id));

create or replace function private.nav_allowed_screens(p_club uuid)
returns text[]
language sql stable security definer set search_path to ''
as $$
  select case when not private.is_confirmed_member(p_club) then '{}'::text[] else
    array['resumen', 'calendario', 'plantel', 'nominas']
    || case when private.is_staff(p_club) then array['lesiones', 'metricas'] else '{}' end
    || case when private.has_role(p_club, 'head_coach') or private.has_role(p_club, 'kinesiologo')
              or private.has_role(p_club, 'entrenador') or private.has_role(p_club, 'nutricionista')
              or private.has_role(p_club, 'preparador_fisico')
            then array['evaluaciones'] else '{}' end
    || case when private.is_direction(p_club) then array['registros', 'staff'] else '{}' end
    || case when private.has_role(p_club, 'jugador') and not private.is_staff(p_club)
            then array['mis_lesiones'] else '{}' end
    || case when private.has_role(p_club, 'jugador') and private.current_player_id(p_club) is not null
            then array['mis_evaluaciones'] else '{}' end
  end
$$;
revoke all on function private.nav_allowed_screens(uuid) from public, anon, authenticated;
