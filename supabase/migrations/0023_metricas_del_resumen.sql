-- Recov · 0023 · Métricas del Resumen elegidas por el head coach
-- Ejecutar DESPUÉS de 0022.
--
-- El head coach elige qué métricas ve todo el staff de su club en el Resumen.
--   Dónde:      clubs.dashboard_metrics (arreglo ordenado de claves; NULL = las de
--               siempre: disponibles, lesionados y disponibilidad en el tiempo).
--   Quién lee:  los miembros del club, con la política clubs_select existente.
--   Quién cambia: solo el head coach confirmado, vía set_dashboard_metrics.
-- No hay escritura directa: clubs no tiene política de UPDATE.

-- ---------------------------------------------------------------------
-- Catálogo de métricas (mismo orden que la pantalla de Configuración)
-- ---------------------------------------------------------------------
create function private.dashboard_metric_keys()
returns text[]
language sql immutable set search_path to ''
as $$
  select array[
    'total', 'disponibles', 'lesionados', 'reintegro',
    'disponibilidad', 'lesiones_semana', 'lugar', 'posicion', 'recurrentes', 'proximas_altas'
  ]::text[]
$$;

revoke all on function private.dashboard_metric_keys() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Columna en clubs
-- ---------------------------------------------------------------------
alter table public.clubs add column dashboard_metrics text[];
alter table public.clubs add constraint clubs_dashboard_metrics_chk check (
  dashboard_metrics is null
  or (
    dashboard_metrics <@ private.dashboard_metric_keys()
    and array_position(dashboard_metrics, null) is null
  )
);

-- ---------------------------------------------------------------------
-- El head coach fija (o vuelve a las de siempre, con NULL) las métricas
-- ---------------------------------------------------------------------
-- Errores: 'forbidden' (42501) si no es head coach confirmado; 'invalid_metrics'
-- si hay claves fuera del catálogo, nulas o repetidas. Un arreglo vacío es válido:
-- el Resumen no muestra métricas.
create function public.set_dashboard_metrics(p_metrics text[])
returns void
language plpgsql security definer set search_path to ''
as $$
declare
  v_club uuid := case when private.has_role('head_coach') then private.current_club_id() end;
begin
  if v_club is null then raise exception 'forbidden' using errcode = '42501'; end if;

  if p_metrics is not null and (
       not (p_metrics <@ private.dashboard_metric_keys())
       or array_position(p_metrics, null) is not null
       or cardinality(p_metrics) <> (select count(distinct m) from unnest(p_metrics) m)
     ) then
    raise exception 'invalid_metrics';
  end if;

  update public.clubs set dashboard_metrics = p_metrics where id = v_club;
end $$;

revoke all on function public.set_dashboard_metrics(text[]) from public, anon, authenticated;
grant execute on function public.set_dashboard_metrics(text[]) to authenticated;
