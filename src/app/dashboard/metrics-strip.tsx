import type { ReactNode } from "react";
import type { createClient } from "@/lib/supabase/server";
import {
  getAvailabilitySeries,
  getDashSummary,
  getInjuriesByPlace,
  getInjuriesByPosition,
  getInjuriesByWeek,
  getPlayersStatus,
  getRecurringPlayers,
  getUpcomingReturns,
} from "@/lib/metrics";
import { getAvatarUrls } from "@/lib/avatars";
import { getAttendanceRanking } from "@/lib/attendance";
import { AttendanceCard } from "@/app/attendance-ranking";
import { DASHBOARD_METRICS, type DashboardMetric } from "@/lib/dashboard-metrics";
import { AvailabilityChart, MetricsError, metricCardClass, percentOf } from "@/app/metrics";
import { StatStrip } from "@/app/ui-blocks";
import {
  InjuriesByPlaceBlock,
  InjuriesByPositionBlock,
  InjuriesByWeekBlock,
  RecurringPlayersBlock,
  UpcomingReturnsBlock,
} from "@/app/metricas/blocks";
import { Block } from "@/app/skeleton";
import type { Format } from "@/lib/sevens";

type Client = Awaited<ReturnType<typeof createClient>>;

// Dónde se ve cada métrica: en los dos, solo en computador (lg+) o solo en celular.
export function visibilityOf(m: DashboardMetric, desktop: DashboardMetric[], mobile: DashboardMetric[]) {
  return desktop.includes(m) && mobile.includes(m) ? "" : desktop.includes(m) ? "hidden lg:block" : "lg:hidden";
}

// Métricas con un número (van en la StatStrip) y métricas gráficas (cada una, su tarjeta).
const STAT_METRICS: DashboardMetric[] = ["total", "disponibles", "lesionados", "reintegro"];
export const isChartMetric = (m: DashboardMetric) => !STAT_METRICS.includes(m);

// Esqueleto de la StatStrip mientras llegan sus datos.
export function StatStripSkeleton() {
  return <Block className="h-[188px] lg:h-[104px]" />;
}

// Esqueleto de las tarjetas gráficas: una por métrica elegida.
export function ChartsSkeleton({ desktop, mobile }: { desktop: DashboardMetric[]; mobile: DashboardMetric[] }) {
  const metrics = DASHBOARD_METRICS.filter((m) => isChartMetric(m) && (desktop.includes(m) || mobile.includes(m)));
  return (
    <>
      {metrics.map((m) => (
        <div key={m} className={visibilityOf(m, desktop, mobile)}>
          <Block className="min-h-56" />
        </div>
      ))}
    </>
  );
}

// Datos de la franja: solo los de las métricas elegidas. El Resumen lo llama apenas
// conoce el perfil, para que corra en paralelo con sus otras consultas.
export async function loadMetricsStrip(
  supabase: Client,
  desktop: DashboardMetric[],
  mobile: DashboardMetric[],
  format: Format = "15",
) {
  // Todas las elegidas, en el orden del catálogo; cada una se muestra donde se eligió.
  const metrics = DASHBOARD_METRICS.filter((m) => desktop.includes(m) || mobile.includes(m));
  const has = (m: DashboardMetric) => metrics.includes(m);
  const needsSummary = ["total", "disponibles", "lesionados", "reintegro"].some((m) =>
    has(m as DashboardMetric),
  );

  const [summary, series, byWeek, byPlace, byPosition, recurring, upcoming, attendance] = await Promise.all([
    needsSummary ? getDashSummary(supabase, format) : null,
    has("disponibilidad") ? getAvailabilitySeries(supabase, 12, format) : null,
    has("lesiones_semana") ? getInjuriesByWeek(supabase, 12, format) : null,
    has("lugar") ? getInjuriesByPlace(supabase, format) : null,
    has("posicion") ? getInjuriesByPosition(supabase, format) : null,
    has("recurrentes") ? getRecurringPlayers(supabase, format) : null,
    has("proximas_altas") ? getUpcomingReturns(supabase, format) : null,
    has("asistencia") ? getAttendanceRanking(supabase, "mes") : null,
  ]);

  // Estado y foto solo de los jugadores de "Jugadores recurrentes" y "Próximas altas".
  const listedIds = [
    ...new Set([
      ...(recurring?.ok ? recurring.data.map((p) => p.player_id) : []),
      ...(upcoming?.ok ? upcoming.data.map((r) => r.player_id) : []),
    ]),
  ];
  const players = listedIds.length > 0 ? await getPlayersStatus(supabase, listedIds) : null;
  const status = players?.ok ? players.data : null;
  const avatarUrls = status
    ? await getAvatarUrls(supabase, [...status.values()].map((p) => p.user_id))
    : new Map<string, string>();

  return {
    metrics,
    summary,
    series,
    byWeek,
    byPlace,
    byPosition,
    recurring,
    upcoming,
    attendance,
    status,
    avatarUrls,
  };
}

