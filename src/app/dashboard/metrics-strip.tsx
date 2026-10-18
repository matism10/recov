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
import type { DashboardMetric } from "@/lib/dashboard-metrics";
import { AvailabilityChart, MetricsError, StatCard, metricCardClass, percentOf } from "@/app/metrics";
import {
  InjuriesByPlaceBlock,
  InjuriesByPositionBlock,
  InjuriesByWeekBlock,
  RecurringPlayersBlock,
  UpcomingReturnsBlock,
} from "@/app/metricas/blocks";
import { buttonSecondary } from "@/app/ui";

// Ancho de cada métrica en la grilla. Celular: una columna (tarjetas lado a lado
// desde sm). Escritorio (4 columnas): tarjetas de 1, bloques de 2 y próximas altas
// a lo ancho.
const SPAN: Record<DashboardMetric, string> = {
  total: "",
  disponibles: "",
  lesionados: "",
  reintegro: "",
  // El gráfico sigue solo en escritorio, como antes.
  disponibilidad: "hidden lg:col-span-2 lg:block",
  lesiones_semana: "sm:col-span-2",
  lugar: "sm:col-span-2",
  posicion: "sm:col-span-2",
  recurrentes: "sm:col-span-2",
  proximas_altas: "sm:col-span-2 lg:col-span-4",
};

// Franja de métricas del Resumen, solo para el staff: las que eligió el head coach
// (o las de siempre). Solo se piden los datos de las métricas elegidas. Quien la
// monta decide si el usuario es staff; las funciones lo validan de nuevo.
export async function MetricsStrip({
  supabase,
  metrics,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  metrics: DashboardMetric[];
}) {
  const has = (m: DashboardMetric) => metrics.includes(m);
  const needsSummary = ["total", "disponibles", "lesionados", "reintegro"].some((m) =>
    has(m as DashboardMetric),
  );

  const [summary, series, byWeek, byPlace, byPosition, recurring, upcoming] = await Promise.all([
    needsSummary ? getDashSummary(supabase) : null,
    has("disponibilidad") ? getAvailabilitySeries(supabase, 12) : null,
    has("lesiones_semana") ? getInjuriesByWeek(supabase, 12) : null,
    has("lugar") ? getInjuriesByPlace(supabase) : null,
    has("posicion") ? getInjuriesByPosition(supabase) : null,
    has("recurrentes") ? getRecurringPlayers(supabase) : null,
    has("proximas_altas") ? getUpcomingReturns(supabase) : null,
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
  };

  return (
    <div className="mb-8">
      {metrics.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m) => (
            <div key={m} className={`min-w-0 *:h-full ${SPAN[m]}`}>
              {render[m]()}
            </div>
          ))}
        </div>
      )}
      <div className={`hidden lg:block ${metrics.length > 0 ? "mt-4" : ""}`}>
        <Link href="/metricas" className={`text-sm ${buttonSecondary}`}>
          Ver dashboard completo
        </Link>
      </div>
    </div>
  );
}
