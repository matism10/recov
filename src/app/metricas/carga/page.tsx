import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { isStaff, type UserRole } from "@/lib/roles";
import { getTeamLoad } from "@/lib/match-load";
import { getActiveFormat } from "@/lib/format";
import { MetricsError, metricCardClass } from "@/app/metrics";
import { PageTitle, textButton } from "@/app/ui";
import { LoadIntro, LoadList } from "../load-section";

// Ranking completo de minutos del plantel (solo staff; team_match_load lo valida). Sin semáforo.
export default async function LoadRankingPage() {
  const supabase = await getSupabase();
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // En paralelo: perfil y la carga del plantel (team_match_load valida que sea staff).
  const [me, result] = await Promise.all([getProfile(user.id), getActiveFormat(user.id).then((f) => getTeamLoad(supabase, 4, f))]);
  if (me?.status === "pendiente") redirect("/pendiente");
  if (me?.status !== "confirmado" || !isStaff((me.roles ?? []) as UserRole[])) redirect("/dashboard");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-6">
        <Link href="/metricas?tab=carga" className={textButton}>
          ← Volver a métricas
        </Link>
        <PageTitle className="mt-2">Minutos jugados</PageTitle>
      </header>
      {!result.ok ? (
        <MetricsError />
      ) : result.data.matches_count === 0 ? (
        <p className={`text-sm text-muted ${metricCardClass}`}>
          Aún no hay partidos con participación cargada.
        </p>
      ) : (
        <div className="space-y-4">
          <LoadIntro load={result.data} />
          <section className={metricCardClass}>
            <LoadList load={result.data} players={result.data.players} ranked />
          </section>
        </div>
      )}
    </main>
  );
}
