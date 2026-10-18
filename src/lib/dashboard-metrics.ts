// Métricas que el head coach puede mostrar en el Resumen, por separado en computador
// (clubs.dashboard_metrics, 0023) y en celular (clubs.dashboard_metrics_mobile, 0024).
// Las claves y su orden replican private.dashboard_metric_keys().

export const DASHBOARD_METRICS = [
  "total",
  "disponibles",
  "lesionados",
  "reintegro",
  "disponibilidad",
  "lesiones_semana",
  "lugar",
  "posicion",
  "recurrentes",
  "proximas_altas",
] as const;

export type DashboardMetric = (typeof DASHBOARD_METRICS)[number];

export const DASHBOARD_METRIC_LABEL: Record<DashboardMetric, string> = {
  total: "Total de jugadores",
  disponibles: "Jugadores disponibles",
  lesionados: "Jugadores lesionados",
  reintegro: "En reintegro",
  disponibilidad: "Disponibilidad en el tiempo",
  lesiones_semana: "Lesiones nuevas por semana",
  lugar: "Lugar de la lesión",
  posicion: "Lesiones por posición",
  recurrentes: "Jugadores recurrentes",
  proximas_altas: "Próximas altas estimadas",
};

// Tarjetas con un número; el resto son bloques (gráficos y listas).
export const CARD_METRICS: readonly DashboardMetric[] = [
  "total",
  "disponibles",
  "lesionados",
  "reintegro",
];

// Lo que el Resumen mostraba antes de poder elegir (columna en NULL).
export const DEFAULT_DASHBOARD_METRICS: DashboardMetric[] = [
  "disponibles",
  "lesionados",
  "disponibilidad",
];
export const DEFAULT_DASHBOARD_METRICS_MOBILE: DashboardMetric[] = ["disponibles", "lesionados"];

// Lo guardado en el club, en el orden del catálogo; NULL = las de siempre.
export function dashboardMetricsOf(
  saved: string[] | null | undefined,
  defaults: DashboardMetric[] = DEFAULT_DASHBOARD_METRICS,
): DashboardMetric[] {
  if (!saved) return defaults;
  return DASHBOARD_METRICS.filter((m) => saved.includes(m));
}
