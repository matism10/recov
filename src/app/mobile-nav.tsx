"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef } from "react";
import { CirclePlus, Ellipsis, LogOut, X } from "lucide-react";
import {
  CONFIGURACION,
  NAV_SCREEN_ITEM,
  PERFIL,
  REGISTRAR_LESION_HREF,
  REGISTROS,
  isNavHidden,
  type NavItem,
} from "@/app/nav-items";
import type { NavScreen } from "@/lib/nav-slots";
import { signOut } from "@/app/login/actions";
import { InstallBanner } from "@/app/install-banner";
import { profileButtonClass, signOutButtonClass } from "@/app/ui";

// Colores de la barra móvil (diseño de navegación, nov 2026).
// Fondo #E3F1FB, borde #CDE8F8, texto e íconos #0F1B33; botón del jugador #63BCF2.
const BAR_TEXT = "text-[#0F1B33]";

// Pestaña: ícono de 22 px sobre la etiqueta de 11 px. La activa, en blanco y redondeada.
const tabClass = (active: boolean) =>
  `relative flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-2xl px-0.5 text-[11px] leading-none ${BAR_TEXT} transition ${
    active ? "bg-white font-medium shadow-sm" : "font-normal hover:bg-white/60"
  }`;

// Punto rojo de "hay registros pendientes".
function PendingDot({ ring }: { ring: string }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute -top-0.5 -right-1 size-2.5 rounded-full bg-[#E5484D] ring-2 ${ring}`}
    />
  );
}

