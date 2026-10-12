// Reglas y formato de lesiones compartidos entre servidor y cliente.
// Los límites replican los de public.report_injury (0006) y del ciclo de vida (0010).

export type InjuryStatus = "en_evaluacion" | "activa" | "cerrada" | "descartada";
export type OccurredDuring = "entrenamiento" | "competencia";
export type InjurySeverity = "leve" | "moderada" | "grave";
export type DurationUnit = "semanas" | "meses";
export type PhaseStatus = "pendiente" | "en_curso" | "completada";

export const INJURY_TYPE_MIN = 2;
export const INJURY_TYPE_MAX = 120;
export const DESCRIPTION_MAX = 1000;
export const FILE_NAME_MAX = 200;
export const MAX_INJURY_AGE_DAYS = 365;
// Nota breve al marcar a un jugador lesionado (public.mark_player_injured).
export const NOTE_MIN = 2;
export const NOTE_MAX = 120;
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
  en_evaluacion: "En evaluación",
  activa: "Activa",
  cerrada: "Cerrada",
  descartada: "Descartada",
};

export const INJURY_STATUS_STYLE: Record<InjuryStatus, string> = {
  en_evaluacion: "bg-sky-100 text-sky-800",
  activa: "bg-amber-100 text-amber-800",
  cerrada: "bg-slate-100 text-slate-700",
  descartada: "bg-slate-100 text-slate-500",
};

export const OCCURRED_DURING_LABEL: Record<OccurredDuring, string> = {
  entrenamiento: "Entrenamiento",
  competencia: "Competencia",
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

// Fases sugeridas al cargar la línea de tiempo de una lesión. La fase llamada
// "Reintegro" pone al jugador en Reintegro cuando queda en curso (0015).
export const PHASE_TEMPLATE = ["Reposo", "Rehabilitación", "Readaptación", "Reintegro"];
export const PHASE_NAME_MIN = 2;
export const PHASE_NAME_MAX = 60;
export const MAX_PHASES = 8;

export type PhaseDraft = {
  id?: string;
  name: string;
  status: PhaseStatus;
  started_on: string;
  ended_on: string;
};

// Reparte las fases de la plantilla entre el inicio de la lesión y el alta
// estimada; la primera queda en curso.
export function templatePhases(startedOn: string, expectedReturnOn: string | null): PhaseDraft[] {
  const total = expectedReturnOn ? Math.max(daysBetween(startedOn, expectedReturnOn), 0) : 0;
  const span = Math.floor(total / PHASE_TEMPLATE.length);
  return PHASE_TEMPLATE.map((name, i) => {
    const last = i === PHASE_TEMPLATE.length - 1;
    return {
      name,
      status: i === 0 ? "en_curso" : "pendiente",
      started_on: expectedReturnOn ? addDays(startedOn, i * span) : i === 0 ? startedOn : "",
      ended_on: expectedReturnOn
        ? last
          ? expectedReturnOn
          : addDays(startedOn, Math.max((i + 1) * span - 1, i * span))
        : "",
    };
  });
}

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

// Tiempo que falta para el regreso estimado, para el listado de lesiones activas.
export function returnLabel(expectedReturnOn: string | null) {
  if (!expectedReturnOn) return "Sin fecha de regreso";
  const date = formatDate(expectedReturnOn);
  const days = daysBetween(todayInChile(), expectedReturnOn);
  if (days < 0) return `Regreso estimado vencido (${date})`;
  if (days === 0) return "Regresa hoy";
  if (days < 14) return `Regresa en ${days === 1 ? "1 día" : `${days} días`} · ${date}`;
  return `Regresa en ${Math.round(days / 7)} semanas · ${date}`;
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
