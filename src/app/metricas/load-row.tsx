// Fila de minutos de un jugador (Métricas → "Minutos jugados" y /metricas/carga): posición
// en el ranking, nombre (a su ficha), mini barras de los últimos partidos (con el dato de
// cada partido al pasar el mouse o tocar) y el total de la ventana. Sin semáforo.
import Link from "next/link";
import { totalLabel, type LoadMatch, type LoadScaleRow, type NominaMode, type PlayerLoad } from "@/lib/match-load";
import { LoadMiniBars, matchDateLabel, valueText } from "@/app/load-chart";
import { TooltipTarget } from "@/app/chart-tooltip";

export function LoadRow({
  player: p,
  rank,
  mode,
  matchMinutes,
  matchesCount,
  matches,
  scale,
}: {
  player: PlayerLoad;
  rank?: number;
  mode: NominaMode;
  matchMinutes: number;
  matchesCount: number;
  matches: LoadMatch[];
  scale: LoadScaleRow[];
}) {
  const byId = new Map(matches.map((m) => [m.event_id, m]));
  return (
    <li className="flex items-center gap-3 py-2.5">
      {rank !== undefined && <span className="w-5 shrink-0 text-right text-xs text-muted tabular-nums">{rank}</span>}
      <Link
        href={`/jugadores/${p.player_id}`}
        className="min-w-0 flex-1 truncate font-medium text-ink hover:underline"
      >
        {p.full_name}
      </Link>
      <TooltipTarget
        className="shrink-0"
        tip={{
          title: p.full_name,
          lines: p.values.map((v) => {
            const m = byId.get(v.event_id);
            return `${m ? matchDateLabel(m.starts_at) : "Partido"}${m?.opponent ? ` vs ${m.opponent}` : ""}: ${valueText(v, mode, scale)}`;
          }),
        }}
      >
        <LoadMiniBars values={p.values} mode={mode} matchMinutes={matchMinutes} label={`Últimos partidos de ${p.full_name}`} />
      </TooltipTarget>
      <span className="w-16 shrink-0 text-right text-sm font-semibold text-ink tabular-nums sm:w-20">
        {totalLabel(mode, p.total, matchesCount)}
      </span>
    </li>
  );
}
