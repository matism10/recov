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
  recoveryProgress,
  type InjuryStatus,
} from "@/lib/injuries";
import { Card, PlayerCard, PlayerCardList } from "@/app/ui-blocks";
import { type BodyMark } from "@/app/body-map";
import { isBodyZone, isLaterality, type BodyZone } from "@/lib/body-zones";
import { getSquad } from "@/lib/squad";
import {
  AvailabilityBadge,
  InjuryStatusBadge,
  PageTitle,
  SectionTitle,
  buttonPrimary,
  textButton,
} from "@/app/ui";
import { MyStatusCard } from "./my-status";
import { NextMatch } from "./next-match";
import {
  ChartsSkeleton,
  PlayerMetrics,
  StaffMetricCharts,
  StaffStatStrip,
  StatStripSkeleton,
  isChartMetric,
  loadMetricsStrip,
} from "./metrics-strip";
import { ZonesCard } from "./zones-card";
import {
  ActiveInjuriesSection,
  ReviewSection,
  SquadLink,
  type ActiveItem,
  type ReviewItem,
} from "./staff-blocks";
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
import { MyWellness } from "./pending-reports";
import {
  getMyNotifications,
  getMyStaffStateNotifications,
  getMyStateNotifications,
  playerStateCard,
  sortCards,
  staffStateCard,
  storedCard,
  type NoticeCard,
} from "@/lib/notifications";
import { AttentionStrip } from "./attention-strip";
import { getMyGymToday } from "@/lib/gym";
import { GymTodayCard } from "./gym-today";
import { MyWeek } from "./my-week";
import { MyAbsenceBlock } from "./my-absence";
import { getMyAbsences } from "@/lib/absences";
import { getWeekData } from "./week-data";

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
    const [myLoad, open, myInjuries, toReview, myPending, myState, myWellness, myGym, week, notices, staffState, myAbsences] = await Promise.all([
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
      // Notificaciones de estado del jugador (sRPE, esfuerzo del gimnasio y bienestar por
      // responder) en el formato activo. Reemplazan al antiguo bloque "Pendientes".
      isPlayer ? withActiveFormat(user.id, (format) => getMyStateNotifications(supabase, format)) : [],
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
      // Notificaciones de evento (todas las cuentas; RLS: solo las propias).
      getMyNotifications(supabase, profile.club_id!),
      // Notificaciones de estado del staff, según sus permisos y el formato activo.
      staff ? withActiveFormat(user.id, (format) => getMyStaffStateNotifications(supabase, format)) : [],
      // Ausencias avisadas del jugador (propias y parón del plantel).
      isPlayer ? getMyAbsences(supabase) : [],
    ]);
    return { myLoad, open, myInjuries, toReview, myPending, myState, myWellness, myGym, week, notices, staffState, myAbsences };
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
  const myPhase =
    me && (myStatus === "lesionado" || myStatus === "reintegro") ? phaseByPlayer.get(me.id) : undefined;
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
  const myPendingInjury = byRole.myPending;

  // Notificaciones: de evento (guardadas) y de estado (calculadas), ya ordenadas.
  // Las de estado del jugador solo si tiene ficha en el plantel del formato activo.
  const noticeCards = sortCards(
    [
      ...byRole.notices.map((n) => storedCard(n, { clubName: club?.name ?? null, isPlayer })),
      ...(me ? byRole.myState.map(playerStateCard) : []),
      ...byRole.staffState.map(staffStateCard),
    ].filter((c): c is NoticeCard => c !== null),
  );
  // "Sube tu diagnóstico": si ya está la notificación de esa lesión (11), no se repite
  // la tarjeta grande; al descartarla, la tarjeta vuelve mientras siga en evaluación.
  const diagnosisNotified =
    !!myPendingInjury &&
    byRole.notices.some((n) => n.kind === "marcado_lesionado" && n.payload?.injury_id === myPendingInjury.id);

  // Datos de las tarjetas del staff.
  const reviewItems: ReviewItem[] = toReview.map((i) => {
    const player = Array.isArray(i.players) ? i.players[0] : i.players;
    return {
      id: i.id,
      status: i.status,
      type: i.type,
      startedOn: i.started_on,
      mark: markOf(i),
      playerName: player?.full_name ?? null,
      photoUrl: (player?.user_id && avatarUrls.get(player.user_id)) || null,
      hasDocument: (i.documents?.[0]?.count ?? 0) > 0,
    };
  });
  const activeItems: ActiveItem[] = injuredPlayers.map((p) => {
    const injury = openByPlayer.get(p.id);
    return {
      playerId: p.id,
      name: p.full_name,
      photoUrl: (p.user_id && avatarUrls.get(p.user_id)) || null,
      availability: p.availability as Availability,
      href: injuryHref(p.id, injury),
      injuryType: injury?.type ?? null,
      startedOn: injury?.startedOn ?? null,
      expectedReturnOn: injury?.expectedReturnOn ?? null,
    };
  });
  const chartsDesktop = metricsDesktop.some(isChartMetric);
  const chartsMobile = metricsMobile.some(isChartMetric);
  const chartsClass = chartsDesktop && chartsMobile ? "flex" : chartsDesktop ? "hidden lg:flex" : "flex lg:hidden";

  // Bloques del jugador (también los ve quien es staff y jugador a la vez).
  const absenceGym = me && (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start lg:gap-6">
      {/* Jugador: "Avisar una ausencia" y su estado si está ausente varios días. */}
      <MyAbsenceBlock absences={byRole.myAbsences} />
      {/* Jugador: "Hoy toca gimnasio" y el registro de una sesión por su cuenta. */}
      <GymTodayCard data={byRole.myGym} />
    </div>
  );
  const pendingBanner = myPendingInjury && !diagnosisNotified && (
    <div className="space-y-3 rounded-xl border border-brand-strong bg-brand-soft p-4 lg:p-5">
      <div>
        <p className="font-medium text-ink">Tienes una lesión en evaluación: sube tu diagnóstico</p>
        <p className="mt-1 text-sm text-ink">
          Agrega lo que te indicó el médico y tus documentos para que el kinesiólogo la revise.
        </p>
      </div>
      <Link href={`/lesiones/${myPendingInjury.id}/completar`} className={buttonPrimary}>
        Sube tu diagnóstico
      </Link>
    </div>
  );
  const myInjuriesShown = (injuries ?? []).slice(0, 3);
  const playerSections = (
    <>
      {isPlayer && (
        <section id="mis-lesiones" className="scroll-mt-4">
          <div className="mb-3 flex items-center justify-between gap-4">
            <SectionTitle>Mis lesiones</SectionTitle>
            <Link href="/registrar-lesion" className={`text-sm ${buttonPrimary}`}>
              Registra una lesión
            </Link>
          </div>
          {injuries && injuries.length > 0 ? (
            <>
              <PlayerCardList>
                {myInjuriesShown.map((i) => {
                  const open = i.status !== "cerrada" && i.status !== "en_evaluacion" && i.expected_return_on;
                  return (
                    <PlayerCard
                      key={i.id}
                      href={`/lesiones/${i.id}`}
                      name={i.type}
                      showAvatar={false}
                      secondary={
                        i.status === "cerrada" && i.closed_on
                          ? `Alta el ${formatDayMonth(i.closed_on)}`
                          : `Desde el ${formatDate(i.started_on)}`
                      }
                      progress={open ? recoveryProgress(i.started_on, i.expected_return_on as string).percent : undefined}
                      progressLabel="Avance hacia el alta"
                      badge={<InjuryStatusBadge status={i.status as InjuryStatus} />}
                    />
                  );
                })}
              </PlayerCardList>
              {injuries.length > 3 && (
                <Link
                  href="/lesiones"
                  className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-brand-text underline"
                >
                  Ver todas ({injuries.length})
                </Link>
              )}
            </>
          ) : (
            <Card>
              <p className="text-sm text-muted">No has registrado lesiones.</p>
            </Card>
          )}
        </section>
      )}

      {me && myLoad && (
        <>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-6">
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

      {isPlayer && (
        <Link
          href="/evaluaciones/mias"
          className="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 transition hover:bg-mist"
        >
          <Dumbbell aria-hidden="true" className="size-5 shrink-0 text-brand-strong" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-ink">Mis evaluaciones</span>
            <span className="block text-13 text-muted">Tus tests físicos, tu progreso y tu puesto en el plantel.</span>
          </span>
          <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted" />
        </Link>
      )}
    </>
  );

  const cover = club?.cover_path && (
    <ResumenCover
      club={{ ...club, cover_path: club.cover_path }}
      fullName={profile.full_name ?? ""}
      avatarPath={profile.avatar_path ?? null}
      clubs={clubOptions(supabase, profile)}
    />
  );

  // Resumen del staff (PR 3 del rediseño): en celular una columna en orden de lectura;
  // desde lg, título con el próximo partido, números a lo ancho y dos columnas (7fr / 5fr).
  if (staff) {
    return (
      <>
        {cover}
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:max-w-[1200px] lg:px-8">
          {formatCtx.canSevens && <FormatSwitch format={formatCtx.format} />}
          {askSevensPosition && <SevensPositionBanner />}
          <div className="flex flex-col gap-5 lg:gap-6">
            <header className="flex items-start justify-between gap-4">
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
              {nextMatch && <NextMatch match={nextMatch} canNomina={canNomina} className="hidden lg:inline-flex" />}
            </header>

            {/* Llega aparte: el resto del Resumen no la espera. key: al cambiar de formato
                muestra el esqueleto en vez de las cifras del otro formato. */}
            <Suspense key={formatCtx.format} fallback={<StatStripSkeleton />}>
              <StaffStatStrip
                data={metricsPromise}
                desktop={metricsDesktop}
                mobile={metricsMobile}
                toReview={canManage ? toReview.length : null}
              />
            </Suspense>

            <AttentionStrip
              cards={noticeCards}
              className=""
              action={
                <Link
                  href="/metricas"
                  className="-my-0.5 inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-brand-text underline"
                >
                  Ver métricas
                </Link>
              }
            />

            {nextMatch && <NextMatch match={nextMatch} canNomina={canNomina} stacked className="flex w-full lg:hidden" />}

            <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-6">
              <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
                {canManage && <ReviewSection items={reviewItems} className="order-2 lg:order-none" />}
                <ActiveInjuriesSection items={activeItems} className="order-3 lg:order-none" />
              </div>
              <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
                <MyWeek data={byRole.week} className="order-1 lg:order-none" />
                {(chartsDesktop || chartsMobile) && (
                  <div className={`order-6 min-w-0 flex-col gap-5 lg:order-none lg:gap-6 ${chartsClass}`}>
                    <Suspense
                      key={formatCtx.format}
                      fallback={<ChartsSkeleton desktop={metricsDesktop} mobile={metricsMobile} />}
                    >
                      <StaffMetricCharts data={metricsPromise} desktop={metricsDesktop} mobile={metricsMobile} />
                    </Suspense>
                  </div>
                )}
                <ZonesCard marks={zoneMarks} counts={zoneLegend} withoutZone={withoutZone} className="order-4 lg:order-none" />
                <SquadLink count={players.length} className="order-5 lg:order-none" />
              </div>
            </div>
          </div>

          {isPlayer && (
            <div className="mt-8 flex flex-col gap-5 lg:gap-6">
              {absenceGym}
              {pendingBanner}
              {playerSections}
            </div>
          )}
        </main>
      </>
    );
  }

  return (
    <>
    {/* Portada del club: solo en el Resumen, no en el layout. */}
    {cover}
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 lg:max-w-[1200px] lg:px-8 lg:py-10">
      {/* Selector de formato: solo aquí, y solo si la cuenta puede trabajar en Sevens. */}
      {formatCtx.canSevens && <FormatSwitch format={formatCtx.format} />}
      {askSevensPosition && <SevensPositionBanner />}
      <div className="flex flex-col gap-5 lg:gap-6">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="sr-only">Resumen</h1>
            {myStatus && <MyStatusCard status={myStatus} phase={myPhase} />}
          </div>
          {nextMatch && <NextMatch match={nextMatch} canNomina={canNomina} className="hidden lg:inline-flex" />}
        </header>

        {/* Franja "Requiere atención": chips por tipo (las tareas del jugador primero:
            sRPE, esfuerzo del gimnasio y check de bienestar). La lista completa está en
            la campana del encabezado. */}
        <AttentionStrip cards={noticeCards} />
        {pendingBanner}
        {absenceGym}
        <MyWeek data={byRole.week} />

        {(metricsDesktop.includes("asistencia") || metricsMobile.includes("asistencia")) && (
          <Suspense fallback={<Block className="min-h-56" />}>
            <PlayerMetrics data={playerMetricsPromise} desktop={metricsDesktop} mobile={metricsMobile} />
          </Suspense>
        )}

        {/* Celular: el próximo partido a lo ancho. */}
        {nextMatch && (
          <NextMatch match={nextMatch} canNomina={canNomina} stacked className="flex w-full lg:hidden" />
        )}

        {playerSections}
      </div>
    </main>
    </>
  );
}