// Quien no es staff (el jugador) ve de la franja solo "Asistencia a entrenamientos",
// si el head coach la eligió (attendance_ranking la puede llamar cualquier confirmado).
export async function PlayerMetrics({
  data,
  desktop,
  mobile,
}: {
  data: Promise<Awaited<ReturnType<typeof getAttendanceRanking>> | null>;
  desktop: DashboardMetric[];
  mobile: DashboardMetric[];
}) {
  const attendance = await data;
  if (!attendance) return null;
  return (
    <div className={`mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 ${visibilityOf("asistencia", desktop, mobile)}`}>
      <div className={`min-w-0 *:h-full sm:col-span-2`}>
        <AttendanceCard result={attendance} />
      </div>
    </div>
  );
}

type Loaded = Awaited<ReturnType<typeof loadMetricsStrip>>;

// Números del Resumen del staff (StatStrip): Disponibles, Lesionados, En reintegro y, si
// puede revisar lesiones, Por revisar. Respeta las métricas elegidas por la dirección para
// computador (desde lg) y celular. "Total de jugadores" va como contexto de Disponibles.
export async function StaffStatStrip({
  data,
  desktop,
  mobile,
  toReview,
}: {
  data: Promise<Loaded | null>;
  desktop: DashboardMetric[];
  mobile: DashboardMetric[];
  // null: quien mira no revisa lesiones, no hay tarjeta "Por revisar".
  toReview: number | null;
}) {
  const loaded = await data;
  if (!loaded) return null;
  const { summary } = loaded;
  const build = (chosen: DashboardMetric[]) => {
    if (!summary?.ok) return null;
    const d = summary.data;
    const items: { label: string; value: number | string; context?: string; tone: "disponible" | "lesionado" | "reintegro" | "alerta" }[] = [];
    if (chosen.includes("disponibles"))
      items.push({
        label: "Disponibles",
        value: `${percentOf(d.disponibles, d.total)}%`,
        context: `${d.disponibles} de ${d.total}`,
        tone: "disponible",
      });
    if (chosen.includes("lesionados")) items.push({ label: "Lesionados", value: d.lesionados, tone: "lesionado" });
    if (chosen.includes("reintegro")) items.push({ label: "En reintegro", value: d.reintegro, tone: "reintegro" });
    if (toReview !== null) items.push({ label: "Por revisar", value: toReview, tone: "alerta" });
    return items;
  };
  const wanted = STAT_METRICS.some((m) => desktop.includes(m) || mobile.includes(m)) || toReview !== null;
  if (!wanted) return null;
  if (!summary?.ok && STAT_METRICS.some((m) => desktop.includes(m) || mobile.includes(m))) return <MetricsError />;
  const dItems = build(desktop) ?? [];
  const mItems = build(mobile) ?? [];
  const same = JSON.stringify(dItems) === JSON.stringify(mItems);
  if (same) return dItems.length > 0 ? <StatStrip items={dItems} /> : null;
  return (
    <>
      {mItems.length > 0 && <div className="lg:hidden"><StatStrip items={mItems} /></div>}
      {dItems.length > 0 && <div className="hidden lg:block"><StatStrip items={dItems} /></div>}
    </>
  );
}

// Tarjetas gráficas del Resumen del staff (una columna), cada una donde se eligió.
export async function StaffMetricCharts({
  data,
  desktop,
  mobile,
}: {
  data: Promise<Loaded | null>;
  desktop: DashboardMetric[];
  mobile: DashboardMetric[];
}) {
  const loaded = await data;
  if (!loaded) return null;
  const { metrics, series, byWeek, byPlace, byPosition, recurring, upcoming, attendance, status, avatarUrls } = loaded;
  const render: Partial<Record<DashboardMetric, () => ReactNode>> = {
    disponibilidad: () => (
      <section className={metricCardClass}>
        {series?.ok ? (
          <AvailabilityChart heading="Disponibilidad en el tiempo" weeks={series.data} keys={["disponible", "lesionado"]} height={140} />
        ) : (
          <MetricsError />
        )}
      </section>
    ),
    lesiones_semana: () => byWeek && <InjuriesByWeekBlock result={byWeek} />,
    lugar: () => byPlace && <InjuriesByPlaceBlock result={byPlace} />,
    posicion: () => byPosition && <InjuriesByPositionBlock result={byPosition} />,
    recurrentes: () => recurring && <RecurringPlayersBlock result={recurring} status={status} avatarUrls={avatarUrls} />,
    proximas_altas: () => upcoming && <UpcomingReturnsBlock result={upcoming} status={status} avatarUrls={avatarUrls} />,
    asistencia: () => attendance && <AttendanceCard result={attendance} />,
  };
  return (
    <>
      {metrics.filter(isChartMetric).map((m) => (
        <div key={m} className={`min-w-0 *:h-full ${visibilityOf(m, desktop, mobile)}`}>
          {render[m]?.()}
        </div>
      ))}
    </>
  );
}
