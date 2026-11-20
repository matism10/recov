import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveClubId, getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { canSetWellnessDays, isDirection, type UserRole } from "@/lib/roles";
import { clubLogoUrl } from "@/lib/club-logo";
import { buttonSecondary } from "@/app/ui";
import { Card, CardHeader, PageHeader } from "@/app/ui-blocks";
import { LogoForm } from "./logo-form";
import { CoverForm } from "./cover-form";
import { clubCoverUrl } from "@/lib/club-identity";
import { MetricsForm } from "./metrics-form";
import { NominaModeForm } from "./nomina-mode-form";
import type { NominaMode } from "@/lib/match-load";
import { DEFAULT_DASHBOARD_METRICS_MOBILE, dashboardMetricsOf } from "@/lib/dashboard-metrics";
import { SevensToggle } from "./sevens-form";
import { WellnessDaysForm } from "./wellness-days-form";

// Configuración del club: la dirección (head coach y manager) ve todo; el preparador
// físico entra solo para elegir los días del check de bienestar.
export default async function SettingsPage() {
  const supabase = await getSupabase();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // En paralelo: perfil (con el club), si ya hay partidos con participación cargada
  // y los días del check de bienestar. RLS: el staff ve las participaciones de su club.
  const clubId = await getActiveClubId(user.id);
  const [me, { count: loadedCount }, { data: wellness }] = await Promise.all([
    getProfile(user.id),
    supabase
      .from("event_participations")
      .select("callup_id", { count: "exact", head: true })
      .eq("club_id", clubId),
    supabase.from("clubs").select("wellness_days").eq("id", clubId).maybeSingle(),
  ]);

  if (me?.status === "pendiente") redirect("/pendiente");
  const roles = (me?.roles ?? []) as UserRole[];
  const direction = isDirection(roles);
  if (!me || me.status !== "confirmado" || !(direction || canSetWellnessDays(roles))) {
    redirect("/dashboard");
  }
  const wellnessDays = ((wellness?.wellness_days as number[] | null) ?? [1]).map(Number);
  // Un perfil confirmado siempre tiene club; si faltara, al Resumen.
  if (!me.club_id) redirect("/dashboard");
  const club = me.club;
  // Las métricas del Resumen las elige solo el head coach (set_dashboard_metrics lo valida).
  const isHeadCoach = roles.includes("head_coach");

  const wellnessSection = (
    <Card as="section" id="bienestar" className="scroll-mt-4">
      <CardHeader
        title="Check de bienestar"
        subtitle="Elige qué días los jugadores responden las 5 preguntas de bienestar. Quien no alcanza a responder, puede hacerlo al día siguiente."
      />
      <WellnessDaysForm initial={wellnessDays} />
    </Card>
  );

  const header = (
    <PageHeader title="Configuración" description={`Ajustes de ${club?.name ?? "tu plantel"}.`} />
  );
  const mainClass = "mx-auto w-full max-w-3xl flex-1 px-4 py-6 lg:max-w-[1080px] lg:px-8 lg:py-10";

  // Preparador físico (sin rol de dirección): solo el check de bienestar.
  if (!direction) {
    return (
      <main className={mainClass}>
        {header}
        {wellnessSection}
      </main>
    );
  }

  // Índice lateral (solo escritorio): anclas de las secciones que ve esta persona.
  const sections = [
    { id: "logo", label: "Logo del plantel" },
    { id: "portada", label: "Portada" },
    { id: "partidos", label: "Registro de partidos" },
    ...(club?.sport === "rugby" ? [{ id: "sevens", label: "Rugby Sevens" }] : []),
    { id: "bienestar", label: "Check de bienestar" },
    ...(isHeadCoach ? [{ id: "metricas-resumen", label: "Métricas del Resumen" }] : []),
  ];

  return (
    <main className={mainClass}>
      {header}
      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
        <nav aria-label="Secciones" className="sticky top-6 hidden self-start lg:block">
          <ul className="flex flex-col gap-1">
            {sections.map((sec) => (
              <li key={sec.id}>
                <a
                  href={`#${sec.id}`}
                  className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted transition hover:bg-mist hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong"
                >
                  {sec.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-6">
          <Card as="section" id="logo" className="scroll-mt-4">
            <CardHeader
              title="Logo del plantel"
              subtitle="Se muestra en el encabezado y en el link de registro del plantel."
            />
            <LogoForm
              clubName={club?.name ?? ""}
              url={clubLogoUrl(supabase, club?.logo_path)}
              folder={me.club_id}
            />
          </Card>

          <Card as="section" id="portada" className="scroll-mt-4">
            <CardHeader
              title="Portada"
              subtitle="Se muestra arriba del Resumen. Arrastra la foto para encuadrarla."
            />
            <CoverForm
              clubName={club?.name ?? ""}
              url={clubCoverUrl(club?.cover_path)}
              position={{ x: club?.cover_position_x ?? 50, y: club?.cover_position_y ?? 50 }}
              folder={me.club_id}
            />
          </Card>

          <Card as="section" id="partidos" className="scroll-mt-4">
            <CardHeader
              title="Registro de partidos"
              subtitle="Cómo se carga la participación de los convocados en cada partido. Define la carga del plantel en Métricas y en la ficha de cada jugador."
            />
            <NominaModeForm
              mode={(club?.nomina_mode as NominaMode | undefined) ?? "rango"}
              loadedCount={loadedCount ?? 0}
            />
          </Card>

          {club?.sport === "rugby" && (
            <Card as="section" id="sevens" className="scroll-mt-4">
              <CardHeader
                title="Rugby Sevens"
                subtitle="Sevens usa el mismo plantel: fichas, lesiones y evaluaciones son las mismas. Con Sevens activo, el Resumen muestra el selector Rugby 15 | Sevens a la dirección y al grupo Sevens."
              />
              <SevensToggle enabled={club.has_sevens} />
              {club.has_sevens && (
                <Link href="/configuracion/sevens" className={`mt-4 text-sm ${buttonSecondary}`}>
                  Grupo Sevens
                </Link>
              )}
            </Card>
          )}

          {wellnessSection}

          {isHeadCoach && (
            <Card as="section" id="metricas-resumen" className="scroll-mt-4">
              <CardHeader
                title="Métricas del Resumen"
                subtitle="Elige qué métricas ve el staff del plantel en el Resumen, en computador y en celular."
              />
              <MetricsForm
                desktop={dashboardMetricsOf(club?.dashboard_metrics as string[] | null)}
                mobile={dashboardMetricsOf(
                  club?.dashboard_metrics_mobile as string[] | null,
                  DEFAULT_DASHBOARD_METRICS_MOBILE,
                )}
              />
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
