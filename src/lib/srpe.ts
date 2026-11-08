// sRPE (esfuerzo percibido por sesión) y check de bienestar (20261105180000 y 190000).
// Tipos, textos y lecturas compartidos. La base calcula minutos, cargas y avisos: aquí
// solo se presentan. En la interfaz nunca se habla de "riesgo de lesión": se dice
// "Carga alta" y "Bajo lo habitual".
import type { createClient } from "@/lib/supabase/server";
import type { Format } from "@/lib/sevens";
import { chileDateTime, compactDayLabel, type EventType } from "@/lib/events";

type Client = Awaited<ReturnType<typeof createClient>>;

// ---------------------------------------------------------------------------
// Escala 0–10 (Borg CR-10 modificada): etiqueta, frase corta y color de cada número
// (de gris a celeste y luego naranjo). El texto sobre estos colores va en #082F49.
// ---------------------------------------------------------------------------
export const RPE_SCALE: { label: string; hint: string; color: string }[] = [
  { label: "Reposo", hint: "No me costó nada", color: "#F1F5F9" },
  { label: "Muy fácil", hint: "Podía conversar sin problema", color: "#E0F2FE" },
  { label: "Fácil", hint: "Podía conversar sin problema", color: "#E0F2FE" },
  { label: "Moderado", hint: "Respiraba más rápido", color: "#BAE6FD" },
  { label: "Algo duro", hint: "Respiraba más rápido", color: "#BAE6FD" },
  { label: "Duro", hint: "Me costó mantener el ritmo", color: "#7DD3FC" },
  { label: "Duro", hint: "Me costó mantener el ritmo", color: "#7DD3FC" },
  { label: "Muy duro", hint: "Casi al límite", color: "#FDBA74" },
  { label: "Muy duro", hint: "Casi al límite", color: "#FDBA74" },
  { label: "Casi máximo", hint: "No podía dar más", color: "#FB923C" },
  { label: "Máximo", hint: "No podía dar más", color: "#FB923C" },
];

// ---------------------------------------------------------------------------
// Bienestar: 5 preguntas de 1 a 5 (5 = mejor siempre)
// ---------------------------------------------------------------------------
export type WellnessItem = "fatigue" | "sleep" | "soreness" | "stress" | "mood";

export const WELLNESS_ITEMS: { key: WellnessItem; title: string; low: string; high: string }[] = [
  { key: "fatigue", title: "Fatiga", low: "Muy cansado", high: "Fresco" },
  { key: "sleep", title: "Calidad del sueño", low: "Dormí muy mal", high: "Dormí muy bien" },
  { key: "soreness", title: "Dolor muscular", low: "Mucho dolor", high: "Sin dolor" },
  { key: "stress", title: "Estrés", low: "Muy estresado", high: "Relajado" },
  { key: "mood", title: "Ánimo", low: "Muy bajo", high: "Muy bueno" },
];

export const WELLNESS_ITEM_LABEL: Record<WellnessItem, string> = {
  fatigue: "fatiga",
  sleep: "sueño",
  soreness: "dolor muscular",
  stress: "estrés",
  mood: "ánimo",
};

export const WELLNESS_MAX = 25;

// Días ISO (1 = lunes … 7 = domingo).
export const WEEKDAYS: { iso: number; label: string; short: string }[] = [
  { iso: 1, label: "Lunes", short: "Lun" },
  { iso: 2, label: "Martes", short: "Mar" },
  { iso: 3, label: "Miércoles", short: "Mié" },
  { iso: 4, label: "Jueves", short: "Jue" },
  { iso: 5, label: "Viernes", short: "Vie" },
  { iso: 6, label: "Sábado", short: "Sáb" },
  { iso: 7, label: "Domingo", short: "Dom" },
];

