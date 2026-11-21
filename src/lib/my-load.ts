// "Mi carga" del jugador (pestaña Carga de su ficha, /mi-carga): junta lo que ya existe
// (player_weekly_load, my_pending_reports, player_return_flag, my_gym_week, eventos y
// bienestar propios) sin funciones nuevas. Aquí van la carga de datos y las reglas de
// presentación; la base sigue calculando minutos, cargas y avisos.
import type { createClient } from "@/lib/supabase/server";
import type { Format } from "@/lib/sevens";
import { addDays, todayInChile } from "@/lib/injuries";
import { chileDateTime, chileToIso, eventTitle, weekStart, type EventType } from "@/lib/events";
import { getMyGymWeek } from "@/lib/gym";
import { getPlayerReturnFlag, type PlayerReturnFlag } from "@/lib/return-break";
import {
  WELLNESS_COLUMNS,
  getMyPendingReports,
  getPlayerWeeklyLoad,
  type PendingReport,
  type WeeklyLoad,
  type WellnessReport,
} from "@/lib/srpe";

type Client = Awaited<ReturnType<typeof createClient>>;

export type SessionKind = "cancha" | "gimnasio" | "partido";

// Estado de una fila de "Sesiones de la semana".
//   done: con esfuerzo y carga · pending: por responder · absent: "No fui" · upcoming: hoy o
//   más adelante · missed: ya pasó sin respuesta (fuera de plazo) · gymDone: gimnasio hecho
//   sin esfuerzo (no suma).
export type SessionState = "done" | "pending" | "absent" | "upcoming" | "missed" | "gymDone";

export type MySessionRow = {
  key: string;
  date: string;
  startsAt: string | null;
  kind: SessionKind;
  title: string;
  state: SessionState;
  minutes: number | null;
  estimated: boolean;
  rpe: number | null;
  load: number | null;
  // "Hoy", "Mañana" o "Próximo" (solo upcoming).
  when: string | null;
  // Responder: /reportar/[eventId] o /mi-plan/esfuerzo/[logId].
  href: string | null;
  // Plazo para responder (instante ISO), solo pending.
  deadline: string | null;
};

export type MyPendingRow = {
  key: string;
  kind: SessionKind;
  title: string;
  detail: string;
  href: string;
  deadline: string;
};

export type MyLoadScreen = {
  weekly: WeeklyLoad | null;
  returnFlag: PlayerReturnFlag | null;
  today: string;
  monday: string;
  sunday: string;
  pending: MyPendingRow[];
  sessions: MySessionRow[];
  // "Mi físico": hechas y asignadas esta semana (solo si hay plan).
  gym: { done: number; total: number } | null;
  wellness: WellnessReport[] | null;
  wellnessDays: number[];
};

const HOUR = 3_600_000;

// Plazo para responder: un entrenamiento o partido, 48 h después del término; el gimnasio,
// hasta el fin del segundo día después de la sesión (hora de Chile).
const sessionDeadline = (endsAt: string) => new Date(new Date(endsAt).getTime() + 48 * HOUR).toISOString();
const gymDeadline = (date: string) => chileToIso(addDays(date, 3), "00:00")!;

// "Vence en 5 h" (menos de 48 h) o "Vence en 3 días".
export function deadlineText(deadline: string, now: number = Date.now()) {
  const hours = Math.max(1, Math.ceil((new Date(deadline).getTime() - now) / HOUR));
  return hours < 48 ? `Vence en ${hours} h` : `Vence en ${Math.floor(hours / 24)} días`;
}

// Regla de "Carga alta" y del promedio, igual que srpe_load_flag: con menos de 3 semanas
// previas con datos no hay comparación.
export function comparableBaseline(w: Pick<WeeklyLoad, "prior_weeks" | "baseline">) {
  return w.prior_weeks >= 3 && w.baseline !== null && w.baseline > 0 ? w.baseline : null;
}

