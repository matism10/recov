import Link from "next/link";
import type { Availability } from "@/lib/roles";
import { Avatar } from "@/app/avatar";
import { AvailabilityBadge } from "@/app/ui";
import { AvailabilitySelect } from "./availability-select";
import { PlayerIdentity, markInjuryClass, type SquadProps } from "./squad-list";

const th = "px-3 py-3 font-medium";
const td = "px-3 py-3";

// Plantel en escritorio (lg+): mismos datos, componentes y reglas por rol que
// SquadList. Quien cambia la disponibilidad necesita las columnas del selector y
// la acción, así que la fase va bajo el nombre (y la posición también, hasta xl).
// Quien solo ve badges tiene espacio para posición y fase en columnas propias.
export function SquadTable({
  players,
  avatarUrls,
  phaseByPlayer,
  canManage,
  linkToProfile,
}: SquadProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-mist">
      <table className="w-full text-left">
        <thead className="text-sm text-muted">
          <tr className="border-b border-line">
            <th scope="col" className={`${th} pl-5`}>
              Jugador
            </th>
            <th scope="col" className={canManage ? `hidden ${th} xl:table-cell` : th}>
              Posición
            </th>
            {!canManage && (
              <th scope="col" className={th}>
                Fase en curso
              </th>
            )}
            <th scope="col" className={canManage ? th : `${th} pr-5`}>
              Disponibilidad
            </th>
            {canManage && (
              <th scope="col" className={`${th} pr-5`}>
                Acción
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {players.map((p) => {
            const status = p.availability as Availability;
            const phase = phaseByPlayer.get(p.id);
            // "En revisión" no se cambia a mano: lo resuelve la revisión de la lesión.
            const editable = canManage && status !== "en_revision";
            return (
              <tr key={p.id}>
                <td className={`${td} pl-5`}>
                  <PlayerIdentity playerId={p.id} linkToProfile={linkToProfile}>
                    <Avatar name={p.full_name} url={p.user_id ? avatarUrls.get(p.user_id) : null} />
                    <div>
                      <p className="font-medium text-ink group-hover:underline">{p.full_name}</p>
                      {canManage && (p.position || phase) && (
                        <p className="text-sm text-muted xl:hidden">
                          {[p.position, phase && `Fase: ${phase}`].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {canManage && phase && (
                        <p className="hidden text-sm text-muted xl:block">Fase: {phase}</p>
                      )}
                    </div>
                  </PlayerIdentity>
                </td>
                <td
                  className={`text-sm text-muted ${canManage ? `hidden ${td} xl:table-cell` : td}`}
                >
                  {p.position}
                </td>
                {!canManage && <td className={`${td} text-sm text-muted`}>{phase}</td>}
                <td className={canManage ? td : `${td} pr-5`}>
                  {editable ? (
                    <div className="inline-block">
                      <AvailabilitySelect
                        playerId={p.id}
                        playerName={p.full_name}
                        value={status}
                      />
                    </div>
                  ) : (
                    <AvailabilityBadge status={status} />
                  )}
                </td>
                {canManage && (
                  <td className={`${td} pr-5`}>
                    {editable && (
                      <Link href={`/lesiones/marcar/${p.id}`} className={markInjuryClass}>
                        Marcar lesión
                      </Link>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
