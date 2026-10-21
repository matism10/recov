// Fila de carga de un jugador: posición en el ranking, nombre (a su ficha), mini
// barras de los últimos partidos, total de la ventana y estado del semáforo. La
// usan el ranking y las listas del resumen (carga alta y sin minutos).
import Link from "next/link";
import {
  LOAD_STATUS_LABEL,
  LOAD_STATUS_STYLE,
  totalLabel,
  type NominaMode,
  type PlayerLoad,
} from "@/lib/match-load";
import { LoadMiniBars } from "@/app/load-chart";

export function LoadRow({
  player: p,
  rank,
  mode,
  matchMinutes,
  matchesCount,
}: {
  player: PlayerLoad;
  rank: number;
  mode: NominaMode;
  matchMinutes: number;
  matchesCount: number;
}) {
  return (
    // Celular: nombre arriba (completo) y barras, total y estado abajo.
    // Desde sm: todo en una línea.
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
      <span className="w-5 shrink-0 text-right text-xs text-muted tabular-nums">{rank}</span>
      <Link
        href={`/jugadores/${p.player_id}`}
        className="min-w-0 flex-1 truncate font-medium text-ink hover:underline"
      >
        {p.full_name}
      </Link>
      <div className="flex w-full items-center gap-3 pl-8 sm:w-auto sm:pl-0">
        <LoadMiniBars
          values={p.values}
          mode={mode}
          matchMinutes={matchMinutes}
          label={`Últimos partidos de ${p.full_name}`}
        />
        <span className="ml-auto w-16 shrink-0 text-right text-sm font-semibold text-ink tabular-nums sm:ml-0 sm:w-20">
          {totalLabel(mode, p.total, matchesCount)}
        </span>
        <span className="w-24 shrink-0 text-right">{p.status && <StatusChip status={p.status} />}</span>
      </div>
    </li>
  );
}

export function StatusChip({ status }: { status: NonNullable<PlayerLoad["status"]> }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${LOAD_STATUS_STYLE[status]}`}
    >
      {LOAD_STATUS_LABEL[status]}
    </span>
  );
}
