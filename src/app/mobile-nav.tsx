"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BOTTOM_BAR_ITEMS, isNavHidden } from "@/app/nav-items";

// Ítem de la barra: ícono sobre etiqueta, mismo estilo activo que la sidebar.
export const barItemClass = (active: boolean) =>
  `relative flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] leading-none font-medium text-ink transition ${
    active ? "bg-white shadow-sm" : "hover:bg-white/60"
  }`;

// Barra inferior móvil (oculta desde lg, donde está la sidebar). Fija abajo, con
// el margen del área segura del celular; un separador en el flujo reserva su
// alto para que no tape el final de la página.
export function MobileNavBar() {
  const pathname = usePathname();
  if (isNavHidden(pathname)) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className="h-[calc(4.75rem+env(safe-area-inset-bottom))] shrink-0 lg:hidden"
      />
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-brand/40 bg-brand-soft px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden"
      >
        <ul className="flex gap-1">
          {BOTTOM_BAR_ITEMS.map((item) => {
            const active = item.isActive(pathname);
            return (
              <li key={item.href} className="min-w-0 flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={barItemClass(active)}
                >
                  <item.Icon aria-hidden="true" className="size-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
