// Plan de gimnasio (20261105200000, 201000 y 210000): tipos, textos y lecturas compartidas.
// La base calcula kilos, plazos, asignaciones y cumplimiento; aquí solo se presentan.
// El gimnasio no tiene formato: cuenta igual en Rugby 15 y en Sevens.
import type { createClient } from "@/lib/supabase/server";
import { addDays, todayInChile } from "@/lib/injuries";
import { compactDayLabel, weekStart } from "@/lib/events";
export { canPlanGym } from "@/lib/gym-roles";
export { blockRuns, exerciseCodes, normalizeSupersets, sameSuperset, supersetsFromLinks } from "@/lib/gym-groups";
import { normalizeSupersets } from "@/lib/gym-groups";

type Client = Awaited<ReturnType<typeof createClient>>;

// ---------------------------------------------------------------------------
// Intensidad
// ---------------------------------------------------------------------------
export type IntensityType = "pct" | "rpe" | "kg" | "bw" | "tiempo";

export const INTENSITY_OPTIONS: { value: IntensityType; label: string }[] = [
  { value: "pct", label: "% máx" },
  { value: "rpe", label: "Esfuerzo" },
  { value: "kg", label: "Kilos" },
  { value: "bw", label: "Corporal" },
  { value: "tiempo", label: "Tiempo" },
];

// Rangos (iguales a los checks de la base).
export const GYM_LIMITS = {
  nameMin: 2,
  nameMax: 80,
  exerciseMax: 60,
  setsMin: 1,
  setsMax: 10,
  repsMax: 12,
  pctMin: 30,
  pctMax: 110,
  pctStep: 5,
  rpeMin: 1,
  rpeMax: 10,
  restMax: 900,
  noteMax: 140,
  minutesMin: 10,
  minutesMax: 240,
  sessionsMax: 14,
  exercisesMax: 30,
  labelMax: 40,
  secondsMin: 5,
  secondsMax: 3600,
  blockMax: 40,
  supersetMax: 30,
};

const kgFormat = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 });
const kgPlain = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });

// "112,5 kg"
export function formatKg(n: number) {
  return `${kgFormat.format(n)} kg`;
}
// "140" (máximo de Evaluaciones, sin unidad)
export const formatMax = (n: number) => kgPlain.format(n);

// Redondeo a 2,5 kg: mismo cálculo que la base (private.gym_round_kg). Solo para la
// vista previa del editor; al jugador los kilos le llegan calculados por la base.
export function roundKg(max: number, pct: number) {
  return Math.round((max * pct) / 100 / 2.5) * 2.5;
}

