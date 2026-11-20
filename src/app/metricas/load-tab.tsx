// Pestaña Carga de /metricas: franja de 4 números, carga por semana y bienestar del
// plantel, "Carga por jugador" (sRPE de la semana
// con alertas), "Minutos jugados" y "Asistencia a entrenamientos". Las funciones validan
// en la base el permiso (carga_ver o staff, según la función); en Sevens, todo es del grupo.
import Link from "next/link";
import { ListChecks } from "lucide-react";
import type { getSupabase } from "@/lib/session";
import type { Format } from "@/lib/sevens";
import { getTeamLoad } from "@/lib/match-load";
import { causeText, getTeamReturnSummary, weeksText, type TeamReturnSummary } from "@/lib/return-break";
import { adherencePct, currentWeek, getGymAdherence, type GymAdherenceRow, type LoadBreakdownRow } from "@/lib/gym";
import { wellnessReason, type TeamSrpeRow, type WellnessFlag } from "@/lib/srpe";
import { attendanceBarClass, attendancePercent, getAttendanceRanking, type AttendanceRow } from "@/lib/attendance";
import { MetricsBlock, MetricsError, MetricsTable } from "@/app/metrics";
import { ListRow, StatStrip, Card, CardHeader, type StatTone } from "@/app/ui-blocks";
import { anchorId } from "@/lib/anchors";
import { InfoBox } from "@/app/info-box";
import { buttonSecondary } from "@/app/ui";
import { MinutesSection } from "./load-section";
import { PlayerLoadTable, type PlayerLoadItem } from "./player-load";
import { TeamWellnessBlock, WeeklyLoadBlock } from "./weekly-blocks";
import { getTeamLoadWeekly, getTeamWellness } from "@/lib/team-weekly";

type Client = Awaited<ReturnType<typeof getSupabase>>;

export async function LoadTab({ supabase, format }: { supabase: Client; format: Format }) {
  const week = currentWeek();
  const [load, team, flags, breakdown, adherence, returns, attendance, weekly, wellness] = await Promise.all([
    getTeamLoad(supabase, 4, format),
    supabase
      .rpc("team_srpe_load", { p_format: format })
      .then(({ data, error }) => (error ? null : ((data ?? []) as TeamSrpeRow[]))),
    supabase
      .rpc("wellness_flags", { p_format: format })
      .then(({ data, error }) => (error ? null : ((data ?? []) as WellnessFlag[]))),
    supabase
      .rpc("team_load_breakdown", { p_format: format })
      .then(({ data, error }) => (error ? null : ((data ?? []) as LoadBreakdownRow[]))),
    getGymAdherence(supabase, week.monday, week.sunday),
    getTeamReturnSummary(supabase, format),
    getAttendanceRanking(supabase, "mes"),
    getTeamLoadWeekly(supabase, format),
    getTeamWellness(supabase, format),
  ]);

  // Jugadores del formato (team_srpe_load ya viene filtrado): el gimnasio y la asistencia
  // no tienen formato, así que se recortan a esta lista.
  const roster = team ? new Set(team.map((p) => p.player_id)) : null;
  const gymRows = (adherence ?? []).filter((a) => !roster || roster.has(a.player_id));

  return (
    <div className="space-y-4">
      <LoadKpis team={team} flags={flags} gym={adherence ? gymRows : null} />
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <WeeklyLoadBlock weeks={weekly} />
        <TeamWellnessBlock data={wellness} />
      </div>
      <PlayerLoadBlock team={team} flags={flags} breakdown={breakdown} gym={gymRows} returns={returns} />
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <MinutesSection result={load} />
        <AttendanceBlock result={attendance} roster={roster} />
      </div>
    </div>
  );
}

// Franja de 4 números (2×2 en el celular). "Plan de gimnasio cumplido" solo con planes asignados.
function LoadKpis({
  team,
  flags,
  gym,
}: {
  team: TeamSrpeRow[] | null;
  flags: WellnessFlag[] | null;
  gym: GymAdherenceRow[] | null;
}) {
  if (!team) {
    return (
      <Card as="section">
        <MetricsError />
      </Card>
    );
  }
  const responded = team.filter((p) => p.current_sessions > 0).length;
  const high = team.filter((p) => p.high_load).length;
  const low = flags ? flags.filter((f) => f.low).length : null;
  const assigned = (gym ?? []).reduce((n, a) => n + a.assigned, 0);
  const pct = gym && assigned > 0 ? adherencePct(gym) : undefined;
  const alert: StatTone = "alerta";
  const items: { label: string; value: string; context?: string; tone?: StatTone }[] = [
    { label: "Respondieron", value: `${responded} / ${team.length}`, context: "esta semana" },
    { label: "Con carga alta", value: String(high), context: "esta semana", tone: high > 0 ? alert : undefined },
    { label: "Bienestar bajo lo habitual", value: low === null ? "—" : String(low), context: "últimos 7 días", tone: (low ?? 0) > 0 ? alert : undefined },
  ];
  if (pct !== undefined) {
    items.push({ label: "Plan de gimnasio cumplido", value: pct === null ? "—" : `${pct} %`, context: pct === null ? "aún no toca ninguna sesión" : "esta semana" });
  }
  return <StatStrip items={items} />;
}

// "tras lesión" → "lesión"; "tras una ausencia por salud" → "ausencia por salud".
const shortCause = (cause: string) => causeText(cause).replace(/^tras (una |un )?/, "");

