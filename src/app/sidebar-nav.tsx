"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Avatar } from "@/app/avatar";
import recovMark from "@/app/recov-mark.png";
import { ClubLogo } from "@/app/club-logo";
import { REGISTROS, isNavHidden, sidebarItems, startsWith } from "@/app/nav-items";

// Sidebar en tinta (Dirección A), con el mismo lenguaje que la barra móvil: texto
// #CBD5E1 y el activo con una barra izquierda de 3 px y el texto en celeste.
const itemClass = (active: boolean) =>
  `relative flex min-h-11 items-center gap-3 px-4 text-[15px] font-semibold transition ${
    active
      ? "text-brand before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r-sm before:bg-brand before:content-['']"
      : "text-nav-text hover:text-white"
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
  if (isNavHidden(pathname)) return null;

  const items = sidebarItems(direction);
  const profileActive = startsWith(pathname, "/perfil");

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-ink py-6 lg:flex">
      <div className="px-4">
        <p className="flex items-center gap-2.5">
          <Image src={recovMark} alt="" width={28} height={29} className="h-[29px] w-[28px]" />
          <span className="font-display text-2xl leading-none font-extrabold text-white">Recov</span>
        </p>
        <div className="mt-5 flex items-center gap-3">
          <ClubLogo name={clubName} url={clubLogoUrl} />
          <p className="min-w-0 truncate text-sm text-nav-text">{clubName}</p>
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
                    <span className="rounded-sm bg-brand px-1.5 py-0.5 text-xs font-semibold text-ink">
                      {pendingCount}
                    </span>
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
        <Avatar name={fullName} url={avatarUrl} onTint />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{fullName}</span>
          <span className="block text-xs font-normal text-nav-text">Perfil</span>
        </span>
      </Link>
    </aside>
  );
}