// "fatiga y sueño bajos" / "dolor muscular bajo"
export function lowItemsText(items: WellnessItem[]) {
  if (items.length === 0) return "";
  const names = items.map((i) => WELLNESS_ITEM_LABEL[i]);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
  const text = `${list} ${names.length === 1 ? "bajo" : "bajos"}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------------------------------------------------------------------------
// Formato de números (es-CL: 1.240, 6,4)
// ---------------------------------------------------------------------------
const intFormat = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const formatLoad = (n: number) => intFormat.format(n);
export const formatAvg = (n: number) => oneDecimal.format(n);

// "Mar 3 nov · 19:30"
export function sessionWhen(startsAt: string) {
  const { date, time } = chileDateTime(startsAt);
  return `${compactDayLabel(date)} · ${time}`;
}

// "Lun 2 nov" para una fecha YYYY-MM-DD.
export const dayLabel = (date: string) => compactDayLabel(date);

// "7 × 90 min = 630"
export function loadFormula(rpe: number, minutes: number) {
  return `${rpe} × ${minutes} min = ${formatLoad(rpe * minutes)}`;
}

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------
export type PendingReport =
  | {
      kind: "session";
      event_id: string;
      event_type: EventType;
      starts_at: string;
      ends_at: string;
      opponent: string | null;
      location: string | null;
      minutes: number;
      estimated: boolean;
    }
  | { kind: "wellness"; report_date: string }
  // Sesión de gimnasio sin esfuerzo (20261105201000): log_id, nombre de la sesión (null
  // si fue por su cuenta), su día y su duración.
  | { kind: "gym"; log_id: string; label: string | null; report_date: string; minutes: number };

type PendingRow = {
  kind: "session" | "wellness" | "gym";
  event_id: string | null;
  event_type: EventType | null;
  starts_at: string | null;
  ends_at: string | null;
  opponent: string | null;
  location: string | null;
  minutes: number | null;
  estimated: boolean | null;
  report_date: string | null;
};

// Pendientes del jugador autenticado (my_pending_reports). Si falla, sin pendientes:
// el bloque es una ayuda y no debe romper el Resumen.
export async function getMyPendingReports(supabase: Client, format: Format): Promise<PendingReport[]> {
  const { data, error } = await supabase.rpc("my_pending_reports", { p_format: format });
  if (error || !data) return [];
  return (data as PendingRow[]).map((r): PendingReport =>
    r.kind === "wellness"
      ? { kind: "wellness", report_date: r.report_date! }
      : r.kind === "gym"
        ? // En las filas de gimnasio, event_id es el registro y location el nombre de la sesión.
          { kind: "gym", log_id: r.event_id!, label: r.location, report_date: r.report_date!, minutes: r.minutes ?? 0 }
        : {
          kind: "session",
          event_id: r.event_id!,
          event_type: r.event_type!,
          starts_at: r.starts_at!,
          ends_at: r.ends_at!,
          opponent: r.opponent,
          location: r.location,
          minutes: r.minutes ?? 0,
          estimated: r.estimated ?? false,
        },
  );
}

export type SessionReport = {
  event_id: string;
  type: EventType;
  starts_at: string;
  ends_at: string;
  opponent: string | null;
  location: string | null;
  format: Format;
  minutes: number;
  estimated: boolean;
  answered: boolean;
  rpe: number | null;
  absent: boolean;
  can_submit: boolean;
  reason: string | null;
};

// Desde 20261105201000 la carga suma el gimnasio y trae el desglose por tipo.
export type WeekLoad = {
  week_start: string;
  load: number;
  sessions: number;
  estimated: boolean;
  cancha: number;
  gimnasio: number;
  partido: number;
};
export type WeekSession = {
  event_id: string; // evento o registro de gimnasio
  kind: "cancha" | "gimnasio" | "partido";
  label: string;
  type: EventType | "gimnasio";
  starts_at: string;
  rpe: number;
  minutes: number;
  estimated: boolean;
  load: number;
};
export type WeeklyLoad = {
  weeks: WeekLoad[];
  current_load: number;
  baseline: number | null;
  prior_weeks: number;
  high_load: boolean;
  pct_over: number | null;
  ratio: number;
  current_sessions: WeekSession[];
};

export async function getPlayerWeeklyLoad(supabase: Client, playerId: string, format: Format) {
  const { data, error } = await supabase.rpc("player_weekly_load", {
    p_player_id: playerId,
    p_weeks: 6,
    p_format: format,
  });
  if (error || !data) return null;
  return data as WeeklyLoad;
}

export type EventRpeSummary = {
  event_id: string;
  type: EventType;
  starts_at: string;
  ends_at: string;
  format: Format;
  opponent: string | null;
  cancelled: boolean;
  expected: number;
  responded: number;
  avg_rpe: number | null;
  avg_load: number | null;
  estimated: boolean;
  responses: { player_id: string; full_name: string; rpe: number; minutes: number; estimated: boolean; load: number }[];
  missing: { player_id: string; full_name: string }[];
  absent: { player_id: string; full_name: string }[];
};

export type WellnessFlag = {
  player_id: string;
  full_name: string;
  report_date: string;
  total: number;
  fatigue: number;
  sleep: number;
  soreness: number;
  stress: number;
  mood: number;
  baseline: number | null;
  prior_reports: number;
  low: boolean;
  low_items: WellnessItem[];
};

// "5 puntos bajo su promedio" o los ítems bajos; para la lista del staff.
export function wellnessReason(f: WellnessFlag) {
  const drop = f.baseline !== null ? Math.round(f.baseline - f.total) : 0;
  if (f.prior_reports >= 3 && drop >= 4) {
    const items = f.low_items.length > 0 ? ` · ${lowItemsText(f.low_items).toLowerCase()}` : "";
    return `${drop} puntos bajo su promedio${items}`;
  }
  return lowItemsText(f.low_items) || "Algún ítem en 1";
}

export type TeamSrpeRow = {
  player_id: string;
  full_name: string;
  current_load: number;
  current_sessions: number;
  baseline: number | null;
  prior_weeks: number;
  high_load: boolean;
  pct_over: number | null;
};

export type WellnessReport = {
  report_date: string;
  total: number;
  fatigue: number;
  sleep: number;
  soreness: number;
  stress: number;
  mood: number;
};
export const WELLNESS_COLUMNS = "report_date, total, fatigue, sleep, soreness, stress, mood";

// Mensaje de error de las funciones de escritura, en español.
export function srpeErrorMessage(error: { code?: string; message: string }, fallback: string) {
  if (error.code === "42501") return "No tienes permiso para responder.";
  if (error.code === "P0001" && error.message !== "not_found") return `${error.message}.`;
  return fallback;
}

// Día ISO (1 = lunes … 7 = domingo) de una fecha YYYY-MM-DD.
export function isoWeekday(date: string) {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

// Fecha del check que toca hoy, con la misma regla que la base (wellness_target_date):
// hoy si es día de check; ayer si ayer era y hoy no; si no, null. Solo para mostrar.
export function wellnessTargetDate(days: number[], today: string, yesterday: string) {
  if (days.includes(isoWeekday(today))) return today;
  if (days.includes(isoWeekday(yesterday))) return yesterday;
  return null;
}

// "los lunes y jueves", "los sábados", "todos los días"
export function wellnessDaysText(days: number[]) {
  if (days.length === 7) return "todos los días";
  const names = WEEKDAYS.filter((d) => days.includes(d.iso)).map((d) => {
    const n = d.label.toLowerCase();
    return n.endsWith("s") ? n : `${n}s`; // lunes…viernes no cambian; sábados, domingos
  });
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
  return `los ${list}`;
}
