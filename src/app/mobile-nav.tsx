"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Ellipsis, LogOut } from "lucide-react";
import {
  BOTTOM_BAR_ITEMS,
  REGISTROS,
  isNavHidden,
  moreItems,
  type NavItem,
} from "@/app/nav-items";
import { signOut } from "@/app/login/actions";
import { chipClass } from "@/app/ui";

// Ítem de la barra: ícono sobre etiqueta, mismo estilo activo que la sidebar.
const barItemClass = (active: boolean) =>
  `relative flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] leading-none font-medium text-ink transition ${
    active ? "bg-white shadow-sm" : "hover:bg-white/60"
  }`;

const sheetItemClass = (active: boolean) =>
  `flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-base font-medium text-ink transition ${
    active ? "bg-brand-soft" : "hover:bg-mist"
  }`;

// Barra inferior móvil (oculta desde lg, donde está la sidebar). Fija abajo, con
// el margen del área segura del celular; un separador en el flujo reserva su
// alto para que no tape el final de la página.
export function MobileNavBar({
  direction,
  staff,
  pendingCount,
}: {
  direction: boolean;
  staff: boolean;
  pendingCount: number;
}) {
  const pathname = usePathname();
  if (isNavHidden(pathname)) return null;

  // El jugador no tiene "Más"; el staff sí (con más ítems si es de la dirección).
  const more = moreItems({ direction, staff });

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
          {more.length > 0 && (
            <li className="min-w-0 flex-1">
              <MoreSheet
                items={more}
                pathname={pathname}
                // Solo la dirección ve registros pendientes (RLS); el número va en la hoja.
                pendingCount={direction ? pendingCount : 0}
              />
            </li>
          )}
        </ul>
      </nav>
    </>
  );
}

// "Más": abre una hoja desde abajo (<dialog> modal nativo: atrapa el foco y se
// cierra con Esc). También se cierra al tocar fuera y al navegar.
function MoreSheet({
  items,
  pathname,
  pendingCount,
}: {
  items: NavItem[];
  pathname: string;
  pendingCount: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = () => dialogRef.current?.close();

  // Al cambiar de ruta, la hoja se cierra.
  useEffect(() => {
    dialogRef.current?.close();
  }, [pathname]);

  const active = items.some((item) => item.isActive(pathname));

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
        className={barItemClass(active)}
      >
        <span className="relative">
          <Ellipsis aria-hidden="true" className="size-5 shrink-0" />
          {pendingCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-1 size-2.5 rounded-full bg-danger ring-2 ring-brand-soft"
            />
          )}
        </span>
        <span className="truncate">Más</span>
        {pendingCount > 0 && <span className="sr-only">: hay registros pendientes</span>}
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Más"
        // Un clic en el fondo (fuera del contenido) llega al propio <dialog>.
        onClick={(e) => e.target === e.currentTarget && close()}
        className="mx-0 mt-auto mb-0 max-h-[85dvh] w-full max-w-none rounded-t-2xl bg-white p-0 text-ink backdrop:bg-ink/30 lg:hidden"
      >
        <ul className="space-y-1 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {items.map((item) => {
            const itemActive = item.isActive(pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={close}
                  aria-current={itemActive ? "page" : undefined}
                  className={sheetItemClass(itemActive)}
                >
                  <item.Icon aria-hidden="true" className="size-5 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item === REGISTROS && pendingCount > 0 && (
                    <span className={chipClass}>
                      {pendingCount}
                      <span className="sr-only"> pendientes</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
          <li>
            <form action={signOut}>
              <button type="submit" className={sheetItemClass(false)}>
                <LogOut aria-hidden="true" className="size-5 shrink-0" />
                Cerrar sesión
              </button>
            </form>
          </li>
        </ul>
      </dialog>
    </>
  );
}
