// Piezas de Evaluaciones que se renderizan en el servidor: cambio desde la evaluación
// anterior, ranking del plantel y gráfico de progreso. Sin JS en el cliente.
import { ArrowDown, ArrowUp, Equal } from "lucide-react";
import { ListRow, TableCard } from "@/app/ui-blocks";
import { changeFrom, formatNumber, formatValue, type TestDefinition } from "@/lib/evaluations";

// Cambio con ícono y texto (no solo color): "▲ +10 kg · mejor".
export function ChangeBadge({
  current,
  previous,
  test,
}: {
  current: number;
  previous: number | null;
  test: TestDefinition;
}) {
  const change = changeFrom(current, previous, test);
  if (!change) return <span className="text-xs text-muted">Primera evaluación</span>;
  const Icon = change.delta > 0 ? ArrowUp : change.delta < 0 ? ArrowDown : Equal;
  const tone =
    change.verdict === "mejor"
      ? "text-disponible-fg"
      : change.verdict === "peor"
        ? "text-lesionado-fg"
        : "text-muted";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap ${tone}`}>
      <Icon aria-hidden="true" className="size-3.5" />
      {change.verdict === "igual" ? "Sin cambio" : `${change.label} · ${change.verdict}`}
    </span>
  );
}

export type RankingRow = {
  player_id: string;
  full_name: string;
  value: number;
  measured_on: string;
  previous_value: number | null;
};

const shortDate = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "UTC" });
export function shortDateLabel(isoDate: string) {
  return shortDate.format(new Date(`${isoDate}T00:00:00Z`)).replace(/\./g, "");
}

// Ranking del plantel: posición, nombre, barra relativa al mejor y cambio.
export function Ranking({
  rows,
  test,
  highlightPlayerId,
}: {
  rows: RankingRow[];
  test: TestDefinition;
  highlightPlayerId?: string | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-card p-6 text-center text-sm text-muted">
        Aún no hay resultados de {test.name}.
      </p>
    );
  }
  const values = rows.map((r) => Number(r.value));
  const best = test.higher_is_better ? Math.max(...values) : Math.min(...values);
  // Barra: el mejor llena el ancho; el resto, en proporción (en tiempos, mejor = menor).
  const width = (v: number) => Math.max(4, Math.round((test.higher_is_better ? v / best : best / v) * 100));
  const cols = "lg:grid-cols-[2rem_minmax(0,1.4fr)_minmax(0,2fr)_6rem_11rem]";
  return (
    <TableCard
      columns={cols}
      head={
        <>
          <span>#</span>
          <span>Jugador</span>
          <span>Comparado con el mejor</span>
          <span>Resultado</span>
          <span>Cambio</span>
        </>
      }
    >
      {rows.map((r, i) => {
        const value = Number(r.value);
        const mine = r.player_id === highlightPlayerId;
        return (
          <ListRow key={r.player_id} columns={cols} className={`flex-wrap py-3 ${mine ? "bg-brand-soft" : ""}`}>
            <span className="w-6 shrink-0 text-right text-sm font-semibold text-muted tabular-nums lg:order-1 lg:w-auto lg:text-left">{i + 1}</span>
            <div className="min-w-0 flex-1 lg:order-2">
              <p className="truncate text-15 font-semibold text-ink">
                {r.full_name}
                {mine && <span className="font-normal text-muted"> (tú)</span>}
              </p>
              <p className="text-13 text-muted">{shortDateLabel(r.measured_on)}</p>
            </div>
            <span className="shrink-0 font-semibold text-ink tabular-nums lg:order-4">{formatValue(value, test)}</span>
            <div className="flex basis-full items-center gap-3 pl-9 lg:contents">
              <span aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-mist ring-1 ring-line lg:order-3">
                <span
                  className={`block h-full rounded-full ${mine ? "bg-brand-strong" : "bg-brand"}`}
                  style={{ width: `${width(value)}%` }}
                />
              </span>
              <span className="shrink-0 text-right lg:order-5 lg:text-left">
                <ChangeBadge current={value} previous={r.previous_value === null ? null : Number(r.previous_value)} test={test} />
              </span>
            </div>
          </ListRow>
        );
      })}
    </TableCard>
  );
}

export type ProgressPoint = { measured_on: string; value: number };

// Progreso de un jugador en un test: puntos unidos, eje con el rango real de valores.
export function ProgressChart({ points, test, height = 180 }: { points: ProgressPoint[]; test: TestDefinition; height?: number }) {
  if (points.length === 0) {
    return <p className="text-sm text-muted">Sin resultados de {test.name} todavía.</p>;
  }
  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const pad = (hi - lo || Math.max(hi * 0.1, 1)) * 0.15;
  lo = Math.max(0, lo - pad);
  hi = hi + pad;
  const n = points.length;
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => 100 - ((v - lo) / (hi - lo)) * 100;
  const path = points.map((p, i) => `${i ? "L" : "M"} ${x(i)} ${y(p.value)}`).join(" ");
  const last = points[n - 1];
  const summary = `${test.name}: ${points.map((p) => `${shortDateLabel(p.measured_on)} ${formatValue(p.value, test)}`).join(", ")}`;
  return (
    <div role="img" aria-label={summary} className="relative pt-8 pr-3 pb-6 pl-12" style={{ height }}>
      <div aria-hidden="true" className="relative h-full">
        {[hi, (hi + lo) / 2, lo].map((v, k) => (
          <span key={k} className="absolute right-full mr-2 -translate-y-1/2 text-xs text-muted tabular-nums" style={{ top: `${y(v)}%` }}>
            {formatNumber(v, test.display_format)}
          </span>
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          {[0, 50, 100].map((g) => (
            <line key={g} x1="0" x2="100" y1={g} y2={g} className="stroke-line" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={path} fill="none" className="stroke-brand-strong" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        {points.map((p, i) => (
          <span
            key={p.measured_on}
            className={`absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white ${i === n - 1 ? "bg-brand-strong" : "bg-brand"}`}
            style={{ left: `${x(i)}%`, top: `${y(p.value)}%` }}
          />
        ))}
        <span
          className="absolute -translate-y-full pb-2 text-xs font-semibold whitespace-nowrap text-ink"
          style={{ left: `${x(n - 1)}%`, top: `${y(last.value)}%`, transform: `translate(${n === 1 ? "-50%" : "-100%"}, -100%)` }}
        >
          {formatValue(last.value, test)}
        </span>
        {[...new Set([0, n - 1])].map((i) => (
          <span
            key={i}
            className="absolute top-full mt-1.5 text-xs whitespace-nowrap text-muted"
            style={{ left: `${x(i)}%`, transform: `translateX(${i === 0 && n > 1 ? "0" : i === n - 1 && n > 1 ? "-100%" : "-50%"})` }}
          >
            {shortDateLabel(points[i].measured_on)}
          </span>
        ))}
      </div>
    </div>
  );
}
