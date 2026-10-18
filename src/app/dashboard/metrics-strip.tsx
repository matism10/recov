import Link from "next/link";
import type { createClient } from "@/lib/supabase/server";
import { getAvailabilitySeries, getDashSummary } from "@/lib/metrics";
import { AvailabilityChart, MetricsError, StatCard, metricCardClass, percentOf } from "@/app/metrics";
import { buttonSecondary } from "@/app/ui";

// Franja de métricas del dashboard, solo para el staff. En celular muestra solo
// disponibles y lesionados (una tarjeta bajo otra; lado a lado desde sm); desde lg,
// además el gráfico y el enlace al dashboard completo. Quien la monta decide si el
// usuario es staff; las funciones lo validan de nuevo.
export async function MetricsStrip({
  supabase,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
}) {
  const [summary, series] = await Promise.all([
    getDashSummary(supabase),
    getAvailabilitySeries(supabase, 12),
  ]);

  return (
    <div className="mb-8">
      {summary.ok && series.ok ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Jugadores disponibles"
            value={summary.data.disponibles}
            tone="disponible"
            description="Aptos para convocatoria"
            percent={percentOf(summary.data.disponibles, summary.data.total)}
          />
          <StatCard
            label="Jugadores lesionados"
            value={summary.data.lesionados}
            tone="lesionado"
            description="Sin alta médica"
            percent={percentOf(summary.data.lesionados, summary.data.total)}
          />
          <section className={`col-span-2 hidden lg:block ${metricCardClass}`}>
            <AvailabilityChart
              heading="Disponibilidad en el tiempo"
              weeks={series.data}
              keys={["disponible", "lesionado"]}
              height={140}
            />
          </section>
        </div>
      ) : (
        <MetricsError />
      )}
      <div className="mt-4 hidden lg:block">
        <Link href="/metricas" className={`text-sm ${buttonSecondary}`}>
          Ver dashboard completo
        </Link>
      </div>
    </div>
  );
}
