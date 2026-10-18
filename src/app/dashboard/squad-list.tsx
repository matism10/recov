import Link from "next/link";
import type { ReactNode } from "react";
import type { Availability } from "@/lib/roles";
import type { SquadPlayer } from "@/lib/squad";
import { Avatar } from "@/app/avatar";
import { AvailabilityBadge } from "@/app/ui";
import { AvailabilitySelect } from "./availability-select";


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

// Plantel en celular y tablet: una fila por jugador.
export function SquadList({
  players,
  avatarUrls,
  phaseByPlayer,
  canManage,
  linkToProfile,
}: SquadProps) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl bg-mist border border-line">
      {players.map((p) => {
        const status = p.availability as Availability;
        // "En revisión" no se cambia a mano: lo resuelve la revisión de la lesión.
        const editable = canManage && status !== "en_revision";
        return (
          <li key={p.id} className="space-y-2 px-5 py-4">
            {/* Línea 1: el nombre. Línea 2, en gris: posición y fase en curso. */}
            <div className="flex items-center justify-between gap-3">
              <PlayerIdentity playerId={p.id} linkToProfile={linkToProfile}>
                <Avatar name={p.full_name} url={p.user_id ? avatarUrls.get(p.user_id) : null} />
                <div className="min-w-0">
                  <p className="font-medium text-ink group-hover:underline">{p.full_name}</p>
                  {(p.position || phaseByPlayer.has(p.id)) && (
                    <p className="text-sm text-muted">
                      {[p.position, phaseByPlayer.get(p.id)].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </PlayerIdentity>
              {!editable && <AvailabilityBadge status={status} />}
            </div>
            {/* Selector y "Marcar lesión" en su propia línea, alineados con el nombre. */}
            {editable && (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pl-12">
                <AvailabilitySelect playerId={p.id} playerName={p.full_name} value={status} />
                <Link href={`/lesiones/marcar/${p.id}`} className={markInjuryClass}>
                  Marcar lesión
                </Link>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
