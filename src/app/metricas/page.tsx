import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isStaff, type UserRole } from "@/lib/roles";
import { getAvailabilitySeries, getDashSummary } from "@/lib/metrics";
import { AvailabilityChart, MetricsError, StatCard, percentOf } from "@/app/metrics";
import { textButton } from "@/app/ui";

// Métricas del plantel para el staff. Las funciones dash_* validan en la base que
// quien llama sea staff confirmado de su club.
export default async function MetricsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Desde 0005 hay dos relaciones profiles–clubs: hay que nombrar la FK.
  const { data: me } = await supabase
    .from("profiles")
    .select("roles, status, clubs!profiles_club_id_fkey(name)")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.status === "pendiente") redirect("/pendiente");
  if (me?.status !== "confirmado" || !isStaff((me.roles ?? []) as UserRole[])) {
    redirect("/dashboard");
  }
  const club = Array.isArray(me.clubs) ? me.clubs[0] : me.clubs;

  const [summary, series] = await Promise.all([
    getDashSummary(supabase),
    getAvailabilitySeries(supabase, 12),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 lg:px-8">
      <header className="mb-8">
        <Link href="/dashboard" className={textButton}>
          ← Volver a disponibilidad del plantel
        </Link>
        <p className="mt-2 text-sm text-muted">{club?.name}</p>
        <h1 className="text-2xl font-semibold text-ink">Métricas del plantel</h1>
      </header>

      <section className="mb-8">
        {summary.ok ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total de jugadores"
              value={summary.data.total}
              description="En el plantel"
            />
            <StatCard
              label="Disponibles"
              value={summary.data.disponibles}
              tone="disponible"
              description="Aptos para convocatoria"
              percent={percentOf(summary.data.disponibles, summary.data.total)}
            />
            <StatCard
              label="Lesionados"
              value={summary.data.lesionados}
              tone="lesionado"
              description="Sin alta médica"
              percent={percentOf(summary.data.lesionados, summary.data.total)}
              extra={
                summary.data.en_revision > 0 && (
                  <span className="text-sm font-medium text-revision-fg">
                    +{summary.data.en_revision} en revisión
                  </span>
                )
              }
            />
            <StatCard
              label="En reintegro"
              value={summary.data.reintegro}
              tone="reintegro"
              description="Readaptación en curso"
              percent={percentOf(summary.data.reintegro, summary.data.total)}
            />
          </div>
        ) : (
          <MetricsError />
        )}
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        {series.ok ? (
          <AvailabilityChart
            heading="Disponibilidad en el tiempo"
            weeks={series.data}
            keys={["disponible", "en_revision", "lesionado", "reintegro"]}
            height={260}
          />
        ) : (
          <>
            <h2 className="mb-3 text-sm font-medium text-muted">Disponibilidad en el tiempo</h2>
            <MetricsError />
          </>
        )}
      </section>
    </main>
  );
}
