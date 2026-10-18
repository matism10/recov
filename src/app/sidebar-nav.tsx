"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { REGISTROS, isNavHidden, sidebarItems } from "@/app/nav-items";

// Sidebar en el celeste suave de marca (Sky 100), solo con la navegación: la
// identidad del club y el perfil van en el encabezado (ClubHeader). El ítem activo
// lleva una barra izquierda de 3 px en celeste de marca.
const itemClass = (active: boolean) =>
  `relative flex min-h-11 items-center gap-3 px-4 text-sm text-ink transition ${
    active
      ? "font-semibold before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r-sm before:bg-brand before:content-['']"
      : "font-medium hover:bg-white/60"
  }`;

export function SidebarNav({
  direction,
  pendingCount,
}: {
  direction: boolean;
  pendingCount: number;
}) {
  const pathname = usePathname();
  if (isNavHidden(pathname)) return null;

  const items = sidebarItems(direction);

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-brand/40 bg-brand-soft py-6 lg:flex">
      <nav aria-label="Principal">
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
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-brand-text">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
