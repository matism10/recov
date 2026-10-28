// Calendario de eventos: reglas, etiquetas y fechas compartidas entre servidor y
// cliente. Los límites replican los de public.events y create_event (0022).
import { addDays, parseIsoDate } from "@/lib/injuries";

export type EventType = "entrenamiento" | "competencia";
// Disponibilidad proyectada por evento (public.event_availability).
export type EventState = "ok" | "duda" | "no";

export const EVENT_TYPES = ["entrenamiento", "competencia"] as const satisfies readonly EventType[];

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  entrenamiento: "Entrenamiento",
  competencia: "Competencia",
};

export const EVENT_STATE_LABEL: Record<EventState, string> = {
  ok: "Disponible",
  duda: "En duda",
  no: "No disponible",
};

export const LOCATION_MAX = 120;
export const OPPONENT_MAX = 80;
export const NOTES_MAX = 500;
export const MAX_WEEKS = 12;

// Las competencias se crean solo con hora de inicio. La base exige un término
// (public.events.ends_at), así que se guarda inicio + este bloque; nunca se muestra.
export const COMPETITION_BLOCK_MINUTES = 120;

// Término que se guarda para una competencia: inicio + COMPETITION_BLOCK_MINUTES.
export function competitionEndIso(startsAtIso: string) {
  return new Date(new Date(startsAtIso).getTime() + COMPETITION_BLOCK_MINUTES * 60_000).toISOString();
}

// Hora que se muestra: en competencias solo el inicio; en entrenamientos, inicio – término.
export function eventTimeLabel(e: { type: EventType; start: string; end: string }) {
  return e.type === "competencia" ? e.start : `${e.start} – ${e.end}`;
}

// Verde desde este porcentaje de disponibles; ámbar bajo él.
export const AVAILABLE_OK_RATIO = 0.8;

// Datos de un evento ya listos para mostrar (fechas y horas en hora de Chile).
export type CalendarEvent = {
  id: string;
  type: EventType;
  day: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string; // HH:MM
  location: string | null;
  opponent: string | null;
  notes: string | null;
  cancelled: boolean;
  past: boolean;
  repeated: boolean; // creado con repetición semanal
};

// Resumen de event_availability para el staff: conteos y los primeros nombres.
export type EventAvailabilitySummary = {
  ok: number;
  duda: number;
  no: number;
  total: number;
  // Primeros jugadores en duda y no disponibles, con su posición.
  duda_players: SummaryPlayer[];
  no_players: SummaryPlayer[];
};

export type SummaryPlayer = { name: string; position: string | null };

export const SUMMARY_NAMES = 5;

// Columnas de public.events que usa la app.
export const EVENT_COLUMNS = "id, type, starts_at, ends_at, location, opponent, notes, series_id, cancelled_at, format";

export type EventRow = {
  id: string;
  // Formato del evento: '15' o '7' (Rugby Sevens, 0045).
  format?: string;
  type: EventType;
  starts_at: string;
  ends_at: string;
  location: string | null;
  opponent: string | null;
  notes: string | null;
  series_id: string | null;
  cancelled_at: string | null;
};

export function toCalendarEvent(row: EventRow, now: Date = new Date()): CalendarEvent {
  const start = chileDateTime(row.starts_at);
  return {
    id: row.id,
    type: row.type,
    day: start.date,
    start: start.time,
    end: chileDateTime(row.ends_at).time,
    location: row.location,
    opponent: row.opponent,
    notes: row.notes,
    cancelled: row.cancelled_at !== null,
    repeated: row.series_id !== null,
    // Igual que event_availability: desde que empieza, el evento es pasado.
    past: new Date(row.starts_at) < now,
  };
}

// Fila de public.event_availability.
export type EventAvailabilityRow = {
  player_id: string;
  full_name: string;
  player_position: string | null;
  state: EventState;
};

const toSummaryPlayer = (r: EventAvailabilityRow): SummaryPlayer => ({
  name: r.full_name,
  position: r.player_position,
});

export function summarizeAvailability(rows: EventAvailabilityRow[]): EventAvailabilitySummary {
  const sorted = [...rows].sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));
  const byState = (state: EventState) => sorted.filter((r) => r.state === state);
  const duda = byState("duda");
  const no = byState("no");
  return {
    ok: byState("ok").length,
    duda: duda.length,
    no: no.length,
    total: rows.length,
    duda_players: duda.slice(0, SUMMARY_NAMES).map(toSummaryPlayer),
    no_players: no.slice(0, SUMMARY_NAMES).map(toSummaryPlayer),
  };
}

