import Link from "next/link";
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
import { AvailabilityChart, MetricsError, StatCard, metricCardClass, percentOf } from "@/app/metrics";
import {
  InjuriesByPlaceBlock,
  InjuriesByPositionBlock,
  InjuriesByWeekBlock,
  RecurringPlayersBlock,
  UpcomingReturnsBlock,
} from "@/app/metricas/blocks";
import { buttonSecondary } from "@/app/ui";
import { Block, Line } from "@/app/skeleton";
import type { Format } from "@/lib/sevens";

// Ancho de cada métrica en la grilla. Celular: una columna (tarjetas lado a lado
// desde sm). Escritorio (4 columnas): tarjetas de 1, bloques de 2 y próximas altas
// a lo ancho.
const SPAN: Record<DashboardMetric, string> = {
  total: "",
  disponibles: "",
  lesionados: "",
  reintegro: "",
  disponibilidad: "sm:col-span-2",
  lesiones_semana: "sm:col-span-2",
  lugar: "sm:col-span-2",
  posicion: "sm:col-span-2",
  recurrentes: "sm:col-span-2",
  proximas_altas: "sm:col-span-2 lg:col-span-4",
  asistencia: "sm:col-span-2",
};

type Client = Awaited<ReturnType<typeof createClient>>;

// Dónde se ve cada métrica: en los dos, solo en computador (lg+) o solo en celular.
export function visibilityOf(m: DashboardMetric, desktop: DashboardMetric[], mobile: DashboardMetric[]) {
  return desktop.includes(m) && mobile.includes(m) ? "" : desktop.includes(m) ? "hidden lg:block" : "lg:hidden";
}

const STAT_CARDS: DashboardMetric[] = ["total", "disponibles", "lesionados", "reintegro"];

// Esqueleto de la franja mientras llegan sus datos: la misma grilla, con un bloque por
// métrica elegida (tarjeta o gráfico), para que la página no salte al llegar.
export function MetricsStripSkeleton({
  desktop,
  mobile,
}: {
  desktop: DashboardMetric[];
  mobile: DashboardMetric[];
}) {
  const metrics = DASHBOARD_METRICS.filter((m) => desktop.includes(m) || mobile.includes(m));
  return (
    <div aria-hidden="true" className={mobile.length > 0 ? "mb-8" : "lg:mb-8"}>
      {metrics.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m) => (
            <div key={m} className={`min-w-0 *:h-full ${visibilityOf(m, desktop, mobile)} ${SPAN[m]}`}>
              {STAT_CARDS.includes(m) ? (
                <Block className="space-y-4 p-5">
                  <Line className="h-4 w-36" />
                  <Line className="h-10 w-14" />
                  <Line className="h-2 w-full rounded-full" />
                  <Line className="h-3 w-40" />
                </Block>
              ) : (
                <Block className="min-h-56" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
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
      <div className={`min-w-0 *:h-full ${SPAN.asistencia}`}>
        <AttendanceCard result={attendance} />
      </div>
    </div>
  );
}

// Franja de métricas del Resumen, solo para el staff: las que eligió el head coach
// para computador (desde lg) y para celular (hasta lg), o las de siempre. Quien la
// monta decide si el usuario es staff y le pasa los datos ya pedidos
// (loadMetricsStrip); las funciones lo validan de nuevo.
export async function MetricsStrip({
  data,
  desktop,
  mobile,
}: {
  // null: no le toca la franja (quien la monta ya lo decidió con el perfil).
  data: Promise<Awaited<ReturnType<typeof loadMetricsStrip>> | null>;
  desktop: DashboardMetric[];
  mobile: DashboardMetric[];
}) {
  const loaded = await data;
  if (!loaded) return null;
  const {
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
  } = loaded;
  const visibility = (m: DashboardMetric) => visibilityOf(m, desktop, mobile);

  const card = (node: ReactNode) => (summary?.ok ? node : <MetricsError />);
  const render: Record<DashboardMetric, () => ReactNode> = {
    total: () =>
      card(
        summary?.ok && (
          <StatCard label="Total de jugadores" value={summary.data.total} description="En el plantel" />
        ),
      ),
    disponibles: () =>
      card(
        summary?.ok && (
          <StatCard
            label="Jugadores disponibles"
            value={summary.data.disponibles}
            tone="disponible"
            description="Aptos para convocatoria"
            percent={percentOf(summary.data.disponibles, summary.data.total)}
          />
        ),
      ),
    lesionados: () =>
      card(
        summary?.ok && (
          <StatCard
            label="Jugadores lesionados"
            value={summary.data.lesionados}
            tone="lesionado"
            description="Sin alta médica"
            percent={percentOf(summary.data.lesionados, summary.data.total)}
          />
        ),
      ),
    reintegro: () =>
      card(
        summary?.ok && (
          <StatCard
            label="En reintegro"
            value={summary.data.reintegro}
            tone="reintegro"
            description="Readaptación en curso"
            percent={percentOf(summary.data.reintegro, summary.data.total)}
          />
        ),
      ),
    disponibilidad: () => (
      <section className={metricCardClass}>
        {series?.ok ? (
          <AvailabilityChart
            heading="Disponibilidad en el tiempo"
            weeks={series.data}
            keys={["disponible", "lesionado"]}
            height={140}
          />
        ) : (
          <MetricsError />
        )}
      </section>
    ),
    lesiones_semana: () => byWeek && <InjuriesByWeekBlock result={byWeek} />,
    lugar: () => byPlace && <InjuriesByPlaceBlock result={byPlace} />,
    posicion: () => byPosition && <InjuriesByPositionBlock result={byPosition} />,
    recurrentes: () =>
      recurring && (
        <RecurringPlayersBlock result={recurring} status={status} avatarUrls={avatarUrls} />
      ),
    proximas_altas: () =>
      upcoming && <UpcomingReturnsBlock result={upcoming} status={status} avatarUrls={avatarUrls} />,
    asistencia: () => attendance && <AttendanceCard result={attendance} />,
  };

  return (
    <div className={mobile.length > 0 ? "mb-8" : "lg:mb-8"}>
      {metrics.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m) => (
            <div key={m} className={`min-w-0 *:h-full ${visibility(m)} ${SPAN[m]}`}>
              {render[m]()}
            </div>
          ))}
        </div>
      )}
      <div className={`hidden lg:block ${desktop.length > 0 ? "mt-4" : ""}`}>
        <Link href="/metricas" className={`text-sm ${buttonSecondary}`}>
          Ver dashboard completo
        </Link>
      </div>
    </div>
  );
}
