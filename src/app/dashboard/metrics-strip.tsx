import Link from "next/link";
import type { createClient } from "@/lib/supabase/server";
import { getAvailabilitySeries, getDashSummary } from "@/lib/metrics";
import { AvailabilityChart, MetricsError, StatCard, percentOf } from "@/app/metrics";
import { buttonSecondary } from "@/app/ui";

// Franja de métricas del dashboard: solo en escritorio (lg+) y solo para el staff.
// Quien la monta decide si el usuario es staff; las funciones lo validan de nuevo.
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
    <div className="mb-8 hidden lg:block">
      {summary.ok && series.ok ? (
        <div className="grid grid-cols-4 gap-4">
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
          <section className="col-span-2 rounded-xl border border-line bg-white p-5">
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
      <Link href="/metricas" className={`mt-4 text-sm ${buttonSecondary}`}>
        Ver dashboard completo
      </Link>
    </div>
  );
}
