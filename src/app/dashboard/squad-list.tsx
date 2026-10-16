import Link from "next/link";
import type { ReactNode } from "react";
import type { Availability } from "@/lib/roles";
import { Avatar } from "@/app/avatar";
import { AvailabilityBadge, buttonSecondary } from "@/app/ui";
import { AvailabilitySelect } from "./availability-select";

export type SquadPlayer = {
  id: string;
  full_name: string;
  position: string | null;
  availability: string;
  user_id: string | null;
};

export type SquadProps = {
  players: SquadPlayer[];
  avatarUrls: Map<string, string>;
  phaseByPlayer: Map<string, string>;
  canManage: boolean;
  // El staff abre la ficha del jugador desde su nombre; el jugador no tiene acceso.
  linkToProfile: boolean;
};

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
      className="group flex items-center gap-3 rounded-lg"
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
        return (
          <li
            key={p.id}
            className="flex items-center justify-between gap-4 px-5 py-4"
          >
            <PlayerIdentity playerId={p.id} linkToProfile={linkToProfile}>
              <Avatar name={p.full_name} url={p.user_id ? avatarUrls.get(p.user_id) : null} />
              <div>
                <p className="font-medium text-ink group-hover:underline">{p.full_name}</p>
                {(p.position || phaseByPlayer.has(p.id)) && (
                  <p className="text-sm text-muted">
                    {[p.position, phaseByPlayer.has(p.id) && `Fase: ${phaseByPlayer.get(p.id)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
            </PlayerIdentity>
            {/* "En revisión" no se cambia a mano: lo resuelve la revisión de la lesión. */}
            {canManage && status !== "en_revision" ? (
              <div className="flex flex-wrap items-center justify-end gap-3">
                <AvailabilitySelect
                  playerId={p.id}
                  playerName={p.full_name}
                  value={status}
                />
                <Link
                  href={`/lesiones/marcar/${p.id}`}
                  className={`text-sm ${buttonSecondary}`}
                >
                  Marcar lesión
                </Link>
              </div>
            ) : (
              <AvailabilityBadge status={status} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