function PlayerLoadBlock({
  team,
  flags,
  breakdown,
  gym,
  returns,
}: {
  team: TeamSrpeRow[] | null;
  flags: WellnessFlag[] | null;
  breakdown: LoadBreakdownRow[] | null;
  gym: GymAdherenceRow[];
  returns: TeamReturnSummary | null;
}) {
  const heading = "Carga por jugador";
  const subtitle = "Esta semana (lunes a domingo), por tipo de sesión";
  if (!team) {
    return (
      <MetricsBlock heading={heading} info="carga_jugador">
        <MetricsError />
      </MetricsBlock>
    );
  }
  const parts = new Map((breakdown ?? []).map((b) => [b.player_id, b]));
  const lowWellness = new Map((flags ?? []).filter((f) => f.low).map((f) => [f.player_id, f]));
  const back = new Map((returns?.individual ?? []).map((r) => [r.player_id, r]));
  const gymOf = new Map(gym.map((g) => [g.player_id, g]));
  const players: PlayerLoadItem[] = team.map((p) => {
    const b = parts.get(p.player_id);
    const w = lowWellness.get(p.player_id);
    const r = back.get(p.player_id);
    const g = gymOf.get(p.player_id);
    return {
      id: p.player_id,
      name: p.full_name,
      load: p.current_load,
      parts: b ? { cancha: b.cancha, gimnasio: b.gimnasio, partido: b.partido } : null,
      high: p.high_load,
      pctOver: p.pct_over,
      priorWeeks: p.prior_weeks,
      wellness: w ? { total: w.total, reason: wellnessReason(w) } : null,
      back: r ? { weeks: r.weeks, cause: shortCause(r.cause) } : null,
      gym: g ? { done: g.done, assigned: g.assigned } : null,
    };
  });
  const t = returns?.team;
  const header = (
    <div className="space-y-3">
      <div>
        <CardHeader title={heading} subtitle={subtitle} className="mb-0" />
        <InfoBox topic="carga_jugador" />
      </div>
      {t && (
        <div className="rounded-lg bg-paron-bg px-3 py-2.5 text-sm text-paron-ink">
          <p>
            <span className="font-semibold">El plantel vuelve tras {weeksText(t.weeks)} sin entrenar.</span> {t.count} de{" "}
            {t.roster} jugadores{t.squad_break ? " (parón del plantel)" : " vuelven juntos"}. Conviene retomar la carga de a poco.
          </p>
          <InfoBox topic="paron" label="¿Qué es volver tras un parón?" />
        </div>
      )}
      {!t && back.size > 0 && <InfoBox topic="paron" label="¿Qué es volver tras un parón?" />}
    </div>
  );
  return <PlayerLoadTable id={anchorId(heading)} header={header} players={players} />;
}

// "Asistencia a entrenamientos": último mes, los 5 con menor %, con los cortes de /asistencia.
function AttendanceBlock({
  result,
  roster,
}: {
  result: { ok: true; data: AttendanceRow[] } | { ok: false };
  roster: Set<string> | null;
}) {
  const heading = "Asistencia a entrenamientos";
  const link = (
    <Link href="/asistencia" className={`w-full text-sm sm:w-auto ${buttonSecondary}`}>
      Ver asistencia completa
    </Link>
  );
  if (!result.ok) {
    return (
      <MetricsBlock heading={heading} subtitle="Último mes" info="asistencia">
        <MetricsError />
      </MetricsBlock>
    );
  }
  const rows = result.data
    .filter((r) => r.total > 0 && (!roster || roster.has(r.player_id)))
    .sort((a, b) => attendancePercent(a) - attendancePercent(b) || b.total - a.total || a.full_name.localeCompare(b.full_name))
    .slice(0, 5);
  if (rows.length === 0) {
    return (
      <MetricsBlock heading={heading} subtitle="Último mes · los 5 con menos" info="asistencia">
        <p className="flex items-start gap-2 text-sm text-muted">
          <ListChecks aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Todavía no hay listas guardadas este mes. El staff pasa lista desde cada entrenamiento en el calendario.
        </p>
        <div className="mt-4">{link}</div>
      </MetricsBlock>
    );
  }
  return (
    <MetricsTable heading={heading} subtitle="Último mes · los 5 con menos" info="asistencia" footer={link}>
      {rows.map((r) => {
        const pct = attendancePercent(r);
        return (
          <ListRow key={r.player_id} className="min-h-15">
            <div className="min-w-0 flex-1">
              <Link
                href={`/jugadores/${r.player_id}`}
                className="block truncate text-15 font-semibold text-ink after:absolute after:inset-0 after:content-[''] hover:underline"
              >
                {r.full_name}
              </Link>
              <span role="img" aria-label={`${pct} % de asistencia`} className="mt-1.5 block h-2 overflow-hidden rounded-full bg-line">
                <span className={`block h-full rounded-full ${attendanceBarClass(pct)}`} style={{ width: `${pct}%` }} />
              </span>
            </div>
            <span className="shrink-0 text-sm font-semibold text-ink tabular-nums">
              {pct} %<span className="ml-1.5 text-13 font-normal text-muted">{r.attended}/{r.total}</span>
            </span>
          </ListRow>
        );
      })}
    </MetricsTable>
  );
}
