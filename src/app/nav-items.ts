// Navegación de la app: ítems y reglas por rol, compartidos por la sidebar de
// escritorio, la barra inferior móvil y la hoja "Más". Solo deciden qué se
// muestra: cada página valida su propio acceso.
import {
  Activity,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  Dumbbell,
  LayoutDashboard,
  Settings,
  UserCheck,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

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

// Sidebar de escritorio, en dos áreas: el día a día (Métricas y Nóminas solo para
// el staff) y la administración del club (Registros, Staff y Configuración, solo
// la dirección: head coach y manager).
// Evaluaciones: el staff que ve resultados (todos menos el manager).
export function sidebarItems({
  direction,
  staff,
  evaluations = false,
}: {
  direction: boolean;
  staff: boolean;
  evaluations?: boolean;
}): {
  main: NavItem[];
  admin: NavItem[];
} {
  const main = [RESUMEN, PLANTEL, LESIONES, CALENDARIO];
  if (staff) main.push(METRICAS, NOMINAS);
  if (evaluations) main.push(EVALUACIONES);
  return { main, admin: direction ? [REGISTROS, STAFF, CONFIGURACION] : [] };
}

// Barra inferior móvil: los mismos cuatro destinos para todos los roles. El jugador
// suma al centro el botón "+" para registrar una lesión (no es un destino).
export const BOTTOM_BAR_ITEMS: NavItem[] = [RESUMEN, PLANTEL, LESIONES, CALENDARIO];

// Formulario con el que el jugador registra su lesión (el mismo del Resumen).
export const REGISTRAR_LESION_HREF = "/registrar-lesion";

// Hoja "Más" de la barra móvil: solo el staff la tiene (el jugador no): Métricas
// y Nóminas, y la dirección suma Registros, Staff y Configuración. "Cerrar sesión"
// va aparte.
export function moreItems({
  direction,
  staff,
  evaluations = false,
}: {
  direction: boolean;
  staff: boolean;
  evaluations?: boolean;
}): NavItem[] {
  const daily = staff ? [METRICAS, NOMINAS, ...(evaluations ? [EVALUACIONES] : [])] : [];
  if (direction) return [...daily, REGISTROS, STAFF, CONFIGURACION];
  return daily;
}
