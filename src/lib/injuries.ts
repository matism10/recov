// Reglas y formato de lesiones compartidos entre servidor y cliente.
// Los límites replican los de public.report_injury (migración 0006).

export type InjuryStatus = "activa" | "cerrada";
export type InjurySeverity = "leve" | "moderada" | "grave";
export type DurationUnit = "semanas" | "meses";
export type PhaseStatus = "pendiente" | "en_curso" | "completada";

export const INJURY_TYPE_MIN = 2;
export const INJURY_TYPE_MAX = 120;
export const DESCRIPTION_MAX = 1000;
export const FILE_NAME_MAX = 200;
export const MAX_INJURY_AGE_DAYS = 365;
export const DURATION_MAX: Record<DurationUnit, number> = { semanas: 104, meses: 24 };

export const MIN_FILES = 1;
export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
// Tipo MIME → extensión con que se guarda en Storage.
export const FILE_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export const INJURY_STATUS_LABEL: Record<InjuryStatus, string> = {
  activa: "Activa",
  cerrada: "Cerrada",
};

export const SEVERITY_LABEL: Record<InjurySeverity, string> = {
  leve: "Leve",
  moderada: "Moderada",
  grave: "Grave",
};

export const PHASE_STATUS_LABEL: Record<PhaseStatus, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  completada: "Completada",
};

export function durationLabel(value: number, unit: DurationUnit) {
  if (value === 1) return unit === "semanas" ? "1 semana" : "1 mes";
  return `${value} ${unit}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Fecha de hoy (YYYY-MM-DD) en Chile, sin importar la zona horaria del servidor.
export function todayInChile() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
  }).format(new Date());
}

// Convierte YYYY-MM-DD a milisegundos UTC; null si la fecha no existe.
export function parseIsoDate(value: string) {
  if (!ISO_DATE_RE.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(ms)) return null;
  // Rechaza fechas como 2026-02-31, que Date.parse corrige solo.
  return new Date(ms).toISOString().slice(0, 10) === value ? ms : null;
}

export function addDays(isoDate: string, days: number) {
  const ms = parseIsoDate(isoDate)!;
  return new Date(ms + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.round((parseIsoDate(to)! - parseIsoDate(from)!) / DAY_MS);
}

// Avance hacia el alta: (hoy − inicio) / (alta − inicio), entre 0 y 100 %.
export function recoveryProgress(startedOn: string, expectedReturnOn: string) {
  const total = Math.max(daysBetween(startedOn, expectedReturnOn), 1);
  const day = Math.min(Math.max(daysBetween(startedOn, todayInChile()), 0), total);
  return { day, total, percent: Math.round((day / total) * 100) };
}

const dateFormat = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(isoDate: string) {
  return dateFormat.format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`));
}
