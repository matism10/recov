import Link from "next/link";
import type { ReactNode } from "react";
import type { SquadPlayer } from "@/lib/squad";

export type SquadProps = {
  players: SquadPlayer[];
  avatarUrls: Map<string, string>;
  phaseByPlayer: Map<string, string>;
  canManage: boolean;
  // El staff abre la ficha del jugador desde su nombre; el jugador no tiene acceso.
  linkToProfile: boolean;
};

// "Marcar lesión" como acción de texto (no botón), con 44 px de alto táctil.
export const markInjuryClass =
  "inline-flex min-h-11 items-center text-sm font-medium whitespace-nowrap text-brand-text underline";

// Avatar y nombre del jugador: enlace a su ficha para el staff, texto para el resto.
export function PlayerIdentity({
  playerId,
  linkToProfile,
  children,
}: {
  playerId: string;
  linkToProfile: boolean;
  children: ReactNode;
}) {
  return linkToProfile ? (
    <Link
      href={`/jugadores/${playerId}`}
      className="group flex items-center gap-3 rounded-lg lg:min-h-11"
    >
      {children}
    </Link>
  ) : (
    <div className="flex items-center gap-3">{children}</div>
  );
}
