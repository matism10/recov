// Bloque "Carga" (ficha del jugador, staff) y "Mi carga" (el propio jugador):
// últimos partidos, carga de la ventana y comparación con el promedio del plantel.
// Sin semáforo: las etiquetas de alta o baja solo están en Métricas.
import { CircleAlert } from "lucide-react";
import { formatDate } from "@/lib/injuries";
import {
  totalLabel,
  type LoadMatch,
  type LoadScaleRow,
  type NominaMode,
  type PlayerLoad,
} from "@/lib/match-load";
import { LoadChart } from "@/app/load-chart";
import { SectionTitle, cardClass } from "@/app/ui";

type LoadData = {
  mode: NominaMode;
  match_minutes: number;
  matches_count: number;
  scale: LoadScaleRow[];
  matches: LoadMatch[];
  reference: number | null;
};

export function LoadBlock({
  title,
  load,
  player,
  lastInjury,
  error = false,
}: {
  title: string;
  load: LoadData | null;
  player: PlayerLoad | null;
  lastInjury?: { type: string; startedOn: string } | null;
  error?: boolean;
}) {
  return (
    <section>
      <SectionTitle className="mb-3">{title}</SectionTitle>
      <div className={`space-y-4 p-5 ${cardClass}`}>
        {error || !load ? (
          <p className="text-sm text-muted">No se pudo cargar la carga de partidos.</p>
        ) : load.matches_count === 0 || !player ? (
          <p className="text-sm text-muted">Aún no hay partidos con participación cargada.</p>
        ) : (
          <LoadContent load={load} player={player} />
        )}
        {lastInjury !== undefined && (
          <p className="border-t border-line pt-3 text-sm text-muted">
            Última lesión:{" "}
            {lastInjury ? (
              <span className="text-ink">
                {lastInjury.type} · {formatDate(lastInjury.startedOn)}
              </span>
            ) : (
              <span className="text-ink">sin lesiones registradas</span>
            )}
          </p>
        )}
      </div>
    </section>
  );
}

function LoadContent({ load, player }: { load: LoadData; player: PlayerLoad }) {
  const n = load.matches_count;
  const reference = load.reference;
  const averagePerMatch = reference !== null && n > 0 ? reference / n : null;
  const diff =
    load.mode !== "jugo" && reference && reference > 0
      ? Math.round(((player.total - reference) / reference) * 100)
      : null;

  return (
    <>
      <LoadChart
        matches={load.matches}
        values={player.values}
        mode={load.mode}
        matchMinutes={load.match_minutes}
        scale={load.scale}
        averagePerMatch={load.mode === "exacto" ? averagePerMatch : null}
      />
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-[13px] text-muted">
            {load.mode === "jugo" ? "Partidos jugados" : "Carga"} de los últimos {n}{" "}
            {n === 1 ? "partido" : "partidos"}
          </dt>
          <dd className="mt-0.5 text-2xl font-bold text-ink tabular-nums">
            {totalLabel(load.mode, player.total, n)}
          </dd>
        </div>
        {load.mode !== "jugo" && reference !== null && (
          <div>
            <dt className="text-[13px] text-muted">Promedio del plantel</dt>
            <dd className="mt-0.5 text-ink">
              <span className="text-2xl font-bold tabular-nums">
                {totalLabel(load.mode, reference, n)}
              </span>
              {diff !== null && diff !== 0 && (
                <span className="ml-2 text-sm text-muted">
                  ({diff > 0 ? `+${diff}` : diff} %)
                </span>
              )}
            </dd>
          </div>
        )}
      </dl>
      {player.other_mode > 0 && (
        <p className="flex items-start gap-1.5 text-sm text-muted">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {player.other_mode === 1
            ? "1 partido cargado en otro modo no cuenta en los minutos."
            : `${player.other_mode} partidos cargados en otro modo no cuentan en los minutos.`}
        </p>
      )}
      {load.mode === "rango" && (
        <p className="text-xs text-muted">
          En rango, los minutos se estiman con el punto medio de cada rango.
        </p>
      )}
    </>
  );
}
