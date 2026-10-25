import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveClubId, getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { isDirection, type UserRole } from "@/lib/roles";
import { clubLogoUrl } from "@/lib/club-logo";
import { cardClass, textButton } from "@/app/ui";
import { LogoForm } from "./logo-form";
import { CoverForm } from "./cover-form";
import { clubCoverUrl } from "@/lib/club-identity";
import { MetricsForm } from "./metrics-form";
import { NominaModeForm } from "./nomina-mode-form";
import type { NominaMode } from "@/lib/match-load";
import { DEFAULT_DASHBOARD_METRICS_MOBILE, dashboardMetricsOf } from "@/lib/dashboard-metrics";

// Configuración del club: solo la dirección (head coach y manager).
export default async function SettingsPage() {
  const supabase = await getSupabase();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // En paralelo: perfil (con el club) y si ya hay partidos con participación cargada.
  // RLS: la dirección (staff) ve las participaciones de su club.
  const clubId = await getActiveClubId(user.id);
  const [me, { count: loadedCount }] = await Promise.all([
    getProfile(user.id),
    supabase
      .from("event_participations")
      .select("callup_id", { count: "exact", head: true })
      .eq("club_id", clubId),
  ]);

  if (me?.status === "pendiente") redirect("/pendiente");
  if (!me || me.status !== "confirmado" || !isDirection((me.roles ?? []) as UserRole[])) {
    redirect("/dashboard");
  }
  // Un perfil confirmado siempre tiene club; si faltara, al Resumen.
  if (!me.club_id) redirect("/dashboard");
  const club = me.club;
  // Las métricas del Resumen las elige solo el head coach (set_dashboard_metrics lo valida).
  const isHeadCoach = ((me.roles ?? []) as UserRole[]).includes("head_coach");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-8">
        <Link href="/dashboard" className={textButton}>
          ← Volver al resumen
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Configuración</h1>
        <p className="mt-1 text-sm text-muted">Ajustes de {club?.name}.</p>
      </header>

      <section className={`p-5 ${cardClass}`}>
        <h2 className="font-medium text-ink">Logo del plantel</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Se muestra en el encabezado y en el link de registro del plantel.
        </p>
        <LogoForm
          clubName={club?.name ?? ""}
          url={clubLogoUrl(supabase, club?.logo_path)}
          folder={me.club_id}
        />
      </section>

      <section className={`mt-6 p-5 ${cardClass}`}>
        <h2 className="font-medium text-ink">Portada</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Se muestra arriba del Resumen. Arrastra la foto para encuadrarla.
        </p>
        <CoverForm
          clubName={club?.name ?? ""}
          url={clubCoverUrl(club?.cover_path)}
          position={{ x: club?.cover_position_x ?? 50, y: club?.cover_position_y ?? 50 }}
          folder={me.club_id}
        />
      </section>

      <section className={`mt-6 p-5 ${cardClass}`}>
        <h2 className="font-medium text-ink">Registro de partidos</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Cómo se carga la participación de los convocados en cada partido. Define la carga
          del plantel en Métricas y en la ficha de cada jugador.
        </p>
        <NominaModeForm
          mode={(club?.nomina_mode as NominaMode | undefined) ?? "rango"}
          loadedCount={loadedCount ?? 0}
        />
      </section>

      {isHeadCoach && (
        <section className={`mt-6 p-5 ${cardClass}`}>
          <h2 className="font-medium text-ink">Métricas del Resumen</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            Elige qué métricas ve el staff del plantel en el Resumen, en computador y en celular.
          </p>
          <MetricsForm
            desktop={dashboardMetricsOf(club?.dashboard_metrics as string[] | null)}
            mobile={dashboardMetricsOf(
              club?.dashboard_metrics_mobile as string[] | null,
              DEFAULT_DASHBOARD_METRICS_MOBILE,
            )}
          />
        </section>
      )}
    </main>
  );
}
