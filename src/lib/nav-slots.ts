// Barra inferior móvil configurable (0047, 0048): pantallas por rol, cantidad de slots y
// valores por defecto. Compartido entre servidor y cliente. Las mismas reglas las
// valida la base en set_nav_slots (private.nav_allowed_screens); aquí solo deciden
// qué se muestra y qué se ofrece en Perfil.
import { isDirection, isStaff, type UserRole } from "@/lib/roles";
import { canReadEvaluations } from "@/lib/evaluations";

// Mismo orden que el catálogo de la base (private.nav_screen_keys): es también el
// orden de la hoja "Más" y de las opciones en Perfil.
export const NAV_SCREENS = [
  "resumen",
  "calendario",
  "plantel",
  "lesiones",
  "nominas",
  "evaluaciones",
  "metricas",
  "registros",
  "staff",
  "mis_lesiones",
  "mis_evaluaciones",
] as const;

export type NavScreen = (typeof NAV_SCREENS)[number];

export const NAV_SCREEN_LABEL: Record<NavScreen, string> = {
  resumen: "Resumen",
  calendario: "Calendario",
  plantel: "Plantel",
  lesiones: "Lesiones",
  nominas: "Nóminas",
  evaluaciones: "Evaluaciones",
  metricas: "Métricas",
  registros: "Registros",
  staff: "Staff",
  mis_lesiones: "Mis lesiones",
  mis_evaluaciones: "Mis evaluaciones",
};

export function isNavScreen(value: unknown): value is NavScreen {
  return typeof value === "string" && (NAV_SCREENS as readonly string[]).includes(value);
}

// Pantallas que el rol puede ver (para la barra y la hoja "Más").
// Nóminas: todos los confirmados (0048); la arman solo la dirección y el delegado,
// el resto la ve en lectura.
export function allowedScreens(roles: readonly UserRole[]): NavScreen[] {
  const staff = isStaff(roles);
  const player = roles.includes("jugador");
  const allowed = new Set<NavScreen>(["resumen", "calendario", "plantel", "nominas"]);
  if (staff) ["lesiones", "metricas"].forEach((s) => allowed.add(s as NavScreen));
  if (canReadEvaluations(roles)) allowed.add("evaluaciones");
  if (isDirection(roles)) ["registros", "staff"].forEach((s) => allowed.add(s as NavScreen));
  // Para el staff, Lesiones ya muestra las del plantel: Mis lesiones solo es del jugador.
  if (player && !staff) allowed.add("mis_lesiones");
  if (player) allowed.add("mis_evaluaciones");
  return NAV_SCREENS.filter((s) => allowed.has(s));
}

// El jugador tiene 3 slots (al centro va el botón fijo "Registrar lesión"); el resto, 4.
export function slotCount(roles: readonly UserRole[]) {
  return roles.includes("jugador") ? 3 : 4;
}

// Valor por defecto según el rol principal (si la cuenta tiene varios, el primero
// de esta lista). Kinesiólogo y su delegado comparten el suyo.
export function defaultSlots(
  roles: readonly UserRole[],
  { kineDelegate = false }: { kineDelegate?: boolean } = {},
): NavScreen[] {
  let base: NavScreen[];
  if (roles.includes("head_coach")) base = ["resumen", "calendario", "plantel", "lesiones"];
  else if (roles.includes("manager")) base = ["resumen", "calendario", "plantel", "nominas"];
  else if (roles.includes("kinesiologo") || kineDelegate) base = ["resumen", "calendario", "lesiones", "plantel"];
  else if (roles.includes("entrenador")) base = ["resumen", "calendario", "lesiones", "plantel"];
  else if (roles.includes("preparador_fisico") || roles.includes("nutricionista"))
    base = ["resumen", "calendario", "evaluaciones", "plantel"];
  else base = ["resumen", "calendario", "mis_lesiones"];
  return fill(base, allowedScreens(roles), slotCount(roles));
}

// Deja `count` pantallas permitidas y sin repetir; si faltan, completa en el orden del catálogo.
function fill(base: readonly NavScreen[], allowed: readonly NavScreen[], count: number): NavScreen[] {
  const out: NavScreen[] = [];
  for (const s of [...base, ...allowed]) {
    if (out.length === count) break;
    if (allowed.includes(s) && !out.includes(s)) out.push(s);
  }
  return out;
}

// Slots a mostrar: los guardados si siguen siendo válidos para el rol actual (los
// roles pueden cambiar después de guardar); si no, el valor por defecto.
export function resolveSlots(
  saved: readonly unknown[] | null | undefined,
  roles: readonly UserRole[],
  opts: { kineDelegate?: boolean } = {},
): NavScreen[] {
  const allowed = allowedScreens(roles);
  const count = slotCount(roles);
  if (
    saved &&
    saved.length === count &&
    saved.every((s) => isNavScreen(s) && allowed.includes(s)) &&
    new Set(saved).size === saved.length
  ) {
    return saved as NavScreen[];
  }
  return defaultSlots(roles, opts);
}
