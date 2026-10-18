-- Recov · 0024 · Métricas del Resumen en celular, por separado
-- Ejecutar DESPUÉS de 0023.
--
-- El head coach elige qué métricas se ven en el Resumen en computador
-- (clubs.dashboard_metrics, 0023) y, por separado, en celular:
--   Dónde:      clubs.dashboard_metrics_mobile (arreglo ordenado de claves del mismo
--               catálogo; NULL = las de siempre en celular: disponibles y lesionados).
--   Quién lee:  los miembros del club, con la política clubs_select existente.
--   Quién cambia: solo el head coach confirmado, vía set_dashboard_metrics_mobile.
-- No hay escritura directa: clubs no tiene política de UPDATE.

alter table public.clubs add column dashboard_metrics_mobile text[];
alter table public.clubs add constraint clubs_dashboard_metrics_mobile_chk check (
  dashboard_metrics_mobile is null
  or (
    dashboard_metrics_mobile <@ private.dashboard_metric_keys()
    and array_position(dashboard_metrics_mobile, null) is null
  )
);

-- Mismas reglas que set_dashboard_metrics: 'forbidden' (42501) si no es head coach
-- confirmado; 'invalid_metrics' si hay claves fuera del catálogo, nulas o repetidas.
-- Un arreglo vacío es válido: el Resumen en celular no muestra métricas.
create function public.set_dashboard_metrics_mobile(p_metrics text[])
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

  update public.clubs set dashboard_metrics_mobile = p_metrics where id = v_club;
end $$;

revoke all on function public.set_dashboard_metrics_mobile(text[]) from public, anon, authenticated;
grant execute on function public.set_dashboard_metrics_mobile(text[]) to authenticated;