export function availableRatioOk(s: { ok: number; total: number }) {
  return s.total > 0 && s.ok / s.total >= AVAILABLE_OK_RATIO;
}

export function eventTitle(e: { type: EventType; opponent: string | null }) {
  if (e.type === "competencia" && e.opponent) return `vs. ${e.opponent}`;
  return EVENT_TYPE_LABEL[e.type];
}

// ---------------------------------------------------------------------------
// Hora de Chile
// ---------------------------------------------------------------------------
export const CLUB_TIME_ZONE = "America/Santiago";

const partsFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: CLUB_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// Fecha (YYYY-MM-DD) y hora (HH:MM) de un instante, en Chile.
export function chileDateTime(instant: string | Date) {
  const parts = Object.fromEntries(
    partsFormat.formatToParts(new Date(instant)).map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: string) {
  return TIME_RE.test(value);
}

// Fecha y hora locales de Chile → instante ISO (UTC), respetando el horario de
// verano. null si la fecha o la hora no son válidas.
export function chileToIso(date: string, time: string) {
  const dayMs = parseIsoDate(date);
  if (dayMs === null || !isValidTime(time)) return null;
  const [hh, mm] = time.split(":").map(Number);
  const asUtc = dayMs + (hh * 60 + mm) * 60_000;
  // Se ajusta por la diferencia con Chile; dos vueltas bastan si cambia el horario.
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    const local = chileDateTime(new Date(guess));
    const localMs = parseIsoDate(local.date)! + timeToMinutes(local.time) * 60_000;
    guess = asUtc - (localMs - guess);
  }
  return new Date(guess).toISOString();
}

export function timeToMinutes(time: string) {
  const [hh, mm] = time.split(":").map(Number);
  return hh * 60 + mm;
}

// ---------------------------------------------------------------------------
// Grilla del calendario (lunes a domingo)
// ---------------------------------------------------------------------------
export function weekStart(date: string) {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = domingo
  return addDays(date, -((dow + 6) % 7));
}

export function weekDays(date: string) {
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// Primer día del mes que está a `months` meses del de `date`.
export function shiftMonth(date: string, months: number) {
  const d = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

// Días que muestra la grilla mensual: semanas completas que cubren el mes.
export function monthGridDays(date: string) {
  const first = `${date.slice(0, 7)}-01`;
  const last = addDays(shiftMonth(date, 1), -1);
  const start = weekStart(first);
  const end = addDays(weekStart(last), 6);
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

const monthFormat = new Intl.DateTimeFormat("es-CL", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const shortDayFormat = new Intl.DateTimeFormat("es-CL", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const longDayFormat = new Intl.DateTimeFormat("es-CL", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const utcDate = (date: string) => new Date(`${date}T00:00:00Z`);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// "Octubre de 2026"
export function monthLabel(date: string) {
  return capitalize(monthFormat.format(utcDate(date)));
}

// "lun, 19 oct". Sin puntos: Safari abrevia "oct." y el servidor "oct", y el
// texto debe ser igual en ambos para que React no reclame al hidratar.
export function shortDayLabel(date: string) {
  return shortDayFormat.format(utcDate(date)).replace(/\./g, "");
}

// "Sáb 24 oct"
export function compactDayLabel(date: string) {
  const parts = shortDayFormat.formatToParts(utcDate(date));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return capitalize(`${part("weekday")} ${part("day")} ${part("month")}`.replace(/\./g, ""));
}

// "Sábado, 24 de octubre de 2026"
export function longDayLabel(date: string) {
  return capitalize(longDayFormat.format(utcDate(date)));
}

export const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// ---------------------------------------------------------------------------
// Errores de create_event, update_event y cancel_event, en español
// ---------------------------------------------------------------------------
const EVENT_ERRORS: Record<string, string> = {
  forbidden: "No tienes permiso para gestionar eventos.",
  invalid_type: "Elige si es entrenamiento o competencia.",
  invalid_range: "La hora de término debe ser posterior a la de inicio.",
  invalid_weeks: `La repetición debe ser de 1 a ${MAX_WEEKS} semanas.`,
  repeat_only_training: "Solo los entrenamientos se pueden repetir.",
  not_found: "El evento no existe o ya fue cancelado.",
};

export function eventErrorMessage(error: { code?: string; message: string }, fallback: string) {
  if (error.code === "42501") return EVENT_ERRORS.forbidden;
  // 23514: un CHECK de public.events (largo de los campos, rival solo en competencias).
  if (error.code === "23514") return "Revisa los campos: alguno no cumple los límites.";
  return EVENT_ERRORS[error.message] ?? fallback;
}