// El ítem activo es el más específico que coincide con la ruta (por ejemplo, en
// /evaluaciones/mias gana "Mis evaluaciones" sobre "Evaluaciones").
function activeHref(items: NavItem[], pathname: string) {
  return items
    .filter((item) => item.isActive(pathname))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

// Barra inferior móvil (oculta desde lg, donde está la sidebar). Fija abajo, con
// el margen del área segura del celular; un separador en el flujo reserva su alto
// para que no tape el final de la página.
// Slots elegidos en Perfil (3 para el jugador, con "Registrar lesión" al centro; 4
// para el resto) y "Más" siempre a la derecha.
export function MobileNavBar({
  slots,
  more,
  player,
  headCoach,
  pendingCount,
}: {
  slots: NavScreen[];
  more: NavScreen[];
  player: boolean;
  headCoach: boolean;
  pendingCount: number;
}) {
  const pathname = usePathname();
  if (isNavHidden(pathname)) return null;

  const barItems = slots.map((s) => NAV_SCREEN_ITEM[s]);
  // Configuración va en "Más" solo para el head coach.
  const moreItems = [...more.map((s) => NAV_SCREEN_ITEM[s]), ...(headCoach ? [CONFIGURACION] : [])];
  const current = activeHref([...barItems, ...moreItems, PERFIL], pathname);
  // El botón del jugador va al centro: después del segundo slot.
  const centerAfter = player ? 1 : -1;
  const registrosInBar = barItems.includes(REGISTROS);

  return (
    <>
      <div
        aria-hidden="true"
        className={`shrink-0 lg:hidden ${
          player
            ? "h-[calc(4.75rem+1.25rem+env(safe-area-inset-bottom))]"
            : "h-[calc(4.75rem+env(safe-area-inset-bottom))]"
        }`}
      />
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[#CDE8F8] bg-[#E3F1FB] px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden"
      >
        <ul className="flex gap-1">
          {barItems.map((item, i) => {
            const active = item.href === current && item.isActive(pathname);
            return (
              <Fragment key={item.href + item.label}>
                <li className="min-w-0 flex-1">
                  <Link href={item.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
                    <span className="relative">
                      <item.Icon aria-hidden="true" className="size-[22px] shrink-0" strokeWidth={1.75} />
                      {item === REGISTROS && pendingCount > 0 && <PendingDot ring="ring-[#E3F1FB]" />}
                    </span>
                    <span className="max-w-full truncate">{item.label}</span>
                    {item === REGISTROS && pendingCount > 0 && (
                      <span className="sr-only">: hay registros pendientes</span>
                    )}
                  </Link>
                </li>
                {i === centerAfter && <RegisterInjuryButton />}
              </Fragment>
            );
          })}
          <li className="min-w-0 flex-1">
            <MoreSheet
              items={moreItems}
              current={current}
              pathname={pathname}
              // El punto va en "Más" solo si Registros está en la hoja (no en la barra).
              pendingCount={registrosInBar ? 0 : pendingCount}
            />
          </li>
        </ul>
      </nav>
      {/* Guía para instalar la app, justo encima de la barra (sin taparla). */}
      <InstallBanner
        bottomClass={
          player
            ? "bottom-[calc(4.75rem+1.25rem+env(safe-area-inset-bottom)+0.5rem)]"
            : "bottom-[calc(4.75rem+env(safe-area-inset-bottom)+0.5rem)]"
        }
      />
    </>
  );
}

// "Registrar lesión" del jugador: botón fijo al centro, círculo azul grande que
// sobresale sobre la barra, con su etiqueta debajo. Lleva al mismo formulario que
// "Registra una lesión" del Resumen. No es una pestaña: no tiene estado activo.
function RegisterInjuryButton() {
  return (
    <li className="min-w-[4.75rem] flex-1">
      <Link
        href={REGISTRAR_LESION_HREF}
        className={`group flex min-h-14 w-full flex-col items-center justify-end gap-1 text-[11px] leading-none font-medium ${BAR_TEXT} focus-visible:outline-none`}
      >
        <span className="-mt-7 flex size-14 items-center justify-center rounded-full bg-[#63BCF2] shadow-md ring-4 ring-[#E3F1FB] transition group-hover:brightness-95 group-active:brightness-90 group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-brand-strong">
          <CirclePlus aria-hidden="true" className={`size-7 ${BAR_TEXT}`} strokeWidth={2} />
        </span>
        <span className="whitespace-nowrap">Registrar lesión</span>
      </Link>
    </li>
  );
}

// "Más": hoja blanca que flota sobre la barra (<dialog> modal nativo: atrapa el
// foco y se cierra con Esc). También se cierra con la X, al tocar fuera y al navegar.
function MoreSheet({
  items,
  current,
  pathname,
  pendingCount,
}: {
  items: NavItem[];
  current: string | undefined;
  pathname: string;
  pendingCount: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = () => dialogRef.current?.close();

  // Al cambiar de ruta, la hoja se cierra.
  useEffect(() => {
    dialogRef.current?.close();
  }, [pathname]);

  const isCurrent = (item: NavItem) => item.href === current && item.isActive(pathname);
  const active = [...items, PERFIL].some(isCurrent);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
        className={tabClass(active)}
      >
        <span className="relative">
          <Ellipsis aria-hidden="true" className="size-[22px] shrink-0" strokeWidth={1.75} />
          {pendingCount > 0 && <PendingDot ring={active ? "ring-white" : "ring-[#E3F1FB]"} />}
        </span>
        <span className="truncate">Más</span>
        {pendingCount > 0 && <span className="sr-only">: hay registros pendientes</span>}
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Más"
        // Un clic en el fondo (fuera del contenido) llega al propio <dialog>.
        onClick={(e) => e.target === e.currentTarget && close()}
        className={`fixed inset-x-3 top-auto bottom-[calc(6rem+env(safe-area-inset-bottom))] m-0 max-h-[calc(100dvh-8rem)] w-auto max-w-none overflow-visible rounded-3xl border border-[#CDE8F8] bg-white p-0 ${BAR_TEXT} shadow-xl backdrop:bg-ink/30 lg:hidden`}
      >
        {/* X circular arriba al centro, montada sobre el borde de la hoja. */}
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar"
          className="absolute -top-5 left-1/2 flex size-10 -translate-x-1/2 items-center justify-center rounded-full border border-[#CDE8F8] bg-white shadow-md transition hover:bg-[#F3F9FD] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong"
        >
          <X aria-hidden="true" className="size-5" />
        </button>

        <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto px-4 pt-9 pb-4">
          {/* Tres columnas; una fila incompleta queda centrada. */}
          {items.length > 0 && (
            <ul className="mx-auto flex max-w-sm flex-wrap justify-center gap-y-5">
              {items.map((item) => {
                const itemActive = isCurrent(item);
                return (
                  <li key={item.href + item.label} className="w-1/3 min-w-0 px-1">
                    <Link
                      href={item.href}
                      onClick={close}
                      aria-current={itemActive ? "page" : undefined}
                      className="flex w-full flex-col items-center gap-2 rounded-2xl px-1 py-1 text-center text-[13px] leading-tight focus-visible:outline-2 focus-visible:outline-brand-strong"
                    >
                      <span
                        className={`relative flex size-14 items-center justify-center rounded-full bg-[#E3F1FB] ${
                          itemActive ? "ring-2 ring-[#63BCF2]" : ""
                        }`}
                      >
                        <item.Icon aria-hidden="true" className="size-6" strokeWidth={1.75} />
                        {item === REGISTROS && pendingCount > 0 && (
                          <span
                            aria-hidden="true"
                            className="absolute top-0.5 right-0.5 size-3 rounded-full bg-[#E5484D] ring-2 ring-white"
                          />
                        )}
                      </span>
                      <span className={itemActive ? "font-medium" : ""}>
                        {item.label}
                        {item === REGISTROS && pendingCount > 0 && (
                          <span className="sr-only"> (hay registros pendientes)</span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <div className={`grid grid-cols-2 gap-3 ${items.length > 0 ? "mt-6" : ""}`}>
            <Link
              href={PERFIL.href}
              onClick={close}
              aria-current={isCurrent(PERFIL) ? "page" : undefined}
              className={profileButtonClass}
            >
              <PERFIL.Icon aria-hidden="true" className="size-5" />
              Perfil
            </Link>
            <form action={signOut}>
              <button type="submit" className={signOutButtonClass}>
                <LogOut aria-hidden="true" className="size-5" />
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
