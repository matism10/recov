"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ClubIdentity } from "@/lib/club-identity";
import { Avatar } from "@/app/avatar";
import { isNavHidden } from "@/app/nav-items";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w[0] ?? ""))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

// Escudo del club: la imagen si existe; si no, las iniciales en un cuadrado tinta.
function ClubShield({
  identity,
  className,
}: {
  identity: ClubIdentity;
  className: string;
}) {
  return (
    <span
      role="img"
      aria-label={`Escudo de ${identity.name}`}
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink font-display font-bold text-white ${className}`}
    >
      {identity.logoUrl ? (
        // Archivo público: no pasa por next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={identity.logoUrl} alt="" className="h-full w-full bg-white object-contain p-1" />
      ) : (
        <span aria-hidden="true">{initials(identity.name)}</span>
      )}
    </span>
  );
}

function ProfileLink({
  fullName,
  avatarUrl,
  ring = false,
}: {
  fullName: string;
  avatarUrl: string | null;
  ring?: boolean;
}) {
  return (
    <Link
      href="/perfil"
      aria-label="Tu perfil"
      className="flex size-11 shrink-0 items-center justify-center rounded-full"
    >
      <span className={`rounded-full ${ring ? "ring-2 ring-white" : ""}`}>
        <Avatar name={fullName} url={avatarUrl} />
      </span>
    </Link>
  );
}

// Encabezado con la identidad del club (en vez del logo de Recov), en celular y
// escritorio. El avatar del perfil va solo en celular (en escritorio está en la
// sidebar). "hero": portada con degradado, solo en el Resumen y si hay portada.
// "compact": barra blanca, en el resto. Respeta HIDDEN_ON.
export function ClubHeader({
  identity,
  fullName,
  avatarUrl,
}: {
  identity: ClubIdentity;
  fullName: string;
  avatarUrl: string | null;
}) {
  const pathname = usePathname();
  if (isNavHidden(pathname)) return null;
  const subtitle = [identity.sportLabel, identity.category].filter(Boolean).join(" · ");

  if (pathname === "/dashboard" && identity.coverUrl) {
    return (
      <header className="relative h-[calc(96px+env(safe-area-inset-top))] w-full overflow-hidden bg-ink lg:h-32">
        <Image
          src={identity.coverUrl}
          alt={`Portada de ${identity.name}`}
          fill
          priority
          // La portada del club es una URL firmada de Storage: sin optimizar.
          unoptimized={!identity.coverUrl.startsWith("/")}
          sizes="(min-width: 1024px) calc(100vw - 15rem), 100vw"
          className="object-cover object-[50%_22%]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(11,23,38,.90) 0%, rgba(11,23,38,.78) 55%, rgba(11,23,38,.35) 100%)",
          }}
        />
        {/* En escritorio el perfil va abajo en la sidebar. */}
        <div className="absolute top-[calc(env(safe-area-inset-top)+8px)] right-3 lg:hidden">
          <ProfileLink fullName={fullName} avatarUrl={avatarUrl} ring />
        </div>
        <div className="absolute bottom-4 left-4 flex min-w-0 items-center gap-3 pr-4 lg:left-8">
          <ClubShield
            identity={identity}
            className="size-12 text-lg ring-[1.6px] ring-white lg:size-14 lg:text-xl"
          />
          <div className="min-w-0">
            <p className="truncate font-display text-2xl leading-7 font-bold text-white lg:text-[28px] lg:leading-8">
              {identity.name}
            </p>
            {subtitle && (
              <p className="truncate text-sm leading-[18px] text-[#e2e8f0] lg:text-[15px] lg:leading-5">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="flex h-14 w-full items-center justify-between gap-3 bg-white px-4 lg:h-16 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <ClubShield identity={identity} className="size-10 text-sm" />
        <div className="min-w-0">
          <p className="truncate font-display text-xl leading-[22px] font-bold text-ink">
            {identity.name}
          </p>
          {subtitle && <p className="truncate text-sm leading-4 text-[#475569]">{subtitle}</p>}
        </div>
      </div>
      <span className="lg:hidden">
        <ProfileLink fullName={fullName} avatarUrl={avatarUrl} />
      </span>
    </header>
  );
}
