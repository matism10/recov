// Barras apiladas en SVG, renderizadas en el servidor (misma técnica que BarChart: viewBox
// 0–100 estirado y etiquetas en HTML). Cada columna es una semana; una columna `null` no
// tiene datos (se deja vacía, no se dibuja como cero). Opcional: una línea de referencia
// punteada y columnas "en curso" (semitransparentes con borde punteado). Encima,
// ChartColumnsTooltip muestra el dato exacto; debajo, una tabla sr-only.
import { ChartColumnsTooltip, type TooltipContent } from "@/app/chart-tooltip";

const BAR_WIDTH = 0.6;

export type StackSeries = {
  key: string;
  label: string;
  fill: string; // clase literal de relleno, p. ej. "fill-lesionado"
  swatch: string; // clase literal de fondo para la leyenda, p. ej. "bg-lesionado"
};

export type StackColumn = {
  label: string; // "9 nov"
  values: Record<string, number> | null;
  tip?: TooltipContent | null;
  dashed?: boolean; // semana en curso
  hatched?: string; // semana de parón: franja rayada índigo con este rótulo ("Parón")
};

// Máximo "redondo" del eje, con la guía central también entera: 2, 4… 10, 12, 14, 16, 20, 30…
function niceMax(max: number) {
  if (max <= 2) return 2;
  if (max <= 10) return max % 2 === 0 ? max : max + 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 1.2, 1.4, 1.6, 2, 3, 4, 5, 6, 8, 10]) if (Math.round(m * pow) >= max) return Math.round(m * pow);
  return 10 * pow;
}

export function StackedBarChart({
  series,
  columns,
  label,
  height = 220,
  reference,
  formatValue = (v) => String(v),
  showTotals = false,
  allLabels = false,
}: {
  series: StackSeries[];
  columns: StackColumn[];
  label: string;
  height?: number;
  reference?: { value: number; label: string } | null;
  formatValue?: (v: number) => string;
  // Total sobre cada barra, el rótulo de la referencia sobre su línea y todas las
  // etiquetas del eje X (por defecto solo la primera, la del medio y la última).
  showTotals?: boolean;
  allLabels?: boolean;
}) {
  const n = columns.length;
  const totals = columns.map((c) => (c.values ? series.reduce((s, x) => s + (c.values![x.key] ?? 0), 0) : 0));
  const max = niceMax(Math.max(0, ...totals, reference?.value ?? 0));
  const slot = 100 / Math.max(n, 1);
  const center = (i: number) => slot * (i + 0.5);
  const y = (v: number) => 100 - (v / max) * 100;
  const xTicks = allLabels
    ? columns.map((_, i) => i)
    : [...new Set([0, Math.floor((n - 1) / 2), n - 1])].filter((i) => i >= 0);
  const defaultTip = (c: StackColumn, i: number): TooltipContent | null =>
    c.values
      ? {
          title: `Semana del ${c.label}`,
          lines: [...series.map((s) => `${s.label}: ${formatValue(c.values![s.key] ?? 0)}`), `Total: ${formatValue(totals[i])}`],
        }
      : null;

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted" aria-hidden="true">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-sm ${s.swatch}`} />
            {s.label}
          </li>
        ))}
        {reference && !showTotals && (
          <li className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-ink/60" />
            {reference.label}
          </li>
        )}
      </ul>
      <div
        role="img"
        aria-label={`${label}. Última semana: ${formatValue(totals[n - 1] ?? 0)}.`}
        className="relative pt-2 pb-6 pl-9"
        style={{ height }}
      >
        <div aria-hidden="true" className="relative h-full">
          {[0, max / 2, max].map((v) => (
            <span
              key={v}
              className="absolute right-full mr-2 -translate-y-1/2 text-xs whitespace-nowrap text-muted"
              style={{ top: `${y(v)}%` }}
            >
              {formatValue(v)}
            </span>
          ))}
          {xTicks.map((i) => (
            <span
              key={i}
              className="absolute top-full mt-1.5 -translate-x-1/2 text-xs whitespace-nowrap text-muted"
              style={{ left: `${center(i)}%` }}
            >
              {columns[i].label}
            </span>
          ))}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
            {[0, max / 2, max].map((v) => (
              <line key={v} x1="0" x2="100" y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            {columns.map((c, i) => {
              if (!c.values) return null;
              const x = center(i) - (slot * BAR_WIDTH) / 2;
              let base = 0;
              return (
                <g key={i} opacity={c.dashed ? 0.55 : 1}>
                  {series.map((s) => {
                    const v = c.values![s.key] ?? 0;
                    if (v <= 0) return null;
                    const top = base + v;
                    const rect = (
                      <rect key={s.key} x={x} width={slot * BAR_WIDTH} y={y(top)} height={y(base) - y(top)} className={s.fill} />
                    );
                    base = top;
                    return rect;
                  })}
                  {c.dashed && totals[i] > 0 && (
                    <rect
                      x={x}
                      width={slot * BAR_WIDTH}
                      y={y(totals[i])}
                      height={100 - y(totals[i])}
                      fill="none"
                      className="stroke-ink"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </g>
              );
            })}
            {reference && (
              <line
                x1="0"
                x2="100"
                y1={y(reference.value)}
                y2={y(reference.value)}
                className="stroke-ink/60"
                strokeWidth="1.5"
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
          {columns.map((c, i) =>
            c.hatched ? (
              <div
                key={`h${i}`}
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 flex items-start justify-center rounded-sm pt-1"
                style={{
                  left: `${center(i) - (slot * BAR_WIDTH) / 2}%`,
                  width: `${slot * BAR_WIDTH}%`,
                  background:
                    "repeating-linear-gradient(135deg, var(--color-paron-bg) 0 5px, transparent 5px 10px)",
                }}
              >
                <span className="rounded bg-card px-1 text-xs font-semibold text-paron-fg">{c.hatched}</span>
              </div>
            ) : null,
          )}
          {showTotals &&
            columns.map((c, i) =>
              c.values && totals[i] > 0 ? (
                <span
                  key={`t${i}`}
                  aria-hidden="true"
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-full pb-0.5 text-xs font-semibold text-ink tabular-nums"
                  style={{ left: `${center(i)}%`, top: `${y(totals[i])}%` }}
                >
                  {formatValue(totals[i])}
                </span>
              ) : null,
            )}
          {showTotals && reference && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-0 -translate-y-full bg-card pl-1 text-xs text-muted"
              style={{ top: `${y(reference.value)}%` }}
            >
              {reference.label}
            </span>
          )}
          <ChartColumnsTooltip tips={columns.map((c, i) => (c.tip !== undefined ? c.tip : defaultTip(c, i)))} />
        </div>
      </div>
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Semana</th>
              {series.map((s) => (
                <th key={s.key} scope="col">
                  {s.label}
                </th>
              ))}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((c, i) => (
              <tr key={c.label}>
                <th scope="row">
                  {c.label}
                  {c.dashed ? " (en curso)" : ""}
                </th>
                {series.map((s) => (
                  <td key={s.key}>{c.values ? formatValue(c.values[s.key] ?? 0) : "Sin datos"}</td>
                ))}
                <td>{c.values ? formatValue(totals[i]) : "Sin datos"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