export async function getMyLoadScreen(
  supabase: Client,
  who: { playerId: string; clubId: string },
  format: Format,
): Promise<MyLoadScreen> {
  const today = todayInChile();
  const monday = weekStart(today);
  const sunday = addDays(monday, 6);
  const from = chileToIso(monday, "00:00")!;
  const to = chileToIso(addDays(sunday, 1), "00:00")!;

  const [weekly, returnFlag, pendingAll, gymWeek, events, wellness, club] = await Promise.all([
    getPlayerWeeklyLoad(supabase, who.playerId, format),
    getPlayerReturnFlag(supabase, who.playerId, format),
    getMyPendingReports(supabase, format),
    getMyGymWeek(supabase, monday),
    supabase
      .from("events")
      .select("id, type, starts_at, ends_at, opponent")
      .eq("club_id", who.clubId)
      .eq("format", format)
      .is("cancelled_at", null)
      .gte("starts_at", from)
      .lt("starts_at", to)
      .order("starts_at")
      .then(({ data }) => data ?? []),
    // RLS: solo los checks propios.
    supabase
      .from("wellness_reports")
      .select(WELLNESS_COLUMNS)
      .eq("player_id", who.playerId)
      .order("report_date", { ascending: false })
      .limit(6)
      .then(({ data, error }) => (error ? null : ((data ?? []) as WellnessReport[]))),
    supabase.from("clubs").select("wellness_days").eq("id", who.clubId).maybeSingle().then(({ data }) => data),
  ]);

  // "No fui" de los eventos de la semana (RLS: solo las propias respuestas).
  const eventIds = events.map((e) => e.id as string);
  const absentIds = new Set<string>(
    eventIds.length === 0
      ? []
      : await supabase
          .from("session_rpe")
          .select("event_id")
          .eq("player_id", who.playerId)
          .eq("absent", true)
          .in("event_id", eventIds)
          .then(({ data }) => (data ?? []).map((r) => r.event_id as string)),
  );

  const now = Date.now();
  const tomorrow = addDays(today, 1);
  const upcomingWhen = (date: string) => (date === today ? "Hoy" : date === tomorrow ? "Mañana" : "Próximo");

  const eventById = new Map(events.map((e) => [e.id as string, e]));
  const pendingSessions = new Map(
    pendingAll.filter((p): p is Extract<PendingReport, { kind: "session" }> => p.kind === "session").map((p) => [p.event_id, p]),
  );
  const pendingGym = new Map(
    pendingAll.filter((p): p is Extract<PendingReport, { kind: "gym" }> => p.kind === "gym").map((p) => [p.log_id, p]),
  );

  const rows: MySessionRow[] = [];
  const seen = new Set<string>();

  // 1. Con esfuerzo respondido: vienen de player_weekly_load (incluye gimnasio).
  for (const s of weekly?.current_sessions ?? []) {
    seen.add(s.event_id);
    const ev = eventById.get(s.event_id);
    rows.push({
      key: s.event_id,
      date: chileDateTime(s.starts_at).date,
      startsAt: s.starts_at,
      kind: s.kind,
      title:
        s.type === "gimnasio"
          ? `Gimnasio · ${s.label}`
          : ev
            ? s.kind === "partido" && ev.opponent
              ? `Partido ${eventTitle({ type: ev.type as EventType, opponent: ev.opponent as string })}`
              : s.kind === "partido"
                ? "Partido"
                : "Entrenamiento"
            : s.kind === "partido"
              ? "Partido"
              : "Entrenamiento",
      state: "done",
      minutes: s.minutes,
      estimated: s.estimated,
      rpe: s.rpe,
      load: s.load,
      when: null,
      href: null,
      deadline: null,
    });
  }

  // 2. Eventos de la semana que aún no tienen esfuerzo.
  for (const e of events) {
    const id = e.id as string;
    if (seen.has(id)) continue;
    const startsAt = e.starts_at as string;
    const date = chileDateTime(startsAt).date;
    const match = e.type === "competencia";
    const base = {
      key: id,
      date,
      startsAt,
      kind: (match ? "partido" : "cancha") as SessionKind,
      title: match ? `Partido${e.opponent ? ` vs. ${e.opponent}` : ""}` : "Entrenamiento",
      rpe: null,
      load: null,
      when: null,
      href: null,
      deadline: null,
    };
    const pending = pendingSessions.get(id);
    const minutes = Math.round((new Date(e.ends_at as string).getTime() - new Date(startsAt).getTime()) / 60_000);
    if (pending) {
      rows.push({
        ...base,
        state: "pending",
        minutes: pending.minutes,
        estimated: pending.estimated,
        href: `/reportar/${id}`,
        deadline: sessionDeadline(pending.ends_at),
      });
    } else if (absentIds.has(id)) {
      rows.push({ ...base, state: "absent", minutes: null, estimated: false });
    } else if (new Date(startsAt).getTime() > now || date >= today) {
      // Hoy o después y sin responder: todavía no toca (o recién empieza).
      rows.push({ ...base, state: "upcoming", minutes, estimated: false, when: upcomingWhen(date) });
    } else if (!match) {
      rows.push({ ...base, state: "missed", minutes: null, estimated: false });
    }
    // Un partido pasado sin respuesta ni pendiente: no estuvo convocado; no se muestra.
  }

  // 3. Gimnasio del plan.
  let gymDone = 0;
  for (const g of gymWeek) {
    if (g.done) gymDone += 1;
    if (g.log_id && seen.has(g.log_id)) continue;
    const pending = g.log_id ? pendingGym.get(g.log_id) : undefined;
    const base = {
      key: g.log_id ?? g.plan_session_id + g.date,
      date: g.date,
      startsAt: null,
      kind: "gimnasio" as SessionKind,
      title: `Gimnasio · ${g.label}`,
      rpe: null,
      load: null,
      when: null,
      href: null,
      deadline: null,
    };
    if (pending && g.log_id) {
      seen.add(g.log_id);
      rows.push({
        ...base,
        state: "pending",
        minutes: pending.minutes,
        estimated: false,
        href: `/mi-plan/esfuerzo/${g.log_id}`,
        deadline: gymDeadline(g.date),
      });
    } else if (g.done) {
      rows.push({ ...base, state: "gymDone", minutes: null, estimated: false });
    } else if (g.date >= today) {
      rows.push({ ...base, state: "upcoming", minutes: g.est_minutes, estimated: true, when: upcomingWhen(g.date) });
    } else {
      rows.push({ ...base, state: "missed", minutes: null, estimated: false });
    }
  }

  // 4. Gimnasio por su cuenta pendiente de esfuerzo (no está en el plan).
  for (const p of pendingAll) {
    if (p.kind !== "gym" || seen.has(p.log_id)) continue;
    seen.add(p.log_id);
    rows.push({
      key: p.log_id,
      date: p.report_date,
      startsAt: null,
      kind: "gimnasio",
      title: p.label ? `Gimnasio · ${p.label}` : "Gimnasio por mi cuenta",
      state: "pending",
      minutes: p.minutes,
      estimated: false,
      rpe: null,
      load: null,
      when: null,
      href: `/mi-plan/esfuerzo/${p.log_id}`,
      deadline: gymDeadline(p.report_date),
    });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date) || (a.startsAt ?? "").localeCompare(b.startsAt ?? ""));

  // Por responder (solo la semana en curso no alcanza: puede haber de ayer o antes).
  const pending: MyPendingRow[] = pendingAll.flatMap((p): MyPendingRow[] => {
    if (p.kind === "session") {
      const when = chileDateTime(p.starts_at);
      const match = p.event_type === "competencia";
      return [
        {
          key: p.event_id,
          kind: match ? "partido" : "cancha",
          title: match ? `¿Qué tan duro fue el partido${p.opponent ? ` vs. ${p.opponent}` : ""}?` : "¿Qué tan duro fue el entrenamiento?",
          detail: `${when.date === today ? "Hoy" : when.date === addDays(today, -1) ? "Ayer" : ""}${
            when.date === today || when.date === addDays(today, -1) ? ", " : ""
          }${when.time} · ${p.minutes} min${p.estimated ? " est." : ""}`,
          href: `/reportar/${p.event_id}`,
          deadline: sessionDeadline(p.ends_at),
        },
      ];
    }
    if (p.kind === "gym") {
      return [
        {
          key: p.log_id,
          kind: "gimnasio",
          title: "¿Qué tan duro fue el gimnasio?",
          detail: `${p.label ?? "Por mi cuenta"} · ${p.minutes} min`,
          href: `/mi-plan/esfuerzo/${p.log_id}`,
          deadline: gymDeadline(p.report_date),
        },
      ];
    }
    return [];
  });

  return {
    weekly,
    returnFlag,
    today,
    monday,
    sunday,
    pending,
    sessions: rows,
    gym: gymWeek.length > 0 ? { done: gymDone, total: gymWeek.length } : null,
    wellness,
    wellnessDays: ((club?.wellness_days as number[] | null) ?? [1]).map(Number),
  };
}
