"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Check, ChevronDown, Clock } from "lucide-react";
import type { ClubIdentity } from "@/lib/club-identity";
import type { ClubOption } from "@/lib/club-options";
import { Avatar } from "@/app/avatar";
import { isNavHidden } from "@/app/nav-items";
import { setActiveClub } from "@/app/plantel-activo";

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
  identity: { name: string; logoUrl: string | null };
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
  clubs = [],
}: {
  identity: ClubIdentity;
  coverUrl: string | null;
  fullName: string;
  avatarUrl: string | null;
  clubs?: ClubOption[];
}) {
  const subtitle = [identity.sportLabel, identity.category].filter(Boolean).join(" · ");
  return (
    <header
      data-club-hero={coverUrl ? "" : undefined}
      className={`relative h-[calc(96px+env(safe-area-inset-top))] w-full shrink-0 bg-ink lg:h-32 ${
        coverUrl ? "" : "[&:has(+[data-club-hero])]:hidden"
      }`}
    >
      {/* La foto y el degradado se recortan aparte: el selector de plantel se abre
          por debajo del encabezado y no debe quedar cortado. */}
      <div className="absolute inset-0 overflow-hidden">
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
      </div>
      {/* En escritorio el perfil va abajo en la sidebar. */}
      <div className="absolute top-[calc(env(safe-area-inset-top)+8px)] right-3 lg:hidden">
        <ProfileLink fullName={fullName} avatarUrl={avatarUrl} ring />
      </div>
      <div className="absolute bottom-4 left-4 flex min-w-0 items-center gap-3 pr-4 lg:left-8">
        <ClubShield
          identity={identity}
          className="size-12 text-lg ring-[1.6px] ring-white lg:size-14 lg:text-xl"
        />
        <ClubSwitcher clubs={clubs} tone="dark">
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
        </ClubSwitcher>
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
  clubs,
}: {
  identity: ClubIdentity;
  fullName: string;
  avatarUrl: string | null;
  clubs: ClubOption[];
}) {
  const pathname = usePathname();
  if (isNavHidden(pathname)) return null;
  const subtitle = [identity.sportLabel, identity.category].filter(Boolean).join(" · ");

  if (pathname === "/dashboard" && identity.coverPath) {
    return (
      <ClubHero identity={identity} coverUrl={null} fullName={fullName} avatarUrl={avatarUrl} clubs={clubs} />
    );
  }

  return (
    // Área segura arriba (app instalada): si iOS deja el contenido bajo la barra de
    // estado, el encabezado baja lo justo; si no, el margen es 0 y nada cambia.
    <header className="flex h-[calc(3.5rem+env(safe-area-inset-top))] w-full items-center justify-between gap-3 bg-white px-4 pt-[env(safe-area-inset-top)] lg:h-16 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <ClubShield identity={identity} className="size-10 text-sm" />
        <ClubSwitcher clubs={clubs} tone="light">
          <div className="min-w-0">
            <p className="truncate font-display text-xl leading-[22px] font-bold text-ink">
              {identity.name}
            </p>
            {subtitle && <p className="truncate text-sm leading-4 text-[#475569]">{subtitle}</p>}
          </div>
        </ClubSwitcher>
      </div>
      <span className="lg:hidden">
        <ProfileLink fullName={fullName} avatarUrl={avatarUrl} />
      </span>
    </header>
  );
}

// Al cambiar de plantel, una ficha (jugador, lesión, evento) del plantel anterior
// ya no existe en el nuevo: se vuelve a la lista de esa sección.
const DETAIL_ROOTS: [prefix: string, root: string][] = [
  ["/jugadores/", "/plantel"],
  ["/lesiones/", "/lesiones"],
  ["/calendario/", "/calendario"],
];

// Selector de plantel: el nombre del plantel se vuelve un botón que abre la lista
// de planteles de la cuenta. Solo aparece con 2 o más; con uno, el encabezado queda
// como siempre. Los pendientes se ven, pero no se pueden elegir.
function ClubSwitcher({
  clubs,
  tone,
  children,
}: {
  clubs: ClubOption[];
  tone: "light" | "dark";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (clubs.length < 2) return <>{children}</>;

  const choose = (club: ClubOption) => {
    if (club.active || club.pending) {
      setOpen(false);
      return;
    }
    setError(false);
    startTransition(async () => {
      const { ok } = await setActiveClub(club.clubId);
      if (!ok) {
        setError(true);
        return;
      }
      setOpen(false);
      const root = DETAIL_ROOTS.find(([prefix]) => pathname.startsWith(prefix))?.[1];
      if (root) router.replace(root);
      router.refresh();
    });
  };

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={`flex min-h-11 min-w-0 items-center gap-1.5 rounded-lg pr-1 text-left ${
          tone === "dark" ? "text-white" : "text-ink"
        }`}
      >
        {children}
        <ChevronDown
          aria-hidden="true"
          className={`size-5 shrink-0 transition ${open ? "rotate-180" : ""}`}
        />
        <span className="sr-only">Cambiar de plantel</span>
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute top-full left-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-line bg-white p-2 shadow-lg"
        >
          <p className="px-3 pt-1 pb-2 text-xs font-semibold tracking-wide text-muted uppercase">
            Tus planteles
          </p>
          <ul className="space-y-1">
            {clubs.map((club) => (
              <li key={club.clubId}>
                <button
                  type="button"
                  disabled={club.pending || isPending}
                  aria-current={club.active ? "true" : undefined}
                  onClick={() => choose(club)}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                    club.active ? "bg-brand-soft" : club.pending ? "cursor-not-allowed" : "hover:bg-mist"
                  }`}
                >
                  <ClubShield identity={club} className="size-9 text-xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{club.name}</span>
                    {club.pending ? (
                      <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-mist px-2 py-0.5 text-xs font-medium text-muted ring-1 ring-line">
                        <Clock aria-hidden="true" className="size-3.5" />
                        Pendiente
                      </span>
                    ) : (
                      <span className="block truncate text-sm text-muted">{club.roleLabel}</span>
                    )}
                  </span>
                  {club.active && (
                    <Check aria-label="Plantel activo" className="size-5 shrink-0 text-brand-strong" />
                  )}
                </button>
              </li>
            ))}
          </ul>
          {error && (
            <p role="alert" className="px-3 pt-2 text-sm text-ink">
              No pudimos cambiar de plantel. Recarga la página e intenta de nuevo.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
