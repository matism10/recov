import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDirection, type UserRole } from "@/lib/roles";
import { clubLogoUrl } from "@/lib/club-logo";
import { cardClass, textButton } from "@/app/ui";
import { LogoForm } from "./logo-form";
import { CoverForm } from "./cover-form";
import { clubCoverUrl } from "@/lib/club-identity";
import { MetricsForm } from "./metrics-form";
import { DEFAULT_DASHBOARD_METRICS_MOBILE, dashboardMetricsOf } from "@/lib/dashboard-metrics";

// Configuración del club: solo la dirección (head coach y manager).
export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Desde 0005 hay dos relaciones profiles–clubs: hay que nombrar la FK.
  const { data: me } = await supabase
    .from("profiles")
    .select("roles, status, club_id, clubs!profiles_club_id_fkey(name, logo_path, cover_path, cover_position_x, cover_position_y, dashboard_metrics, dashboard_metrics_mobile)")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.status === "pendiente") redirect("/pendiente");
  if (me?.status !== "confirmado" || !isDirection((me.roles ?? []) as UserRole[])) {
    redirect("/dashboard");
  }
  const club = Array.isArray(me.clubs) ? me.clubs[0] : me.clubs;
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
        <h2 className="font-medium text-ink">Logo del club</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Se muestra en el encabezado y en el link de registro del club.
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
          url={await clubCoverUrl(supabase, club?.cover_path)}
          position={{ x: club?.cover_position_x ?? 50, y: club?.cover_position_y ?? 50 }}
          folder={me.club_id}
        />
      </section>

      {isHeadCoach && (
        <section className={`mt-6 p-5 ${cardClass}`}>
          <h2 className="font-medium text-ink">Métricas del Resumen</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            Elige qué métricas ve el staff del club en el Resumen, en computador y en celular.
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
