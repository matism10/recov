"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/app/avatar";
import { ClubLogo } from "@/app/club-logo";
import { REGISTROS, isNavHidden, sidebarItems, startsWith } from "@/app/nav-items";

// Sidebar en el celeste suave de marca (Sky 100): texto e íconos en ink.
// El ítem activo va en blanco para destacarse sobre el celeste.
const itemClass = (active: boolean) =>
  `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-ink transition ${
    active ? "bg-white shadow-sm" : "hover:bg-white/60"
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
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-brand/40 bg-brand-soft px-3 py-6 lg:flex">
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
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        active ? "bg-brand-soft text-brand-text" : "bg-white text-brand-text"
                      }`}
                    >
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
          <span className="block text-xs font-normal text-muted">Perfil</span>
        </span>
      </Link>
    </aside>
  );
}
