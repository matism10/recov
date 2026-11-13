import Link from "next/link";
import { BackLink } from "@/app/back-link";
import { notFound, redirect } from "next/navigation";
import { getActiveClubId, getProfile, getSessionUser, getSupabase } from "@/lib/session";
import {
  isStaff,
  type Availability,
  type UserRole,
} from "@/lib/roles";
import {
  INJURY_STATUS_LABEL,
  OCCURRED_DURING_LABEL,
  PHASE_STATUS_LABEL,
  SEVERITY_LABEL,
  formatDate,
  returnLabel,
  type InjurySeverity,
  type InjuryStatus,
  type OccurredDuring,
  type PhaseStatus,
} from "@/lib/injuries";
import { InjuryProgress } from "@/app/lesiones/injury-progress";
import { getMyLoad, getTeamLoad, type LoadResult, type MyLoad, type TeamLoad } from "@/lib/match-load";
import { getActiveFormat } from "@/lib/format";
import { LoadBlock } from "@/app/load-block";
import { PlayerEvaluations } from "@/app/evaluaciones/player-evaluations";
import { Avatar } from "@/app/avatar";
import { getAvatarUrls } from "@/lib/avatars";
import { WhatsAppButton } from "@/app/whatsapp-button";
import { SrpeLoad, WellnessHistory } from "@/app/srpe-load";
import { can } from "@/lib/permissions";
import { PositionSection } from "./position-section";
import { WELLNESS_COLUMNS, getPlayerWeeklyLoad, type WeeklyLoad, type WellnessReport } from "@/lib/srpe";
import { getPlayerGymSummary } from "@/lib/gym";
import { GymSummary } from "./gym-summary";
import {
  AvailabilityBadge,
  InjuryStatusBadge,
  PageTitle,
  PhaseDot,
  SectionTitle,
  cardClass,
  } from "@/app/ui";

const OPEN_STATUSES: InjuryStatus[] = ["en_evaluacion", "activa"];

