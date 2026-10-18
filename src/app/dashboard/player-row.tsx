import Link from "next/link";
import type { Availability } from "@/lib/roles";
import type { SquadPlayer } from "@/lib/squad";
import { Avatar } from "@/app/avatar";
import { AvailabilityBadge } from "@/app/ui";
import { AvailabilitySelect } from "./availability-select";
import { PlayerIdentity, markInjuryClass, type SquadProps } from "./squad-list";

// Franja de 4 px a la izquierda de la fila, con el color de su estado.
const STRIPE: Record<Availability, string> = {
  disponible: "bg-disponible",
  en_revision: "bg-revision",
  lesionado: "bg-lesionado",
  reintegro: "bg-reintegro",
};

// Fila de jugador del Plantel: franja de estado, avatar de 40 px, nombre 17/600,
// posición y fase en 14 y, a la derecha, el badge o (para quien gestiona lesiones)
// el selector de disponibilidad y "Marcar lesión". Mismas acciones que antes.
export function PlayerRow({
  player: p,
  avatarUrl,
  phase,
  canManage,
  linkToProfile,
}: {
  player: SquadPlayer;
  avatarUrl: string | null | undefined;
  phase: string | undefined;
  canManage: boolean;
  linkToProfile: boolean;
}) {
  const status = p.availability as Availability;
  // "En revisión" no se cambia a mano: lo resuelve la revisión de la lesión.
  const editable = canManage && status !== "en_revision";
  return (
    <li className="relative overflow-hidden rounded-xl bg-mist">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${STRIPE[status]}`} />
      <div className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 py-3 pr-4 pl-5">
        <div className="min-w-0 flex-1">
          <PlayerIdentity playerId={p.id} linkToProfile={linkToProfile}>
            <Avatar name={p.full_name} url={avatarUrl} size="md" />
            <div className="min-w-0">
              <p className="text-[17px] leading-6 font-semibold break-words text-ink group-hover:underline">
                {p.full_name}
              </p>
              {(p.position || phase) && (
                <p className="text-sm text-muted">{[p.position, phase].filter(Boolean).join(" · ")}</p>
              )}
            </div>
          </PlayerIdentity>
        </div>
        {editable ? (
          // Móvil: en su propia línea, alineado con el nombre. Escritorio: a la derecha.
          <div className="flex w-full items-center justify-between gap-4 pl-[52px] lg:w-auto lg:pl-0">
            <AvailabilitySelect playerId={p.id} playerName={p.full_name} value={status} />
            <Link href={`/lesiones/marcar/${p.id}`} className={markInjuryClass}>
              Marcar lesión
            </Link>
          </div>
        ) : (
          <AvailabilityBadge status={status} />
        )}
      </div>
    </li>
  );
}

// Lista de filas de jugador: la usan el Plantel y el Resumen.
export function PlayerRows({
  players,
  avatarUrls,
  phaseByPlayer,
  canManage,
  linkToProfile,
}: SquadProps) {
  return (
    <ul className="space-y-2">
      {players.map((p) => (
        <PlayerRow
          key={p.id}
          player={p}
          avatarUrl={p.user_id ? avatarUrls.get(p.user_id) : null}
          phase={phaseByPlayer.get(p.id)}
          canManage={canManage}
          linkToProfile={linkToProfile}
        />
      ))}
    </ul>
  );
}
