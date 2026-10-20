// Navegación de la app: ítems y reglas por rol, compartidos por la sidebar de
// escritorio, la barra inferior móvil y la hoja "Más". Solo deciden qué se
// muestra: cada página valida su propio acceso.
import {
  Activity,
  CalendarDays,
  ChartColumn,
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

// Sidebar de escritorio. Registros, Staff y Configuración: solo la dirección
// (head coach y manager).
export function sidebarItems(direction: boolean): NavItem[] {
  return direction
    ? [RESUMEN, PLANTEL, LESIONES, CALENDARIO, REGISTROS, STAFF, CONFIGURACION]
    : [RESUMEN, PLANTEL, LESIONES, CALENDARIO];
}

// Barra inferior móvil: los mismos cuatro destinos para todos los roles. El jugador
// suma al centro el botón "+" para registrar una lesión (no es un destino).
export const BOTTOM_BAR_ITEMS: NavItem[] = [RESUMEN, PLANTEL, LESIONES, CALENDARIO];

// Formulario con el que el jugador registra su lesión (el mismo del Resumen).
export const REGISTRAR_LESION_HREF = "/registrar-lesion";

// Hoja "Más" de la barra móvil: solo el staff la tiene (el jugador no). La
// dirección suma Registros, Staff y Configuración. "Cerrar sesión" va aparte.
export function moreItems({ direction, staff }: { direction: boolean; staff: boolean }): NavItem[] {
  if (direction) return [REGISTROS, STAFF, CONFIGURACION, METRICAS];
  if (staff) return [METRICAS];
  return [];
}
