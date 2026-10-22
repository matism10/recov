import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { isStaff, type UserRole } from "@/lib/roles";
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
import { getTeamLoad } from "@/lib/match-load";
import { LoadSection } from "../load-section";
import { AvailabilityChart, MetricsError, StatCard, metricCardClass, percentOf } from "@/app/metrics";
import { PageTitle, SectionTitle, textButton } from "@/app/ui";
import {
  InjuriesByPlaceBlock,
  InjuriesByPositionBlock,
  InjuriesByWeekBlock,
  RecurringPlayersBlock,
  UpcomingReturnsBlock,
} from "../blocks";

// Métricas del plantel para el staff. Las funciones dash_* validan en la base que
// quien llama sea staff confirmado de su club.
export default async function MetricsPage() {
  const supabase = await getSupabase();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // En paralelo: perfil y todas las métricas (las funciones dash_* y la carga validan
  // que sea staff; si no lo es, se redirige antes de mostrar). Luego, estado y foto
  // solo de los jugadores de "Jugadores recurrentes" y "Próximas altas"; si esa
  // lectura falla, esos bloques usan iniciales y omiten el estado.
  const [me, summary, series, byWeek, byPlace, byPosition, recurring, upcoming, load] = await Promise.all([
    getProfile(user.id),
    getDashSummary(supabase),
    getAvailabilitySeries(supabase, 12),
    getInjuriesByWeek(supabase, 12),
    getInjuriesByPlace(supabase),
    getInjuriesByPosition(supabase),
    getRecurringPlayers(supabase),
    getUpcomingReturns(supabase),
    getTeamLoad(supabase, 4),
  ]);

  if (me?.status === "pendiente") redirect("/pendiente");
  if (me?.status !== "confirmado" || !isStaff((me.roles ?? []) as UserRole[])) {
    redirect("/dashboard");
  }

  const listedIds = [
    ...new Set([
      ...(recurring.ok ? recurring.data.map((p) => p.player_id) : []),
      ...(upcoming.ok ? upcoming.data.map((r) => r.player_id) : []),
    ]),
  ];
  const players = await getPlayersStatus(supabase, listedIds);
  const status = players.ok ? players.data : null;
  const avatarUrls = status
    ? await getAvatarUrls(supabase, [...status.values()].map((p) => p.user_id))
    : new Map<string, string>();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 lg:px-8">
      <header className="mb-8">
        <Link href="/dashboard" className={textButton}>
          ← Volver a disponibilidad del plantel
        </Link>
        <PageTitle className="mt-2">
          Métricas del plantel
        </PageTitle>
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

      <LoadSection result={load} />

      <section className={`mb-8 ${metricCardClass}`}>
        {series.ok ? (
          <AvailabilityChart
            heading="Disponibilidad en el tiempo"
            sectionHeading
            weeks={series.data}
            keys={["disponible", "en_revision", "lesionado", "reintegro"]}
            height={260}
          />
        ) : (
          <>
            <SectionTitle className="mb-3">Disponibilidad en el tiempo</SectionTitle>
            <MetricsError />
          </>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <InjuriesByWeekBlock result={byWeek} />
        <InjuriesByPlaceBlock result={byPlace} />
        <InjuriesByPositionBlock result={byPosition} />
        <RecurringPlayersBlock result={recurring} status={status} avatarUrls={avatarUrls} />
        <div className="lg:col-span-2">
          <UpcomingReturnsBlock result={upcoming} status={status} avatarUrls={avatarUrls} />
        </div>
      </div>
    </main>
  );
}
