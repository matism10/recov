// Evaluaciones físicas (0044): roles, tests sugeridos y formato de los valores.
// Compartido entre servidor y cliente. Las reglas de permisos reales están en la
// base (private.has_any_role en las funciones y en RLS); aquí solo deciden qué se muestra.
import type { UserRole } from "@/lib/roles";

// Registran resultados y administran el catálogo.
export const EVAL_WRITE_ROLES = ["head_coach", "kinesiologo", "preparador_fisico"] as const satisfies readonly UserRole[];
// Ven los resultados de todo el plantel (el manager no).
export const EVAL_READ_ROLES = [
  "head_coach",
  "kinesiologo",
  "entrenador",
  "nutricionista",
  "preparador_fisico",
] as const satisfies readonly UserRole[];

export function canWriteEvaluations(roles: readonly UserRole[]) {
  return EVAL_WRITE_ROLES.some((r) => roles.includes(r));
}
export function canReadEvaluations(roles: readonly UserRole[]) {
  return EVAL_READ_ROLES.some((r) => roles.includes(r));
}

export type DisplayFormat = "number" | "mmss";

export type TestDefinition = {
  id: string;
  name: string;
  unit: string;
  higher_is_better: boolean;
  display_format: DisplayFormat;
};

export const TEST_COLUMNS = "id, name, unit, higher_is_better, display_format";

// Tests sugeridos: se copian al catálogo del plantel al activarlos.
export const SUGGESTED_TESTS: Omit<TestDefinition, "id">[] = [
  { name: "Sentadilla 1RM", unit: "kg", higher_is_better: true, display_format: "number" },
  { name: "Press banca 1RM", unit: "kg", higher_is_better: true, display_format: "number" },
  { name: "Peso muerto 1RM", unit: "kg", higher_is_better: true, display_format: "number" },
  { name: "Salto CMJ", unit: "cm", higher_is_better: true, display_format: "number" },
  { name: "Sprint 20 m", unit: "s", higher_is_better: false, display_format: "number" },
  { name: "Yo-Yo IR1", unit: "m", higher_is_better: true, display_format: "number" },
  { name: "Bronco test", unit: "mm:ss", higher_is_better: false, display_format: "mmss" },
];

const numberFormat = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });

// Valor sin unidad: "120", "2,95" o "4:35" (mm:ss guarda segundos).
export function formatNumber(value: number, format: DisplayFormat) {
  if (format === "mmss") {
    const total = Math.round(value);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return numberFormat.format(value);
}

// Valor con su unidad: "120 kg", "2,95 s", "4:35".
export function formatValue(value: number, test: Pick<TestDefinition, "unit" | "display_format">) {
  const n = formatNumber(value, test.display_format);
  return test.display_format === "mmss" ? n : `${n} ${test.unit}`;
}

// Texto del formulario → número. null si no es válido. mm:ss acepta "4:35" o segundos.
export function parseValue(input: string, format: DisplayFormat): number | null {
  const s = input.trim();
  if (!s) return null;
  if (format === "mmss") {
    const m = s.match(/^(\d{1,3}):([0-5]\d)$/);
    const seconds = m ? Number(m[1]) * 60 + Number(m[2]) : /^\d+$/.test(s) ? Number(s) : NaN;
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  }
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0 || n >= 1e8) return null;
  return Math.round(n * 100) / 100;
}

export type Change = {
  // Diferencia con signo (actual - anterior).
  delta: number;
  // "mejor", "peor" o "igual", según si más o menos es mejor en ese test.
  verdict: "mejor" | "peor" | "igual";
  // Texto de la diferencia con su unidad: "+10 kg", "−0,15 s", "−0:12".
  label: string;
};

export function changeFrom(current: number, previous: number | null, test: TestDefinition): Change | null {
  if (previous === null) return null;
  const delta = Math.round((current - previous) * 100) / 100;
  if (delta === 0) return { delta, verdict: "igual", label: "sin cambio" };
  const better = test.higher_is_better ? delta > 0 : delta < 0;
  const sign = delta > 0 ? "+" : "−";
  const abs = formatNumber(Math.abs(delta), test.display_format);
  return {
    delta,
    verdict: better ? "mejor" : "peor",
    label: `${sign}${abs}${test.display_format === "mmss" ? "" : ` ${test.unit}`}`,
  };
}

// Mensajes de las funciones de la base, en español para la interfaz.
export function evaluationErrorMessage(error: { code?: string; message: string }, fallback: string) {
  if (error.code === "42501") return "No tienes permiso para hacer esto.";
  if (error.code === "23505") return "Ya hay un resultado de ese jugador en esa fecha: anúlalo primero o elige otra fecha.";
  if (error.message.includes("fecha no puede ser futura")) return "La fecha no puede ser futura.";
  if (error.message.includes("jugador fuera del club")) return "Uno de los jugadores ya no está en el plantel. Recarga la página.";
  if (error.code === "23514") return "Revisa los datos: alguno no cumple los límites.";
  return fallback;
}