// "2:30"; sin descanso, "".
export function restLabel(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// "2:30" o "90" → segundos; "" → null; inválido → undefined.
export function parseRest(value: string): number | null | undefined {
  const v = value.trim();
  if (v === "") return null;
  const mmss = /^(\d{1,2}):([0-5]\d)$/.exec(v);
  const n = mmss ? Number(mmss[1]) * 60 + Number(mmss[2]) : /^\d{1,3}$/.test(v) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= GYM_LIMITS.restMax ? n : undefined;
}

// Duración de un ejercicio por tiempo: "30 s", "1 min", "1 min 30 s".
export function durationLabel(seconds: number | null | undefined) {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} s`;
  return s === 0 ? `${m} min` : `${m} min ${s} s`;
}

// "1:30" o "45" (segundos) → segundos; "" → null; fuera de 5 s a 60 min → undefined.
export function parseDuration(value: string): number | null | undefined {
  const v = value.trim();
  if (v === "") return null;
  const mmss = /^(\d{1,2}):([0-5]\d)$/.exec(v);
  const n = mmss ? Number(mmss[1]) * 60 + Number(mmss[2]) : /^\d{1,4}$/.test(v) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= GYM_LIMITS.secondsMin && n <= GYM_LIMITS.secondsMax ? n : undefined;
}

// "4 × 5"
export const setsReps = (sets: number, reps: string) => `${sets} × ${reps}`;

// Series y repeticiones, o series y tiempo: "4 × 5", "3 × 1 min".
export const exerciseDose = (e: { sets: number; reps: string | null; intensity_type: IntensityType; seconds: number | null }) =>
  setsReps(e.sets, e.intensity_type === "tiempo" ? durationLabel(e.seconds) || "?" : e.reps || "?");

export type ExerciseLike = {
  intensity_type: IntensityType;
  pct: number | null;
  rpe: number | null;
  kg: number | null;
  seconds: number | null;
};

// Intensidad para el staff: "80 % · Sentadilla 1RM", "Esfuerzo 7/10", "60 kg", "Peso corporal".
export function intensityLabel(e: ExerciseLike, testName?: string | null) {
  switch (e.intensity_type) {
    case "pct":
      return `${e.pct} %${testName ? ` · ${testName}` : ""}`;
    case "rpe":
      return `Esfuerzo ${e.rpe}/10`;
    case "kg":
      return e.kg !== null ? formatKg(Number(e.kg)) : "Kilos";
    case "tiempo":
      return "Por tiempo";
    default:
      return "Peso corporal";
  }
}

// Intensidad para el jugador: el dato grande y el texto chico de la derecha.
// % con test: "112,5 kg" · "80 % de 140"; sin test: "80 %" · "de tu máximo".
export function playerIntensity(e: ExerciseLike & { calc_kg: number | null; max: number | null }) {
  switch (e.intensity_type) {
    case "pct":
      return e.calc_kg !== null && e.max !== null
        ? { main: formatKg(Number(e.calc_kg)), sub: `${e.pct} % de ${formatMax(Number(e.max))}` }
        : { main: `${e.pct} %`, sub: "de tu máximo" };
    case "rpe":
      return { main: `${e.rpe}/10`, sub: "esfuerzo" };
    case "kg":
      return { main: e.kg !== null ? formatKg(Number(e.kg)) : "—", sub: "" };
    case "tiempo":
      return { main: durationLabel(e.seconds) || "—", sub: "por serie" };
    default:
      return { main: "Corporal", sub: "" };
  }
}

// ---------------------------------------------------------------------------
// Destinatarios
// ---------------------------------------------------------------------------
export type TargetKind = "plantel" | "posicion" | "jugador" | "sevens";
export type PlanTarget = { kind: TargetKind; position_id?: string | null; player_id?: string | null };

// Atajos de rugby (posiciones del 15): marcan estas posiciones.
export const RUGBY_FORWARDS = ["Pilar", "Hooker", "Segunda línea", "Flanker", "Octavo"];
export const RUGBY_BACKS = ["Medio scrum", "Apertura", "Centro", "Wing", "Fullback"];

// ---------------------------------------------------------------------------
// Planes (staff)
// ---------------------------------------------------------------------------
export type PlanStatus = "borrador" | "publicado" | "archivado";

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  borrador: "Borrador",
  publicado: "Publicado",
  archivado: "Archivado",
};

export type DraftExercise = {
  key: string; // clave local (id o temporal)
  id?: string;
  name: string;
  sets: number;
  reps: string;
  intensity_type: IntensityType;
  pct: number | null;
  test_id: string | null;
  rpe: number | null;
  kg: number | null;
  seconds: number | null;
  rest_seconds: number | null;
  note: string;
  block: string | null; // bloque (ej.: "Calentamiento"); null = sin bloque
  superset: number | null; // ejercicios seguidos con el mismo número = superserie
};

export type DraftSession = {
  key: string;
  id?: string;
  label: string;
  weekday: number;
  est_minutes: number;
  exercises: DraftExercise[];
};

export type DraftPlan = {
  id?: string;
  name: string;
  starts_on: string;
  ends_on: string;
  sessions: DraftSession[];
  targets: PlanTarget[];
  exclusions: string[];
};

// Carga útil de save_gym_plan (sin las claves locales).
export function planPayload(plan: DraftPlan) {
  return {
    id: plan.id,
    name: plan.name.trim(),
    starts_on: plan.starts_on,
    ends_on: plan.ends_on,
    targets: plan.targets,
    exclusions: plan.exclusions,
    sessions: plan.sessions.map((s) => ({
      id: s.id,
      label: s.label.trim(),
      weekday: s.weekday,
      est_minutes: s.est_minutes,
      exercises: normalizeSupersets(s.exercises).map((e) => ({
        id: e.id,
        name: e.name.trim(),
        sets: e.sets,
        reps: e.intensity_type === "tiempo" ? "" : e.reps.trim(),
        intensity_type: e.intensity_type,
        seconds: e.intensity_type === "tiempo" ? e.seconds : null,
        block: e.block?.trim() || null,
        superset: e.superset,
        pct: e.intensity_type === "pct" ? e.pct : null,
        test_id: e.intensity_type === "pct" ? e.test_id : null,
        rpe: e.intensity_type === "rpe" ? e.rpe : null,
        kg: e.intensity_type === "kg" ? e.kg : null,
        rest_seconds: e.rest_seconds,
        note: e.note.trim(),
      })),
    })),
  };
}

// Mensaje de error de las funciones del gimnasio, en español.
export function gymErrorMessage(error: { code?: string; message: string }, fallback: string) {
  if (error.code === "42501") return "No tienes permiso para esta acción.";
  if (error.message === "not_found") return "No se encontró. Recarga la página.";
  if (error.code === "P0001" && error.message !== "forbidden") return `${error.message}.`;
  return fallback;
}

// "Lun 9 nov → Dom 15 nov"
export const rangeLabel = (from: string, to: string) => `${compactDayLabel(from)} → ${compactDayLabel(to)}`;

// ---------------------------------------------------------------------------
// Jugador
// ---------------------------------------------------------------------------
export type GymExercise = ExerciseLike & {
  id: string;
  sort: number;
  name: string;
  sets: number;
  reps: string | null;
  block: string | null;
  superset: number | null;
  rest_seconds: number | null;
  note: string | null;
  test_id: string | null;
  test_name: string | null;
  max: number | null;
  calc_kg: number | null;
};

export type GymTodaySession = {
  plan_session_id: string;
  plan_id: string;
  plan_name: string;
  label: string;
  est_minutes: number;
  date: string;
  today: boolean;
  log_id: string | null;
  done_ids: string[] | null;
  rpe: number | null;
  exercises: GymExercise[];
};

export type GymToday = {
  today: string;
  sessions: GymTodaySession[];
  next: {
    plan_session_id: string;
    plan_name: string;
    label: string;
    est_minutes: number;
    date: string;
    exercise_count: number;
  } | null;
};

// Sesiones de hoy y de los 2 días anteriores (en plazo) y la próxima. null si falla
// o si la cuenta no es jugador del plantel.
export async function getMyGymToday(supabase: Client): Promise<GymToday | null> {
  const { data, error } = await supabase.rpc("my_gym_today");
  if (error || !data) return null;
  return data as GymToday;
}

export type GymWeekItem = {
  date: string;
  plan_session_id: string;
  plan_name: string;
  label: string;
  est_minutes: number;
  done: boolean;
  log_id: string | null;
};

export async function getMyGymWeek(supabase: Client, monday: string): Promise<GymWeekItem[]> {
  const { data, error } = await supabase.rpc("my_gym_week", { p_monday: monday });
  if (error || !data) return [];
  return data as GymWeekItem[];
}

export type GymLogSummary = {
  log_id: string;
  first_name: string;
  own: boolean;
  label: string | null;
  performed_on: string;
  minutes: number;
  rpe: number | null;
  can_rate: boolean;
  done_exercises: number;
  total_exercises: number | null;
  week_done: number;
  week_assigned: number;
  streak: number;
};

export async function getMyGymLogSummary(supabase: Client, logId: string): Promise<GymLogSummary | null> {
  const { data, error } = await supabase.rpc("my_gym_log_summary", { p_log_id: logId });
  if (error || !data) return null;
  return data as GymLogSummary;
}

// ---------------------------------------------------------------------------
// Staff: ficha y cumplimiento
// ---------------------------------------------------------------------------
export type PlayerGymSummary = {
  plans: {
    id: string;
    name: string;
    starts_on: string;
    ends_on: string;
    sessions: { label: string; weekday: number; est_minutes: number; exercise_count: number }[];
  }[];
  weeks: { week_start: string; assigned: number; due: number; done: number }[];
  recent: {
    id: string;
    performed_on: string;
    own: boolean;
    label: string | null;
    plan_name: string | null;
    minutes: number;
    rpe: number | null;
    completed_all: boolean;
    done_exercises: number;
    total_exercises: number | null;
  }[];
};

export async function getPlayerGymSummary(supabase: Client, playerId: string): Promise<PlayerGymSummary | null> {
  const { data, error } = await supabase.rpc("player_gym_summary", { p_player_id: playerId });
  if (error || !data) return null;
  return data as PlayerGymSummary;
}

export type GymAdherenceRow = { player_id: string; full_name: string; assigned: number; due: number; done: number };

export async function getGymAdherence(supabase: Client, from: string, to: string): Promise<GymAdherenceRow[] | null> {
  const { data, error } = await supabase.rpc("gym_adherence", { p_from: from, p_to: to });
  if (error) return null;
  return (data ?? []) as GymAdherenceRow[];
}

// % cumplido: hechas / las que ya tocaban. null sin sesiones que tocaran.
export function adherencePct(rows: { due: number; done: number }[]) {
  const due = rows.reduce((n, r) => n + r.due, 0);
  const done = rows.reduce((n, r) => n + Math.min(r.done, r.due), 0);
  return due > 0 ? Math.round((done / due) * 100) : null;
}

export type LoadBreakdownRow = { player_id: string; cancha: number; gimnasio: number; partido: number };

// ---------------------------------------------------------------------------
// Semana (lunes a domingo, Chile)
// ---------------------------------------------------------------------------
export function currentWeek() {
  const today = todayInChile();
  const monday = weekStart(today);
  return { today, monday, sunday: addDays(monday, 6) };
}

// Colores de la carga por tipo (Cancha, Gimnasio, Partido).
export const LOAD_KIND_COLOR = {
  cancha: "#7DD3FC",
  gimnasio: "#0369A1",
  partido: "#F97316",
} as const;

export const LOAD_KIND_LABEL = {
  cancha: "Cancha",
  gimnasio: "Gimnasio",
  partido: "Partido",
} as const;

export type LoadKind = keyof typeof LOAD_KIND_COLOR;
export const LOAD_KINDS: LoadKind[] = ["cancha", "gimnasio", "partido"];
