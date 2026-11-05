// Navegación de la app: ítems y reglas por rol, compartidos por la sidebar de
// escritorio, la barra inferior móvil y la hoja "Más". Solo deciden qué se
// muestra: cada página valida su propio acceso.
import {
  Activity,
  BicepsFlexed,
  CalendarDays,
  CircleUserRound,
  ChartColumn,
  ClipboardList,
  Dumbbell,
  HeartPulse,
  LayoutDashboard,
  Settings,
  UserCheck,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { NavScreen } from "@/lib/nav-slots";

export type NavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
  // Rutas que también marcan este ítem como activo.
  isActive: (path: string) => boolean;
};

export const startsWith = (path: string, prefix: string) =>
  path === prefix || path.startsWith(`${prefix}/`);

// Pantallas sin navegación de la app (entrada y registro).
export const HIDDEN_ON = ["/login", "/c", "/pendiente"];

export function isNavHidden(path: string) {
  return HIDDEN_ON.some((prefix) => startsWith(path, prefix));
}

export const RESUMEN: NavItem = {
  href: "/dashboard",
  label: "Resumen",
  Icon: LayoutDashboard,
  isActive: (p) => startsWith(p, "/dashboard"),
};
export const PLANTEL: NavItem = {
  href: "/plantel",
  label: "Plantel",
  Icon: Users,
  isActive: (p) =>
    startsWith(p, "/plantel") || startsWith(p, "/jugadores") || startsWith(p, "/lesiones/marcar"),
};
export const LESIONES: NavItem = {
  href: "/lesiones",
  label: "Lesiones",
  Icon: Activity,
  isActive: (p) =>
    (startsWith(p, "/lesiones") && !startsWith(p, "/lesiones/marcar")) ||
    startsWith(p, "/registrar-lesion"),
};
export const CALENDARIO: NavItem = {
  href: "/calendario",
  label: "Calendario",
  Icon: CalendarDays,
  isActive: (p) => startsWith(p, "/calendario"),
};
export const REGISTROS: NavItem = {
  href: "/registros",
  label: "Registros",
  Icon: UserCheck,
  isActive: (p) => startsWith(p, "/registros"),
};
export const STAFF: NavItem = {
  href: "/staff",
  label: "Staff",
  Icon: UsersRound,
  isActive: (p) => startsWith(p, "/staff"),
};
export const CONFIGURACION: NavItem = {
  href: "/configuracion",
  label: "Configuración",
  Icon: Settings,
  isActive: (p) => startsWith(p, "/configuracion"),
};
export const METRICAS: NavItem = {
  href: "/metricas",
  label: "Métricas",
  Icon: ChartColumn,
  isActive: (p) => startsWith(p, "/metricas"),
};

export const EVALUACIONES: NavItem = {
  href: "/evaluaciones",
  label: "Evaluaciones",
  Icon: Dumbbell,
  isActive: (p) => startsWith(p, "/evaluaciones"),
};

export const NOMINAS: NavItem = {
  href: "/nominas",
  label: "Nóminas",
  Icon: ClipboardList,
  isActive: (p) => startsWith(p, "/nominas"),
};

// Planes de gimnasio (head coach y preparador físico) y Mi plan (jugador).
export const PLANES: NavItem = {
  href: "/planes",
  label: "Planes de gimnasio",
  Icon: BicepsFlexed,
  isActive: (p) => startsWith(p, "/planes"),
};
export const MI_PLAN: NavItem = {
  href: "/mi-plan",
  label: "Mi plan",
  Icon: BicepsFlexed,
  isActive: (p) => startsWith(p, "/mi-plan"),
};

// Sidebar de escritorio, en dos áreas: el día a día (Métricas y Nóminas solo para
// el staff) y la administración del club (Registros, Staff y Configuración, solo
// la dirección: head coach y manager).
// Evaluaciones: el staff que ve resultados (todos menos el manager).
// Configuración: también el preparador físico, que ahí solo ve el check de bienestar.
// Planes de gimnasio: head coach y preparador físico; Mi plan: el jugador.
export function sidebarItems({
  direction,
  staff,
  evaluations = false,
  wellnessConfig = false,
  gymPlanner = false,
  player = false,
}: {
  direction: boolean;
  staff: boolean;
  evaluations?: boolean;
  wellnessConfig?: boolean;
  gymPlanner?: boolean;
  player?: boolean;
}): {
  main: NavItem[];
  admin: NavItem[];
} {
  const main = [RESUMEN, PLANTEL, LESIONES, CALENDARIO];
  if (staff) main.push(METRICAS);
  // Nóminas: todos los confirmados (0048); el jugador la ve en lectura.
  main.push(NOMINAS);
  if (evaluations) main.push(EVALUACIONES);
  if (gymPlanner) main.push(PLANES);
  if (player) main.push(MI_PLAN);
  const admin = direction ? [REGISTROS, STAFF, CONFIGURACION] : wellnessConfig ? [CONFIGURACION] : [];
  return { main, admin };
}

// Pantallas propias del jugador (barra móvil y hoja "Más"). "Mis lesiones" es la
// misma lista de Lesiones: para el jugador, RLS deja solo las suyas.
export const MIS_LESIONES: NavItem = {
  href: "/lesiones",
  label: "Mis lesiones",
  Icon: HeartPulse,
  isActive: LESIONES.isActive,
};
export const MIS_EVALUACIONES: NavItem = {
  href: "/evaluaciones/mias",
  label: "Mis evaluaciones",
  Icon: Dumbbell,
  isActive: (p) => startsWith(p, "/evaluaciones/mias"),
};
export const PERFIL: NavItem = {
  href: "/perfil",
  label: "Perfil",
  Icon: CircleUserRound,
  isActive: (p) => startsWith(p, "/perfil"),
};

// Ítem de cada pantalla que se puede poner en la barra móvil (src/lib/nav-slots.ts).
export const NAV_SCREEN_ITEM: Record<NavScreen, NavItem> = {
  resumen: RESUMEN,
  calendario: CALENDARIO,
  plantel: PLANTEL,
  lesiones: LESIONES,
  nominas: NOMINAS,
  evaluaciones: EVALUACIONES,
  metricas: METRICAS,
  registros: REGISTROS,
  staff: STAFF,
  mis_lesiones: MIS_LESIONES,
  mis_evaluaciones: MIS_EVALUACIONES,
  planes: PLANES,
  mi_plan: MI_PLAN,
};

// Formulario con el que el jugador registra su lesión (el mismo del Resumen).
export const REGISTRAR_LESION_HREF = "/registrar-lesion";