// Ficha del jugador para el staff: lesión abierta, avance, línea de tiempo y carga
// de partidos. El jugador puede ver solo su propia ficha (su carga, sin semáforo).
export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabase();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Todo lo que no depende de otra consulta va en paralelo; las fases esperan a las
  // lesiones y la foto al jugador. Nada se muestra antes de los controles de acceso
  // de abajo, y RLS protege cada consulta.
  const profilePromise = getProfile(user.id);
  const staffPromise = profilePromise.then(
    (me) => me?.status === "confirmado" && isStaff((me.roles ?? []) as UserRole[]),
  );
  // RLS: solo jugadores de los planteles de la cuenta; aquí, solo del plantel activo.
  const playerPromise = getActiveClubId(user.id).then((clubId) =>
    supabase
      .from("players")
      .select("id, club_id, full_name, position, availability, user_id")
      .eq("id", id)
      .eq("club_id", clubId)
      .eq("status", "confirmado")
      .maybeSingle()
      .then(({ data }) => data),
  );
  // RLS: el staff ve las lesiones del club.
  const injuriesPromise = supabase
    .from("injuries")
    .select(
      "id, type, status, severity, started_on, expected_return_on, closed_on, occurred_during, reviewed_at",
    )
    .eq("player_id", id)
    .order("started_on", { ascending: false })
    .then(({ data }) => data ?? []);

  const formatPromise = getActiveFormat(user.id);
  const [me, staff, player, all, loadResult, phases, avatarUrl, phone, weekly, wellness, gym] = await Promise.all([
    profilePromise,
    staffPromise,
    playerPromise,
    injuriesPromise,
    // Carga de los últimos 6 partidos: el staff la toma de la carga del plantel;
    // el jugador, de su propia función (sin datos de otros).
    // Del formato activo (Rugby 15 o Sevens).
    Promise.all([staffPromise, formatPromise]).then(
      ([isStaffUser, format]): Promise<LoadResult<TeamLoad> | LoadResult<MyLoad>> =>
        isStaffUser ? getTeamLoad(supabase, 6, format) : getMyLoad(supabase, format),
    ),
    // Fases de las lesiones abiertas.
    injuriesPromise.then(async (injuries) => {
      const openIds = injuries
        .filter((i) => OPEN_STATUSES.includes(i.status as InjuryStatus))
        .map((i) => i.id);
      if (openIds.length === 0) return [];
      const { data } = await supabase
        .from("injury_phases")
        .select("id, injury_id, name, status, started_on, ended_on")
        .in("injury_id", openIds)
        .is("archived_at", null)
        .order("position");
      return data ?? [];
    }),
    // Foto del jugador.
    playerPromise.then(async (p) =>
      p ? (await getAvatarUrls(supabase, [p.user_id])).get(p.user_id) : undefined,
    ),
    // Teléfono para contactarlo: solo el staff. get_player_phone devuelve null a quien
    // no corresponde (0030); abajo se descarta si es la propia ficha.
    staffPromise.then((isStaffUser) =>
      isStaffUser
        ? supabase.rpc("get_player_phone", { p_player_id: id }).then(({ data }) => data as string | null)
        : null,
    ),
    // Carga semanal sRPE (staff), del formato activo.
    Promise.all([staffPromise, formatPromise]).then(
      ([isStaffUser, format]): Promise<WeeklyLoad | null> | null =>
        isStaffUser ? getPlayerWeeklyLoad(supabase, id, format) : null,
    ),
    // Últimos checks de bienestar (staff; RLS: el staff confirmado ve los del club).
    staffPromise.then((isStaffUser) =>
      isStaffUser
        ? supabase
            .from("wellness_reports")
            .select(WELLNESS_COLUMNS)
            .eq("player_id", id)
            .order("report_date", { ascending: false })
            .limit(6)
            .then(({ data, error }) => (error ? null : ((data ?? []) as WellnessReport[])))
        : null,
    ),
    // Plan de gimnasio: asignado, cumplimiento y últimas sesiones (staff).
    staffPromise.then((isStaffUser) => (isStaffUser ? getPlayerGymSummary(supabase, id) : null)),
  ]);

  if (me?.status === "pendiente") redirect("/pendiente");
  if (me?.status !== "confirmado") redirect("/dashboard");
  // El jugador no ve lesiones de otros: fuera de su propia ficha, es solo para el staff.
  if (!staff && player?.user_id !== user.id) redirect("/dashboard");
  if (!player) notFound();

  const load = loadResult.ok ? loadResult.data : null;
  const playerLoad = loadResult.ok
    ? "players" in loadResult.data
      ? (loadResult.data.players.find((p) => p.player_id === id) ?? null)
      : loadResult.data.player
    : null;

  const open = all.filter((i) => OPEN_STATUSES.includes(i.status as InjuryStatus));
  // Teléfono solo en la ficha de otro jugador (el propio no muestra el botón).
  const contactPhone = staff && player.user_id !== user.id ? phone : null;

  const availability = player.availability as Availability;
  const latestReturn = open
    .map((i) => i.expected_return_on as string | null)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);
  // Una lesión activa que nadie ha revisado todavía no tiene un regreso confiable.
  const pendingReview = open.some((i) => i.status === "activa" && i.reviewed_at === null);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:max-w-6xl lg:px-8">
      <header className="mb-6">
        <BackLink fallback="/plantel">← Volver</BackLink>
        <div className="mt-3 flex items-center gap-4">
          <Avatar name={player.full_name} url={avatarUrl} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <PageTitle>{player.full_name}</PageTitle>
              <AvailabilityBadge status={availability} />
            </div>
            <p className="mt-1 text-sm text-muted">
              {player.position && `${player.position} · `}
              {pendingReview ? "Lesión por revisar" : returnLabel(latestReturn ?? null)}
            </p>
            {contactPhone && (
              <div className="mt-3">
                <WhatsAppButton phone={contactPhone} name={player.full_name} />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Cambiar posición: head coach o quien tenga el permiso posicion_cambiar. */}
      {me?.status === "confirmado" && can((me.roles ?? []) as UserRole[], "posicion_cambiar") && (
        <PositionSection
          supabase={supabase}
          playerId={player.id}
          clubId={player.club_id}
          userId={player.user_id}
          sport={me.club?.sport ?? ""}
          hasSevens={me.club?.sport === "rugby" && !!me.club?.has_sevens}
        />
      )}

      {/* En escritorio: lesión actual a la izquierda y línea de tiempo a la derecha. */}
      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8 lg:space-y-0">
        <section>
          <SectionTitle className="mb-3">Lesión actual</SectionTitle>
          {open.length > 0 ? (
            <div className="space-y-3">
              {open.map((i) => {
                const status = i.status as InjuryStatus;
                const severity = i.severity as InjurySeverity | null;
                const occurredDuring = i.occurred_during as OccurredDuring | null;
                const injuryPhases = (phases ?? []).filter((ph) => ph.injury_id === i.id);
                return (
                  <article
                    key={i.id}
                    className={`space-y-4 p-5 ${cardClass}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink">{i.type}</p>
                        <p className="text-sm text-muted">
                          Desde el {formatDate(i.started_on)}
                          {occurredDuring &&
                            (occurredDuring === "externo"
                              ? " · fuera del club"
                              : ` · en ${OCCURRED_DURING_LABEL[occurredDuring].toLowerCase()}`)}
                          {severity && ` · ${SEVERITY_LABEL[severity]}`}
                        </p>
                      </div>
                      <InjuryStatusBadge status={status} />
                    </div>

                    {status === "en_evaluacion" ? (
                      <p className="text-sm text-muted">
                        Esperando el diagnóstico del jugador.
                      </p>
                    ) : (
                      <InjuryProgress
                        startedOn={i.started_on}
                        expectedReturnOn={i.expected_return_on}
                      />
                    )}

                    {injuryPhases.length > 0 && (
                      <ol className="space-y-3 border-l-2 border-line pl-5">
                        {injuryPhases.map((ph) => (
                          <li key={ph.id} className="relative text-sm">
                            <PhaseDot status={ph.status as PhaseStatus} />
                            <span className="font-medium text-ink">{ph.name}</span>
                            <span className="text-muted">
                              {" · "}
                              {PHASE_STATUS_LABEL[ph.status as PhaseStatus]}
                              {ph.started_on && ` · desde ${formatDate(ph.started_on)}`}
                              {ph.ended_on && ` · hasta ${formatDate(ph.ended_on)}`}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}

                    <Link
                      href={`/lesiones/${i.id}`}
                      className="inline-flex min-h-11 items-center text-sm font-medium text-brand-text underline"
                    >
                      Ver detalle de la lesión
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className={`p-5 text-sm text-muted ${cardClass}`}>
              {availability === "disponible"
                ? "No tiene lesiones actuales."
                : "Sin lesión registrada: la disponibilidad se cambió a mano."}
            </p>
          )}
        </section>

        <section>
          <SectionTitle className="mb-3">Línea de tiempo</SectionTitle>
          {all.length > 0 ? (
            <ol className="space-y-4 border-l-2 border-line pl-5">
              {all.map((i) => {
                const status = i.status as InjuryStatus;
                return (
                  <li key={i.id} className="relative">
                    <PhaseDot
                      status={
                        OPEN_STATUSES.includes(status)
                          ? "en_curso"
                          : status === "cerrada"
                            ? "completada"
                            : "pendiente"
                      }
                    />
                    <Link href={`/lesiones/${i.id}`} className="group block">
                      <p className="font-medium text-ink group-hover:underline">
                        {i.type}
                      </p>
                      <p className="text-sm text-muted">
                        {formatDate(i.started_on)}
                        {i.closed_on && ` – ${formatDate(i.closed_on)}`}
                        {" · "}
                        {INJURY_STATUS_LABEL[status]}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className={`p-5 text-sm text-muted ${cardClass}`}>
              Sin lesiones registradas.
            </p>
          )}
        </section>
      </div>

      {/* Staff: carga semanal sRPE (con el gimnasio), bienestar y gimnasio; en escritorio, de a dos. */}
      {staff && (
        <div className="mt-8 space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8 lg:space-y-0">
          <section>
            <SectionTitle className="mb-3">Carga</SectionTitle>
            <SrpeLoad data={weekly} />
          </section>
          <section>
            <SectionTitle className="mb-3">Bienestar</SectionTitle>
            <WellnessHistory reports={wellness} />
          </section>
          <section>
            <SectionTitle className="mb-3">Gimnasio</SectionTitle>
            <GymSummary data={gym} />
          </section>
        </div>
      )}

      <div className="mt-8">
        <LoadBlock
          title={staff ? "Minutos en partidos" : "Mi carga"}
          load={load}
          player={playerLoad}
          error={!loadResult.ok}
          lastInjury={
            staff ? (all[0] ? { type: all[0].type, startedOn: all[0].started_on } : null) : undefined
          }
        />
      </div>
      <PlayerEvaluations playerId={id} clubId={player.club_id} />
    </main>
  );
}
