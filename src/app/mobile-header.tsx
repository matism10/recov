"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/app/avatar";
import { isNavHidden } from "@/app/nav-items";
import recovMark from "@/app/recov-mark.png";

// Encabezado móvil (oculto desde lg, donde la sidebar muestra lo mismo): la figura
// de la R (sin el cuadrado) y el wordmark de Recov con el club debajo, y el avatar
// que lleva al perfil.
export function MobileHeaderBar({
  clubName,
  fullName,
  avatarUrl,
}: {
  clubName: string;
  fullName: string;
  avatarUrl: string | null;
}) {
  const pathname = usePathname();
  if (isNavHidden(pathname)) return null;

  return (
    <header className="flex items-center justify-between gap-3 bg-white px-4 pt-4 lg:hidden">
      <Link href="/dashboard" className="flex min-h-11 min-w-0 items-center gap-3 rounded-xl">
        {/* Decorativo: el nombre del enlace lo da el wordmark. */}
        <Image src={recovMark} alt="" width={30} height={31} className="h-[31px] w-[30px] shrink-0" />
        <span className="min-w-0">
          <span className="block font-display text-[22px] leading-6 font-extrabold text-ink">
            Recov
          </span>
          <span className="block truncate text-sm text-muted">{clubName}</span>
        </span>
      </Link>
      <Link
        href="/perfil"
        aria-label="Tu perfil"
        className="flex size-11 shrink-0 items-center justify-center rounded-full"
      >
        <Avatar name={fullName} url={avatarUrl} />
      </Link>
    </header>
  );
}
