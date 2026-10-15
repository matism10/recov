import Link from "next/link";
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
};

// Plantel en celular y tablet: una fila por jugador.
export function SquadList({ players, avatarUrls, phaseByPlayer, canManage }: SquadProps) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl bg-mist border border-line">
      {players.map((p) => {
        const status = p.availability as Availability;
        return (
          <li
            key={p.id}
            className="flex items-center justify-between gap-4 px-5 py-4"
          >
            <div className="flex items-center gap-3">
              <Avatar name={p.full_name} url={p.user_id ? avatarUrls.get(p.user_id) : null} />
              <div>
                <p className="font-medium text-ink">{p.full_name}</p>
                {(p.position || phaseByPlayer.has(p.id)) && (
                  <p className="text-sm text-muted">
                    {[p.position, phaseByPlayer.has(p.id) && `Fase: ${phaseByPlayer.get(p.id)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
            </div>
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
                  Marca lesionado
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
