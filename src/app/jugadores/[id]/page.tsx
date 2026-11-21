import { redirect, notFound } from "next/navigation";
import { BackLink } from "@/app/back-link";
import { getActiveClubId, getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { isStaff, type Availability, type UserRole } from "@/lib/roles";
import { returnLabel, type InjuryStatus } from "@/lib/injuries";
import { getMyLoad, getTeamLoad, totalLabel, type LoadResult, type MyLoad, type TeamLoad } from "@/lib/match-load";
import { getActiveFormat } from "@/lib/format";
import { LoadBlock } from "@/app/load-block";
import { PlayerEvaluations } from "@/app/evaluaciones/player-evaluations";
import { Avatar } from "@/app/avatar";
import { getAvatarUrls } from "@/lib/avatars";
import { ReturnNotice, SrpeLoad, WellnessHistory } from "@/app/srpe-load";
import { getPlayerReturnFlag, weeksText } from "@/lib/return-break";
import { can } from "@/lib/permissions";
import { canReadEvaluations } from "@/lib/evaluations";
import { WELLNESS_COLUMNS, WELLNESS_MAX, formatLoad, getPlayerWeeklyLoad, type WeeklyLoad, type WellnessReport } from "@/lib/srpe";
import { getPlayerGymSummary } from "@/lib/gym";
import { AvailabilityBadge, StatusBadge } from "@/app/ui";
import { StatStrip } from "@/app/ui-blocks";
import { PositionSection } from "./position-section";
import { GymSummary } from "./gym-summary";
import { PlayerActions } from "./player-actions";
import { PlayerTabs, playerTabHref, type PlayerTab } from "./player-tabs";
import {
  GymCompact,
  InjuryCompact,
  InjuryFull,
  InjuryTimeline,
  LoadMini,
  OPEN_STATUSES,
  WellnessLatest,
  isWellnessLow,
  todayInChile,
  type InjuryRow,
  type PhaseRow,
} from "./blocks";

// Ficha del jugador para el staff: lesión abierta, avance, línea de tiempo y carga
// de partidos. El jugador puede ver solo su propia ficha (su carga, sin semáforo).
// En pestañas (?tab=, renderizadas en el servidor): Resumen, Lesiones, Carga, Gimnasio y
// Evaluaciones; cada una con las mismas condiciones de acceso de siempre.
export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
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
  const injuriesPromise: PromiseLike<InjuryRow[]> = supabase
    .from("injuries")
    .select(
      "id, type, status, severity, started_on, expected_return_on, closed_on, occurred_during, reviewed_at",
    )
    .eq("player_id", id)
    .order("started_on", { ascending: false })
    .then(({ data }) => (data ?? []) as InjuryRow[]);

  const formatPromise = getActiveFormat(user.id);
  // Pestañas que ve cada persona: el staff, todas las de siempre; el propio jugador, las suyas.
  const tabsPromise = Promise.all([profilePromise, staffPromise, playerPromise]).then(([m, isStaffUser, p]) => {
    const roles = (m?.roles ?? []) as UserRole[];
    const own = p?.user_id === user.id;
    const list: { id: PlayerTab; label: string }[] = [{ id: "resumen", label: "Resumen" }];
    if (isStaffUser || own) list.push({ id: "lesiones", label: "Lesiones" });
    if (isStaffUser || own) list.push({ id: "carga", label: own ? "Mi carga" : "Carga y bienestar" });
    if (isStaffUser) list.push({ id: "gimnasio", label: "Gimnasio" });
    if (own || canReadEvaluations(roles)) list.push({ id: "evaluaciones", label: "Evaluaciones" });
    return list;
  });
  const activePromise = tabsPromise.then((list) => list.find((t) => t.id === query.tab)?.id ?? "resumen");
  const onTab = <T,>(tabs: PlayerTab[], run: () => PromiseLike<T> | T): Promise<T | null> =>
    activePromise.then((a) => (tabs.includes(a) ? run() : null));

  const [me, staff, player, all, loadResult, phases, avatarUrl, phone, weekly, wellness, gym, returnFlag, tabs, active] =
    await Promise.all([
      profilePromise,
      staffPromise,
      playerPromise,
      injuriesPromise,
      // Carga de los últimos 6 partidos (Resumen y Carga): el staff la toma de la carga del
      // plantel; el jugador, de su propia función (sin datos de otros). Del formato activo.
      Promise.all([staffPromise, formatPromise]).then(([isStaffUser, format]) =>
        onTab(["resumen", "carga"], (): Promise<LoadResult<TeamLoad> | LoadResult<MyLoad>> =>
          isStaffUser ? getTeamLoad(supabase, 6, format) : getMyLoad(supabase, format),
        ),
      ),
      // Fases de las lesiones abiertas (Resumen y Lesiones).
      onTab(["resumen", "lesiones"], () =>
        injuriesPromise.then(async (injuries) => {
          const openIds = injuries.filter((i) => OPEN_STATUSES.includes(i.status as InjuryStatus)).map((i) => i.id);
          if (openIds.length === 0) return [] as PhaseRow[];
          const { data } = await supabase
            .from("injury_phases")
            .select("id, injury_id, name, status, started_on, ended_on")
            .in("injury_id", openIds)
            .is("archived_at", null)
            .order("position");
          return (data ?? []) as PhaseRow[];
        }),
      ),
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
      // Carga semanal sRPE (staff), del formato activo. Va siempre: las alertas del encabezado.
      Promise.all([staffPromise, formatPromise]).then(
        ([isStaffUser, format]): Promise<WeeklyLoad | null> | null =>
          isStaffUser ? getPlayerWeeklyLoad(supabase, id, format) : null,
      ),
      // Últimos checks de bienestar (staff; RLS: el staff confirmado ve los del club). Siempre.
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
      // Plan de gimnasio: asignado, cumplimiento y últimas sesiones (staff; Resumen y Gimnasio).
      staffPromise.then((isStaffUser) =>
        isStaffUser ? onTab(["resumen", "gimnasio"], () => getPlayerGymSummary(supabase, id)) : null,
      ),
      // Vuelta tras parón (staff; solo informativa), del formato activo. Siempre: encabezado.
      Promise.all([staffPromise, formatPromise]).then(([isStaffUser, format]) =>
        isStaffUser ? getPlayerReturnFlag(supabase, id, format) : null,
      ),
      tabsPromise,
      activePromise,
    ]);

  if (me?.status === "pendiente") redirect("/pendiente");
  if (me?.status !== "confirmado") redirect("/dashboard");
  // El jugador no ve lesiones de otros: fuera de su propia ficha, es solo para el staff.
  if (!staff && player?.user_id !== user.id) redirect("/dashboard");
  if (!player) notFound();
  // "Mi carga" es una pantalla propia (/mi-carga, en "Más"): la pestaña del propio jugador va allí.
  if (player.user_id === user.id && active === "carga") redirect("/mi-carga");

  const load = loadResult?.ok ? loadResult.data : null;
  const playerLoad = loadResult?.ok
    ? "players" in loadResult.data
      ? (loadResult.data.players.find((p) => p.player_id === id) ?? null)
      : loadResult.data.player
    : null;

  const open = all.filter((i) => OPEN_STATUSES.includes(i.status as InjuryStatus));
  // Teléfono solo en la ficha de otro jugador (el propio no muestra el botón).
  const contactPhone = staff && player.user_id !== user.id ? phone : null;
  const canChangePosition = can((me.roles ?? []) as UserRole[], "posicion_cambiar");

  const availability = player.availability as Availability;
  const latestReturn = open
    .map((i) => i.expected_return_on)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);
  // Una lesión activa que nadie ha revisado todavía no tiene un regreso confiable.
  const pendingReview = open.some((i) => i.status === "activa" && i.reviewed_at === null);
  const lowWellness = isWellnessLow(wellness, todayInChile());
  const href = (t: PlayerTab) => playerTabHref(id, t);

  // Números del Resumen: solo los que hay.
  const lastWellness = wellness?.[0];
  const stats = [
    ...(weekly
      ? [
          {
            label: "Carga de la semana",
            value: formatLoad(weekly.current_load),
            context:
              weekly.prior_weeks >= 3 && weekly.baseline !== null && weekly.baseline > 0
                ? `Promedio: ${formatLoad(weekly.baseline)}`
                : "Sin promedio aún",
            tone: weekly.high_load ? ("alerta" as const) : ("default" as const),
          },
        ]
      : []),
    ...(lastWellness
      ? [
          {
            label: "Último bienestar",
            value: `${lastWellness.total}/${WELLNESS_MAX}`,
            tone: lowWellness ? ("alerta" as const) : ("default" as const),
          },
        ]
      : []),
    ...(load && playerLoad && load.matches_count > 0
      ? [
          {
            label: load.mode === "jugo" ? "Partidos jugados" : "Minutos jugados",
            value: totalLabel(load.mode, playerLoad.total, load.matches_count),
            context: `Últimos ${load.matches_count} ${load.matches_count === 1 ? "partido" : "partidos"}`,
          },
        ]
      : []),
  ];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 lg:max-w-[1200px] lg:px-8 lg:py-10">
      <header className="mb-5">
        <BackLink fallback="/plantel">← Volver</BackLink>
        <div className="mt-3 flex items-start gap-3 lg:gap-4">
          <Avatar name={player.full_name} url={avatarUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl leading-8 font-bold text-ink lg:text-[30px] lg:leading-[34px]">
              {player.full_name}
            </h1>
            <p className="mt-0.5 text-sm text-muted">
              {player.position && `${player.position} · `}
              {pendingReview ? "Lesión por revisar" : returnLabel(latestReturn ?? null)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <AvailabilityBadge status={availability} />
              {lowWellness && <StatusBadge className="bg-alerta-bg text-alerta-fg">Bienestar bajo</StatusBadge>}
              {weekly?.high_load && <StatusBadge className="bg-alerta-bg text-alerta-fg">Carga alta</StatusBadge>}
              {returnFlag && (
                <StatusBadge className="bg-brand-soft text-brand-text">Vuelve tras {weeksText(returnFlag.weeks)}</StatusBadge>
              )}
            </div>
          </div>
          <PlayerActions
            name={player.full_name}
            phone={contactPhone}
            positionForm={
              canChangePosition ? (
                <PositionSection
                  supabase={supabase}
                  playerId={player.id}
                  clubId={player.club_id}
                  userId={player.user_id}
                  sport={me.club?.sport ?? ""}
                  hasSevens={me.club?.sport === "rugby" && !!me.club?.has_sevens}
                />
              ) : null
            }
          />
        </div>
      </header>

      <PlayerTabs playerId={id} tabs={tabs} active={active} />

      {active === "resumen" && (
        <div className="space-y-4">
          {stats.length > 0 && <StatStrip items={stats} />}
          {returnFlag && <ReturnNotice flag={returnFlag} />}
          <div className="space-y-4 lg:grid lg:grid-cols-3 lg:items-start lg:gap-4 lg:space-y-0">
            {staff && <WellnessLatest reports={wellness} moreHref={href("carga")} />}
            {staff && <LoadMini data={weekly} moreHref={href("carga")} />}
            <div className="space-y-4">
              <InjuryCompact open={open} phases={phases ?? []} availability={availability} moreHref={href("lesiones")} />
              {staff && <GymCompact data={gym} moreHref={href("gimnasio")} />}
            </div>
          </div>
        </div>
      )}

      {active === "lesiones" && (
        <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
          <InjuryFull open={open} phases={phases ?? []} availability={availability} />
          <InjuryTimeline all={all} />
        </div>
      )}

      {active === "carga" && (
        <div className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8 lg:space-y-0">
          {staff && <SrpeLoad data={weekly} returnFlag={returnFlag} />}
          <div className="space-y-6">
            {staff && (
              <section>
                <h2 className="mb-3 font-sans text-lg font-bold text-ink">Bienestar</h2>
                <WellnessHistory reports={wellness} />
              </section>
            )}
            <LoadBlock
              title={staff ? "Minutos en partidos" : "Mi carga"}
              load={load}
              player={playerLoad}
              error={!loadResult?.ok}
              lastInjury={staff ? (all[0] ? { type: all[0].type, startedOn: all[0].started_on } : null) : undefined}
            />
          </div>
        </div>
      )}

      {active === "gimnasio" && staff && <GymSummary data={gym} />}

      {active === "evaluaciones" && <PlayerEvaluations playerId={id} clubId={player.club_id} inTab />}
    </main>
  );
}
