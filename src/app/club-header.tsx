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
        // Logo público de Storage: no pasa por next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={identity.logoUrl}
          alt=""
          // El cuadro mide 40 a 56 px según dónde vaya; el CSS manda, esto solo reserva espacio.
          width={56}
          height={56}
          decoding="async"
          className="h-full w-full bg-white object-contain p-1"
        />
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

// Portada del Resumen: foto con degradado, escudo, nombre y deporte · categoría.
// La firma la página del Resumen (no el layout, para no firmarla en cada pantalla).
// Sin `coverUrl` es el marco que pone el layout mientras carga el Resumen: fondo
// tinta sin foto, y se oculta solo en cuanto la página pone la portada justo después.
export function ClubHero({
  identity,
  coverUrl,
  fullName,
  avatarUrl,
}: {
  identity: ClubIdentity;
  coverUrl: string | null;
  fullName: string;
  avatarUrl: string | null;
}) {
  const subtitle = [identity.sportLabel, identity.category].filter(Boolean).join(" · ");
  return (
    <header
      data-club-hero={coverUrl ? "" : undefined}
      className={`relative h-[calc(96px+env(safe-area-inset-top))] w-full shrink-0 overflow-hidden bg-ink lg:h-32 ${
        coverUrl ? "" : "[&:has(+[data-club-hero])]:hidden"
      }`}
    >
      {coverUrl && (
        <Image
          src={coverUrl}
          alt={`Portada de ${identity.name}`}
          fill
          priority
          // Foto privada por /foto: el optimizador de Next la pediría sin la sesión de
          // quien mira, así que va sin optimizar (ya se sube a 1600 px como máximo).
          unoptimized
          sizes="(min-width: 1024px) calc(100vw - 15rem), 100vw"
          className="object-cover"
          style={{
            objectPosition: `${identity.coverPosition.x}% ${identity.coverPosition.y}%`,
          }}
        />
      )}
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

// Encabezado con la identidad del club (en vez del logo de Recov), en celular y
// escritorio. El avatar del perfil va solo en celular (en escritorio está en la
// sidebar). En el Resumen, si hay portada, va el marco de la portada (ClubHero sin
// foto) hasta que la página pone la suya; en el resto, la barra blanca. Respeta HIDDEN_ON.
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

  if (pathname === "/dashboard" && identity.coverPath) {
    return <ClubHero identity={identity} coverUrl={null} fullName={fullName} avatarUrl={avatarUrl} />;
  }

  return (
    // Área segura arriba (app instalada): si iOS deja el contenido bajo la barra de
    // estado, el encabezado baja lo justo; si no, el margen es 0 y nada cambia.
    <header className="flex h-[calc(3.5rem+env(safe-area-inset-top))] w-full items-center justify-between gap-3 bg-white px-4 pt-[env(safe-area-inset-top)] lg:h-16 lg:px-8">
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
