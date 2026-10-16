"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CalendarDays,
  LayoutDashboard,
  Settings,
  UserCheck,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/app/avatar";
import { ClubLogo } from "@/app/club-logo";
import { chipClass } from "@/app/ui";

type Item = {
  href: string;
  label: string;
  Icon: LucideIcon;
  // Rutas que también marcan este ítem como activo.
  isActive: (path: string) => boolean;
};

const startsWith = (path: string, prefix: string) =>
  path === prefix || path.startsWith(`${prefix}/`);

const RESUMEN: Item = {
  href: "/dashboard",
  label: "Resumen",
  Icon: LayoutDashboard,
  isActive: (p) => startsWith(p, "/dashboard"),
};
const PLANTEL: Item = {
  href: "/plantel",
  label: "Plantel",
  Icon: Users,
  isActive: (p) =>
    startsWith(p, "/plantel") || startsWith(p, "/jugadores") || startsWith(p, "/lesiones/marcar"),
};
const LESIONES: Item = {
  href: "/lesiones",
  label: "Lesiones",
  Icon: Activity,
  isActive: (p) =>
    (startsWith(p, "/lesiones") && !startsWith(p, "/lesiones/marcar")) ||
    startsWith(p, "/registrar-lesion"),
};
const CALENDARIO: Item = {
  href: "/calendario",
  label: "Calendario",
  Icon: CalendarDays,
  isActive: (p) => startsWith(p, "/calendario"),
};
const REGISTROS: Item = {
  href: "/registros",
  label: "Registros pendientes",
  Icon: UserCheck,
  isActive: (p) => startsWith(p, "/registros"),
};
const STAFF: Item = {
  href: "/staff",
  label: "Staff",
  Icon: UsersRound,
  isActive: (p) => startsWith(p, "/staff"),
};
const CONFIGURACION: Item = {
  href: "/configuracion",
  label: "Configuración",
  Icon: Settings,
  isActive: (p) => startsWith(p, "/configuracion"),
};

// Pantallas sin navegación de la app (entrada y registro).
const HIDDEN_ON = ["/login", "/c", "/pendiente"];

const itemClass = (active: boolean) =>
  `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
    active ? "bg-brand-soft text-brand-text" : "text-ink hover:bg-white"
  }`;

export function SidebarNav({
  clubName,
  clubLogoUrl,
  fullName,
  avatarUrl,
  direction,
  pendingCount,
}: {
  clubName: string;
  clubLogoUrl: string | null;
  fullName: string;
  avatarUrl: string | null;
  direction: boolean;
  pendingCount: number;
}) {
  const pathname = usePathname();
  if (HIDDEN_ON.some((prefix) => startsWith(pathname, prefix))) return null;

  // Registros pendientes, Staff y Configuración: solo la dirección (head coach y manager).
  const items = direction
    ? [RESUMEN, PLANTEL, LESIONES, CALENDARIO, REGISTROS, STAFF, CONFIGURACION]
    : [RESUMEN, PLANTEL, LESIONES, CALENDARIO];
  const profileActive = startsWith(pathname, "/perfil");

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-mist px-3 py-6 lg:flex">
      <div className="flex items-center gap-3 px-3">
        <ClubLogo name={clubName} url={clubLogoUrl} />
        <div className="min-w-0">
          <p className="font-display text-xl leading-tight font-extrabold text-ink">Recov</p>
          <p className="truncate text-sm text-muted">{clubName}</p>
        </div>
      </div>

      <nav aria-label="Principal" className="mt-8 flex-1">
        <ul className="space-y-1">
          {items.map((item) => {
            const active = item.isActive(pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={itemClass(active)}
                >
                  <item.Icon aria-hidden="true" className="size-5 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item === REGISTROS && pendingCount > 0 && (
                    <span className={chipClass}>{pendingCount}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Link
        href="/perfil"
        aria-current={profileActive ? "page" : undefined}
        className={itemClass(profileActive)}
      >
        <Avatar name={fullName} url={avatarUrl} />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{fullName}</span>
          <span className="block text-xs font-normal text-muted">Perfil</span>
        </span>
      </Link>
    </aside>
  );
}
