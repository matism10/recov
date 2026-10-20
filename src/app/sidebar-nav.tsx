"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/app/avatar";
import { REGISTROS, isNavHidden, sidebarItems, startsWith, type NavItem } from "@/app/nav-items";
import recovLogo from "@/app/recov-logo.png";

// Sidebar en el celeste suave de marca (Sky 100): la marca Recov arriba, la
// navegación y el perfil abajo. La identidad del club va en el encabezado
// (ClubHeader). El ítem activo lleva una barra izquierda de 3 px en celeste de marca.
const itemClass = (active: boolean) =>
  `relative flex min-h-11 items-center gap-3 px-4 text-sm text-ink transition ${
    active
      ? "font-semibold before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r-sm before:bg-brand before:content-['']"
      : "font-medium hover:bg-white/60"
  }`;

export function SidebarNav({
  fullName,
  avatarUrl,
  direction,
  staff,
  pendingCount,
}: {
  fullName: string;
  avatarUrl: string | null;
  direction: boolean;
  staff: boolean;
  pendingCount: number;
}) {
  const pathname = usePathname();
  if (isNavHidden(pathname)) return null;

  const items = sidebarItems({ direction, staff });
  const profileActive = startsWith(pathname, "/perfil");

  const renderItem = (item: NavItem) => {
    const active = item.isActive(pathname);
    return (
      <li key={item.href}>
        <Link href={item.href} aria-current={active ? "page" : undefined} className={itemClass(active)}>
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
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-brand/40 bg-brand-soft py-6 lg:flex">
      <Link href="/dashboard" className="flex min-h-11 items-center gap-3 px-4">
        {/* Decorativo: el nombre del enlace lo da el wordmark. */}
        <Image src={recovLogo} alt="" width={36} height={36} className="size-9 shrink-0" />
        <span className="font-display text-xl leading-tight font-extrabold text-ink">Recov</span>
      </Link>

      <nav aria-label="Principal" className="mt-8 flex-1 space-y-5">
        <ul className="space-y-1">{items.main.map(renderItem)}</ul>
        {items.admin.length > 0 && (
          <div>
            <p className="mb-1 px-4 text-xs font-semibold tracking-wide text-muted uppercase">
              Club
            </p>
            <ul className="space-y-1 border-t border-brand/40 pt-2">{items.admin.map(renderItem)}</ul>
          </div>
        )}
      </nav>

      <Link
        href="/perfil"
        aria-current={profileActive ? "page" : undefined}
        className={`${itemClass(profileActive)} py-2`}
      >
        <Avatar name={fullName} url={avatarUrl} onTint />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{fullName}</span>
          <span className="block text-xs font-normal text-muted">Perfil</span>
        </span>
      </Link>
    </aside>
  );
}
