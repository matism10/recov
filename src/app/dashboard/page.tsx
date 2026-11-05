import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ChevronRight, Dumbbell } from "lucide-react";
import { getActiveClubId, getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { signOut } from "@/app/login/actions";
import {
  INJURED_AVAILABILITY,
  canManageInjuries,
  isStaff,
  type Availability,
  type UserRole,
} from "@/lib/roles";
import {
  formatDate,
  formatDayMonth,
  returnLabel,
  type InjuryStatus,
} from "@/lib/injuries";
import { InjuryProgress } from "@/app/lesiones/injury-progress";
import { BodyMapPair, type BodyMark } from "@/app/body-map";
import { BODY_ZONES, isBodyZone, isLaterality, zoneLabel, type BodyZone } from "@/lib/body-zones";
import { Avatar } from "@/app/avatar";
import { getSquad } from "@/lib/squad";
import {
  AvailabilityBadge,
  InjuryStatusBadge,
  NoDocumentBadge,
  PageTitle,
  SectionTitle,
  buttonPrimary,
  buttonSecondary,
  cardClass,
  chipClass,
  textButton,
} from "@/app/ui";
import { SummarySquad } from "./squad-browser";
import { NextMatch } from "./next-match";
import { MetricsStrip, MetricsStripSkeleton, PlayerMetrics, loadMetricsStrip } from "./metrics-strip";
import { getAttendanceRanking } from "@/lib/attendance";
import { MyMatches } from "./my-matches";
import { canManageNominas, getMyLoad } from "@/lib/match-load";
import { ResumenCover } from "./resumen-cover";
import { clubOptions } from "@/lib/club-options";
import { LoadBlock } from "@/app/load-block";
import { DEFAULT_DASHBOARD_METRICS_MOBILE, dashboardMetricsOf } from "@/lib/dashboard-metrics";
import { Block } from "@/app/skeleton";
import { getFormatContext, inFormat, withActiveFormat } from "@/lib/format";
import { FormatSwitch, SevensPositionBanner } from "@/app/sevens-ui";
import { getMyPendingReports } from "@/lib/srpe";
import { MyWellness, PendingReports } from "./pending-reports";
import { getMyGymToday } from "@/lib/gym";
import { GymTodayCard } from "./gym-today";
import { MyWeek } from "./my-week";
import { getWeekData } from "./week-data";

// Jugadores disponibles que muestra el Resumen; el resto está en /plantel.
const RESUMEN_AVAILABLE = 10;

type ReviewRow = {
  id: string;
  type: string;
  status: string;
  started_on: string;
  body_zone: string | null;
  laterality: string | null;
  // Conteo embebido de documents (RLS: cuenta para kine, delegado y head coach).
  documents: { count: number }[] | null;
  players: { full_name: string; user_id: string | null } | { full_name: string; user_id: string | null }[] | null;
};

type OpenInjury = {
  id: string;
  player_id: string;
  type: string;
  started_on: string;
  expected_return_on: string | null;
  body_zone: string | null;
  laterality: string | null;
};

// Zona y lado de una lesión (registro v2); null en las antiguas.
function markOf(i: { body_zone: string | null; laterality: string | null }): BodyMark | null {
  return isBodyZone(i.body_zone) && isLaterality(i.laterality)
    ? { zone: i.body_zone, laterality: i.laterality }
    : null;
}

type MyInjury = {
  id: string;
  type: string;
  status: string;
  started_on: string;
  expected_return_on: string | null;
  closed_on: string | null;
};

export default async function DashboardPage() {
  const supabase = await getSupabase();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Todo lo que no depende de otra consulta va en paralelo. El perfil (RLS: solo el
  // propio) decide el rol; apenas llega, salen las consultas que dependen del rol,
  // la franja de métricas y la portada, sin esperar al plantel.
  const profilePromise = getProfile(user.id);
  // Plantel activo: filtra las listas (RLS devuelve las de todos los planteles de la cuenta).
  const clubIdPromise = getActiveClubId(user.id);
  const confirmed = profilePromise.then((p) => (p?.status === "confirmado" ? p : null));
  // Formato activo (Rugby 15 o Sevens) y grupo Sevens del plantel. Las consultas que
  // dependen del formato no lo esperan: parten con el de la cookie (withActiveFormat).
  const formatPromise = getFormatContext(user.id);

  const byRolePromise = confirmed.then(async (profile) => {
    if (!profile) return null;
    const roles = (profile.roles ?? []) as UserRole[];
    const staff = isStaff(roles);
    const isPlayer = roles.includes("jugador");
    // Kinesiólogo, delegado y head coach: cambian disponibilidad y gestionan lesiones.
    // Solo decide qué se muestra; las funciones de la base validan el permiso real.
    const canManage = canManageInjuries(roles, user.id, profile.club?.kine_delegate_id);
    const [myLoad, open, myInjuries, toReview, myPending, myReports, myWellness, myGym, week] = await Promise.all([
      // Jugador: su carga de partidos y sus convocatorias del formato activo (solo datos propios).
      isPlayer ? withActiveFormat(user.id, (format) => getMyLoad(supabase, format)) : null,
      // "Lesiones activas" (staff): lesiones abiertas del club (RLS); abajo se toman
      // solo las de los jugadores en Lesionado o Reintegro.
      staff
        ? supabase
            .from("injuries")
            .select("id, player_id, type, started_on, expected_return_on, body_zone, laterality")
            .eq("club_id", profile.club_id!)
            .in("status", ["en_evaluacion", "activa"])
            .then(({ data }) => (data ?? []) as OpenInjury[])
        : [],
      // "Mis lesiones" (jugador). RLS: el jugador ve solo las suyas; se filtra por
      // si además es staff.
      isPlayer
        ? supabase
            .from("injuries")
            .select(
              "id, type, status, started_on, expected_return_on, closed_on, players!inner(user_id)",
            )
            .eq("club_id", profile.club_id!)
            .eq("players.user_id", user.id)
            .order("started_on", { ascending: false })
            .then(({ data }) => data as MyInjury[] | null)
        : null,
      // Bandeja "Por revisar": lesiones esperando el diagnóstico del jugador y
      // diagnósticos que el jugador ya subió y nadie ha revisado. En Sevens se filtra
      // abajo por el grupo (con el user_id del jugador), sin otra consulta.
      canManage
        ? supabase
            .from("injuries")
            .select("id, type, status, started_on, body_zone, laterality, documents(count), players(full_name, user_id)")
            .eq("club_id", profile.club_id!)
            .or("status.eq.en_evaluacion,and(status.eq.activa,reviewed_at.is.null)")
            .order("started_on")
            .then(({ data }) => (data ?? []) as ReviewRow[])
        : [],
      // RLS: el jugador ve solo sus lesiones; se filtra por si además es staff.
      isPlayer
        ? supabase
            .from("injuries")
            .select("id, players!inner(user_id)")
            .eq("club_id", profile.club_id!)
            .eq("status", "en_evaluacion")
            .eq("players.user_id", user.id)
            .limit(1)
            .maybeSingle()
            .then(({ data }) => data as { id: string } | null)
        : null,
      // Pendientes del jugador (sRPE y bienestar) en el formato activo.
      isPlayer ? withActiveFormat(user.id, (format) => getMyPendingReports(supabase, format)) : [],
      // "Mi bienestar": su último check. RLS: el jugador ve solo los suyos.
      isPlayer
        ? supabase
            .from("wellness_reports")
            .select("report_date, total, players!inner(user_id)")
            .eq("club_id", profile.club_id!)
            .eq("players.user_id", user.id)
            .order("report_date", { ascending: false })
            .limit(1)
            .maybeSingle()
            .then(({ data }) => (data ? { report_date: data.report_date as string, total: data.total as number } : null))
        : null,
      // Plan de gimnasio de hoy (jugador; el gimnasio no tiene formato).
      isPlayer ? getMyGymToday(supabase) : null,
      // "Mi semana" (todos): eventos del formato activo y sesiones de gimnasio.
      withActiveFormat(user.id, (format) =>
        getWeekData(supabase, profile.club_id!, format, { player: isPlayer, staff }),
      ),
    ]);
    return { myLoad, open, myInjuries, toReview, myPending, myReports, myWellness, myGym, week };
  });

  // Franja de métricas (staff): sus datos salen ya, en paralelo con el resto, y la
  // página no los espera: la franja llega aparte (Suspense). En Sevens, las métricas
  // son del grupo Sevens (0046).
  const metricsPromise = confirmed.then((profile) =>
    profile && isStaff((profile.roles ?? []) as UserRole[])
      ? withActiveFormat(user.id, (format) =>
          loadMetricsStrip(
            supabase,
            dashboardMetricsOf(profile.club?.dashboard_metrics ?? null),
            dashboardMetricsOf(profile.club?.dashboard_metrics_mobile ?? null, DEFAULT_DASHBOARD_METRICS_MOBILE),
            format,
          ),
        )
      : null,
  );
  // Jugador (y quien no es staff): la tarjeta de asistencia si el head coach la eligió.
  const playerMetricsPromise = confirmed.then((profile) => {
    if (!profile || isStaff((profile.roles ?? []) as UserRole[])) return null;
    const chosen = [
      ...dashboardMetricsOf(profile.club?.dashboard_metrics ?? null),
      ...dashboardMetricsOf(profile.club?.dashboard_metrics_mobile ?? null, DEFAULT_DASHBOARD_METRICS_MOBILE),
    ];
    return chosen.includes("asistencia") ? getAttendanceRanking(supabase, "mes") : null;
  });
  const [profile, squad, { data: nextMatch }, byRole, formatCtx] = await Promise.all([
    profilePromise,
    // Plantel confirmado y activo, con fotos y la fase en curso de cada jugador.
    clubIdPromise.then((clubId) => getSquad(supabase, clubId)),
    // Próximo partido: la competencia no cancelada más cercana del plantel activo,
    // del formato activo.
    clubIdPromise.then((clubId) =>
      withActiveFormat(user.id, (format) =>
        supabase
          .from("events")
          .select("id, starts_at, opponent")
          .eq("club_id", clubId)
          .eq("type", "competencia")
          .eq("format", format)
          .is("cancelled_at", null)
          .gte("starts_at", new Date().toISOString())
          .order("starts_at")
          .limit(1)
          .maybeSingle(),
      ),
    ),
    byRolePromise,
    formatPromise,
  ]);

  if (profile?.status === "pendiente") redirect("/pendiente");

  // Sin perfil o rechazado: no tiene acceso a los datos del club.
  if (!profile || profile.status !== "confirmado" || !byRole) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-semibold text-ink">
          Tu cuenta aún no está asociada a un plantel
        </h1>
        <p className="max-w-md text-muted">
          Pide a la dirección de tu plantel que te envíe su link.
        </p>
        <form action={signOut}>
          <button className={textButton}>
            Cerrar sesión
          </button>
        </form>
      </main>
    );
  }

  const { avatarUrls, phaseByPlayer } = squad;
  // En Sevens, las listas muestran solo al grupo Sevens.
  const players = inFormat(squad.players, formatCtx);
  // Aviso para elegir posición: en Sevens, solo a los jugadores del grupo sin posición
  // (el staff del grupo no lo ve).
  const mySevens = formatCtx.group.get(user.id);
  const askSevensPosition =
    formatCtx.format === "7" &&
    (profile.roles ?? []).includes("jugador") &&
    mySevens !== undefined &&
    !mySevens.position;
  // En el Resumen, solo los primeros disponibles; el plantel completo está en /plantel.
  const availablePlayers = players
    .filter((p) => p.availability === "disponible")
    .slice(0, RESUMEN_AVAILABLE);

  const club = profile.club;
  const roles = (profile.roles ?? []) as UserRole[];
  const canManage = canManageInjuries(roles, user.id, club?.kine_delegate_id);
  // Arma nóminas: head coach, manager y el delegado de nóminas (solo decide qué se muestra).
  const canNomina = canManageNominas(roles, user.id, club?.nomina_delegate_id);

  const staff = isStaff(roles);
  const isPlayer = roles.includes("jugador");
  const metricsDesktop = dashboardMetricsOf(club?.dashboard_metrics as string[] | null);
  const metricsMobile = dashboardMetricsOf(
    club?.dashboard_metrics_mobile as string[] | null,
    DEFAULT_DASHBOARD_METRICS_MOBILE,
  );
  // Estado propio (rol jugador): su fila del plantel que ya trae getSquad, y la
  // fase en curso de squad_current_phases. Sin consultas nuevas.
  const me = isPlayer ? players.find((p) => p.user_id === user.id) : undefined;
  const myStatus = me?.availability as Availability | undefined;
  const myPhase = me && myStatus === "lesionado" ? phaseByPlayer.get(me.id) : undefined;
  // Jugador: su carga de partidos y sus convocatorias (solo si tiene ficha en el plantel).
  const myLoad = me ? byRole.myLoad : null;

  // "Lesiones activas" (staff): jugadores en Lesionado o Reintegro, con el id, el
  // inicio y la fecha de regreso de su lesión abierta.
  const injuredPlayers = players.filter((p) =>
    (INJURED_AVAILABILITY as readonly string[]).includes(p.availability),
  );
  const injuredIds = new Set(injuredPlayers.map((p) => p.id));
  const openByPlayer = new Map<
    string,
    { id: string; type: string; startedOn: string; expectedReturnOn: string | null }
  >();
  // Si tiene más de una lesión abierta, manda la que termina más tarde.
  for (const i of byRole.open) {
    if (!injuredIds.has(i.player_id)) continue;
    const current = openByPlayer.get(i.player_id)?.expectedReturnOn;
    if (!current || (i.expected_return_on && i.expected_return_on > current)) {
      openByPlayer.set(i.player_id, {
        id: i.id,
        type: i.type,
        startedOn: i.started_on,
        expectedReturnOn: i.expected_return_on,
      });
    }
  }

  // Mapa de zonas (staff): lesiones abiertas de los jugadores de la lista (en Sevens,
  // solo el grupo) que tienen zona. Las antiguas sin zona solo se cuentan.
  const listedIds = new Set(players.map((p) => p.id));
  const openListed = byRole.open.filter((i) => listedIds.has(i.player_id));
  const zoneMarks = openListed.map(markOf).filter((m): m is BodyMark => m !== null);
  const withoutZone = openListed.length - zoneMarks.length;
  const zoneCounts = new Map<BodyZone, number>();
  for (const m of zoneMarks) zoneCounts.set(m.zone, (zoneCounts.get(m.zone) ?? 0) + 1);
  const zoneLegend = [...zoneCounts.entries()].sort((a, b) => b[1] - a[1]);

  // Cada fila de "Lesiones activas" lleva directo al detalle de su lesión. Si el
  // jugador figura lesionado sin una lesión abierta (cambio manual de disponibilidad),
  // va a su ficha.
  const injuryHref = (playerId: string, injury?: { id: string }) =>
    injury ? `/lesiones/${injury.id}` : `/jugadores/${playerId}`;

  const injuries = byRole.myInjuries;
  // En Sevens, "Por revisar" muestra solo las lesiones de los jugadores del grupo.
  const toReview =
    formatCtx.format === "7"
      ? byRole.toReview.filter((i) => {
          const player = Array.isArray(i.players) ? i.players[0] : i.players;
          return !!player?.user_id && formatCtx.group.has(player.user_id);
        })
      : byRole.toReview;
  const awaitingDiagnosis = toReview.filter((i) => i.status === "en_evaluacion");
  const diagnosisToReview = toReview.filter((i) => i.status === "activa");
  const myPendingInjury = byRole.myPending;

  return (
    <>
    {/* Portada del club: solo en el Resumen, no en el layout. */}
    {club?.cover_path && (
      <ResumenCover
        club={{ ...club, cover_path: club.cover_path }}
        fullName={profile.full_name ?? ""}
        avatarPath={profile.avatar_path ?? null}
        clubs={clubOptions(supabase, profile)}
      />
    )}
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:max-w-6xl lg:px-8">
      {/* Selector de formato: solo aquí, y solo si la cuenta puede trabajar en Sevens. */}
      {formatCtx.canSevens && <FormatSwitch format={formatCtx.format} />}
      {askSevensPosition && <SevensPositionBanner />}
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <PageTitle>Disponibilidad del plantel</PageTitle>
          {myStatus && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink">
              Tu estado
              <AvailabilityBadge status={myStatus} />
              {myPhase && <span className="text-muted">· {myPhase}</span>}
            </p>
          )}
        </div>
        {/* Escritorio: próximo partido arriba a la derecha. */}
        {nextMatch && (
          <NextMatch match={nextMatch} canNomina={canNomina} className="hidden lg:inline-flex" />
        )}
      </header>

      {/* Franja de métricas: solo staff. En celular, disponibles y lesionados, justo
          bajo el título. */}
      {/* Llega aparte: el resto del Resumen no la espera. key: al cambiar de formato
          muestra el esqueleto en vez de dejar las cifras del otro formato. */}
      {staff && (
        <Suspense key={formatCtx.format} fallback={<MetricsStripSkeleton desktop={metricsDesktop} mobile={metricsMobile} />}>
          <MetricsStrip data={metricsPromise} desktop={metricsDesktop} mobile={metricsMobile} />
        </Suspense>
      )}
      {/* Jugador: sesiones y check de bienestar por responder (solo si hay). */}
      {me && <PendingReports items={byRole.myReports} />}
      {/* Jugador: "Hoy toca gimnasio" y el registro de una sesión por su cuenta. */}
      {me && <GymTodayCard data={byRole.myGym} />}
      <MyWeek data={byRole.week} />

      {!staff && (metricsDesktop.includes("asistencia") || metricsMobile.includes("asistencia")) && (
        <Suspense fallback={<Block className="mb-8 min-h-56" />}>
          <PlayerMetrics data={playerMetricsPromise} desktop={metricsDesktop} mobile={metricsMobile} />
        </Suspense>
      )}

      {/* Celular: el próximo partido a lo ancho. */}
      {nextMatch && (
        <NextMatch match={nextMatch} canNomina={canNomina} stacked className="mb-6 flex w-full lg:hidden" />
      )}

      {myPendingInjury && (
        <div className="mb-8 space-y-3 rounded-xl border border-brand-strong bg-brand-soft p-5">
          <div>
            <p className="font-medium text-ink">
              Tienes una lesión en evaluación: sube tu diagnóstico
            </p>
            <p className="mt-1 text-sm text-ink">
              Agrega lo que te indicó el médico y tus documentos para que el kinesiólogo
              la revise.
            </p>
          </div>
          <Link href={`/lesiones/${myPendingInjury.id}/completar`} className={buttonPrimary}>
            Sube tu diagnóstico
          </Link>
        </div>
      )}

      {canManage && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-4">
            <SectionTitle>
              Por revisar
              {toReview.length > 0 && (
                <span className={`ml-1.5 ${chipClass}`}>
                  {toReview.length}
                </span>
              )}
            </SectionTitle>
          </div>
          {toReview.length > 0 ? (
            <div className="space-y-3">
              {[
                { title: "Diagnóstico por revisar", items: diagnosisToReview },
                { title: "Esperando el diagnóstico del jugador", items: awaitingDiagnosis },
              ]
                .filter((group) => group.items.length > 0)
                .map((group) => (
                  <div key={group.title}>
                    <h3 className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
                      {group.title} ({group.items.length})
                    </h3>
                    <ul className="divide-y divide-line overflow-hidden rounded-xl bg-mist border border-line">
                      {group.items.map((i) => {
                        const player = Array.isArray(i.players) ? i.players[0] : i.players;
                        return (
                          <li key={i.id}>
                            <Link
                              href={`/lesiones/${i.id}`}
                              className="flex items-center justify-between gap-4 px-5 py-3 transition hover:bg-white"
                            >
                              <div>
                                <p className="font-medium text-ink">
                                  {(() => {
                                    const mark = markOf(i);
                                    const title = mark ? zoneLabel(mark.zone, mark.laterality) : i.type;
                                    return player ? `${player.full_name} · ${title}` : title;
                                  })()}
                                </p>
                                <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                                  Desde el {formatDate(i.started_on)}
                                  {(i.documents?.[0]?.count ?? 0) === 0 && <NoDocumentBadge />}
                                </p>
                              </div>
                              <span className="text-sm font-medium text-brand-text underline">
                                Revisa
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
            </div>
          ) : (
            <p className={`p-5 text-sm text-muted ${cardClass}`}>
              No hay lesiones por revisar.
            </p>
          )}
        </section>
      )}

      {staff && (
        <section className="mb-8">
          <SectionTitle className="mb-3">Lesiones activas</SectionTitle>
          {injuredPlayers.length > 0 ? (
            <>
              <ul className="divide-y divide-line overflow-hidden rounded-xl bg-mist border border-line lg:hidden">
                {injuredPlayers.map((p) => {
                  const status = p.availability as Availability;
                  const injury = openByPlayer.get(p.id);
                  return (
                    <li key={p.id}>
                      <Link
                        href={injuryHref(p.id, injury)}
                        className="block space-y-3 px-5 py-4 transition hover:bg-white"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar name={p.full_name} url={p.user_id ? avatarUrls.get(p.user_id) : null} />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-ink">{p.full_name}</p>
                            {injury && <p className="text-sm text-ink">{injury.type}</p>}
                            <p className="text-sm text-muted">
                              {returnLabel(injury?.expectedReturnOn ?? null)}
                            </p>
                          </div>
                          <AvailabilityBadge status={status} />
                          <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted" />
                        </div>
                        {injury?.expectedReturnOn && (
                          <InjuryProgress
                            startedOn={injury.startedOn}
                            expectedReturnOn={injury.expectedReturnOn}
                          />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {/* En escritorio, la misma lista como tabla. */}
              <div className="hidden overflow-x-auto rounded-xl border border-line bg-mist lg:block">
                <table className="w-full text-left">
                  <thead className="text-sm text-muted">
                    <tr className="border-b border-line">
                      <th scope="col" className="py-3 pr-3 pl-5 font-medium">
                        Jugador
                      </th>
                      <th scope="col" className="px-3 py-3 font-medium">
                        Fase en curso
                      </th>
                      <th scope="col" className="px-3 py-3 font-medium">
                        Regreso estimado
                      </th>
                      <th scope="col" className="px-3 py-3 font-medium">
                        Progreso
                      </th>
                      <th scope="col" className="py-3 pl-3 font-medium">
                        Estado
                      </th>
                      {/* Columna del chevron: decorativa. */}
                      <td aria-hidden="true" className="w-10 pr-5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {injuredPlayers.map((p) => {
                      const injury = openByPlayer.get(p.id);
                      return (
                        // Fila clicable: el único enlace (el nombre) se extiende sobre toda la fila.
                        <tr key={p.id} className="relative transition hover:bg-white">
                          <td className="py-3 pr-3 pl-5">
                            <Link
                              href={injuryHref(p.id, injury)}
                              className="flex min-h-11 items-center gap-3 after:absolute after:inset-0 after:content-['']"
                            >
                              <Avatar name={p.full_name} url={p.user_id ? avatarUrls.get(p.user_id) : null} />
                              <span>
                                <span className="block font-medium text-ink">{p.full_name}</span>
                                {injury && (
                                  <span className="block text-sm text-ink">{injury.type}</span>
                                )}
                              </span>
                            </Link>
                          </td>
                          <td className="px-3 py-3 text-sm text-muted">
                            {phaseByPlayer.get(p.id)}
                          </td>
                          <td className="px-3 py-3 text-sm text-muted">
                            {returnLabel(injury?.expectedReturnOn ?? null)}
                          </td>
                          <td className="w-56 px-3 py-3">
                            {injury?.expectedReturnOn && (
                              <InjuryProgress
                                startedOn={injury.startedOn}
                                expectedReturnOn={injury.expectedReturnOn}
                              />
                            )}
                          </td>
                          <td className="py-3 pl-3">
                            <AvailabilityBadge status={p.availability as Availability} />
                          </td>
                          <td aria-hidden="true" className="w-10 py-3 pr-5">
                            <ChevronRight className="size-5 text-muted" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className={`p-5 text-sm text-muted ${cardClass}`}>
              No hay jugadores lesionados ni en reintegro.
            </p>
          )}
        </section>
      )}

      {staff && zoneMarks.length > 0 && (
        <section className="mb-8">
          <SectionTitle className="mb-3">Zonas lesionadas</SectionTitle>
          <div className={`grid grid-cols-1 items-center gap-6 p-5 sm:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] ${cardClass}`}>
            <BodyMapPair heat={zoneMarks} legend className="mx-auto w-full max-w-80" />
            <div className="min-w-0">
              <ul className="divide-y divide-line">
                {zoneLegend.map(([zone, count]) => (
                  <li key={zone} className="flex items-center justify-between gap-4 py-2 text-sm">
                    <span className="text-ink">{BODY_ZONES[zone].label}</span>
                    <span className="font-semibold tabular-nums text-ink">{count}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">
                Lesiones abiertas (en evaluación o activas) del plantel.
                {withoutZone > 0 &&
                  ` ${withoutZone === 1 ? "1 lesión no tiene" : `${withoutZone} lesiones no tienen`} zona registrada.`}
              </p>
            </div>
          </div>
        </section>
      )}

      {isPlayer && (
        <Link
          href="/evaluaciones/mias"
          className="mb-8 flex min-h-14 items-center gap-3 rounded-xl border border-line bg-mist px-4 py-3 transition hover:bg-white"
        >
          <Dumbbell aria-hidden="true" className="size-5 shrink-0 text-brand-strong" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-ink">Mis evaluaciones</span>
            <span className="block text-sm text-muted">Tus tests físicos, tu progreso y tu puesto en el plantel.</span>
          </span>
          <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted" />
        </Link>
      )}

      {isPlayer && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-4">
            <SectionTitle>Mis lesiones</SectionTitle>
            <Link
              href="/registrar-lesion"
              className={`text-sm ${buttonPrimary}`}
            >
              Registra una lesión
            </Link>
          </div>
          {injuries && injuries.length > 0 ? (
            <ul className="divide-y divide-line overflow-hidden rounded-xl bg-mist border border-line">
              {injuries.map((i) => {
                return (
                  <li key={i.id}>
                    <Link
                      href={`/lesiones/${i.id}`}
                      className="block space-y-2 px-5 py-4 transition hover:bg-white"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-ink">{i.type}</p>
                          <p className="text-sm text-muted">
                            Desde el {formatDate(i.started_on)}
                          </p>
                        </div>
                        <InjuryStatusBadge status={i.status as InjuryStatus} />
                      </div>
                      {i.status === "cerrada" && i.closed_on ? (
                        // Cerrada: la fecha de alta en vez de la barra al 100 %.
                        <p className="text-sm text-muted">Alta el {formatDayMonth(i.closed_on)}</p>
                      ) : (
                        i.status !== "en_evaluacion" && (
                          <InjuryProgress
                            startedOn={i.started_on}
                            expectedReturnOn={i.expected_return_on}
                          />
                        )
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={`p-5 text-sm text-muted ${cardClass}`}>
              No has registrado lesiones.
            </p>
          )}
        </section>
      )}

      {me && myLoad && (
        <>
          <div className="mb-8 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-6">
            <LoadBlock
              title="Mi carga"
              load={myLoad.ok ? myLoad.data : null}
              player={myLoad.ok ? myLoad.data.player : null}
              error={!myLoad.ok}
            />
            <MyWellness last={byRole.myWellness} />
          </div>
          {myLoad.ok && (
            <MyMatches
              callups={myLoad.data.callups}
              scale={myLoad.data.scale}
              starters={myLoad.data.starters ?? 0}
              now={new Date().toISOString()}
            />
          )}
        </>
      )}

      <section>
        <SectionTitle className="mb-3">Plantel</SectionTitle>
        {players.length === 0 ? (
          <p className={`p-8 text-center text-muted ${cardClass}`}>
            Aún no hay jugadores registrados en tu plantel.
          </p>
        ) : (
          // Sin búsqueda: los primeros disponibles. Al escribir: todo el plantel.
          <SummarySquad
            players={players}
            shown={availablePlayers}
            emptyText="No hay jugadores disponibles."
            avatarUrls={avatarUrls}
            phaseByPlayer={phaseByPlayer}
            canManage={canManage}
            linkToProfile={staff}
          />
        )}
        {players.length > 0 && (
          <Link href="/plantel" className={`mt-4 text-sm ${buttonSecondary}`}>
            Ver plantel completo
          </Link>
        )}
      </section>
    </main>
    </>
  );
}
