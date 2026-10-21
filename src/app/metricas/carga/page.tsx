import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isStaff, type UserRole } from "@/lib/roles";
import { getTeamLoad } from "@/lib/match-load";
import { MetricsError, metricCardClass } from "@/app/metrics";
import { PageTitle, textButton } from "@/app/ui";
import { LoadIntro, LoadRanking } from "../load-section";
import { LoadSummary } from "../load-summary";

// Ranking completo de carga del plantel (solo staff; team_match_load lo valida).
export default async function LoadRankingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("roles, status").eq("id", user.id).maybeSingle();
  if (me?.status === "pendiente") redirect("/pendiente");
  if (me?.status !== "confirmado" || !isStaff((me.roles ?? []) as UserRole[])) redirect("/dashboard");

  const result = await getTeamLoad(supabase, 4);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-6">
        <Link href="/metricas" className={textButton}>
          ← Volver a métricas
        </Link>
        <PageTitle className="mt-2">Ranking de carga</PageTitle>
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
          <LoadSummary load={result.data} />
          <LoadRanking load={result.data} />
        </div>
      )}
    </main>
  );
}
