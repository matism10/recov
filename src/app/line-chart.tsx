// Gráfico de líneas en SVG, renderizado en el servidor (sin JS en el cliente).
// El trazado usa un viewBox 0–100 estirado al ancho disponible, con trazos que no
// se deforman; las etiquetas van en HTML para que se lean igual en cualquier ancho.

// Clases literales (Tailwind solo genera las que aparecen escritas en el código).
const COLORS = {
  disponible: { stroke: "stroke-disponible", bg: "bg-disponible", text: "text-disponible-fg" },
  revision: { stroke: "stroke-revision", bg: "bg-revision", text: "text-revision-fg" },
  lesionado: { stroke: "stroke-lesionado", bg: "bg-lesionado", text: "text-lesionado-fg" },
  "reintegro-fg": { stroke: "stroke-reintegro-fg", bg: "bg-reintegro-fg", text: "text-reintegro-fg" },
} as const;

export type ChartColor = keyof typeof COLORS;

// Orden de dibujo de los puntos: el último queda encima si coinciden.
const DOT_ORDER: ChartColor[] = ["lesionado", "reintegro-fg", "revision", "disponible"];

export type LineSeries = {
  key: string;
  label: string;
  colorClass: ChartColor;
  values: (number | null)[];
};

const PLOT_PADDING_PX = 32; // pt-2 + pb-6 del contenedor del trazado
const LABEL_GAP_PX = 12; // separación mínima entre etiquetas de último valor
const DOT_DIAMETER = 8; // radio 4

// Máximo del eje y: par, para que la guía central también sea un entero.
function axisMax(series: LineSeries[]) {
  const max = Math.max(0, ...series.flatMap((s) => s.values.filter((v): v is number => v !== null)));
  return Math.max(2, max % 2 === 0 ? max : max + 1);
}

// Tramos continuos de la serie: un null corta la línea.
function segments(values: (number | null)[], x: (i: number) => number, y: (v: number) => number) {
  const paths: string[] = [];
  let current: string[] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (current.length) paths.push(current.join(" "));
      current = [];
    } else {
      current.push(`${current.length ? "L" : "M"} ${x(i)} ${y(v)}`);
    }
  });
  if (current.length) paths.push(current.join(" "));
  return paths;
}

function lastIndex(values: (number | null)[]) {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] !== null) return i;
  return -1;
}

// Separa verticalmente etiquetas ordenadas por altura, sin salirse del trazado.
function dodge(positions: number[], gap: number, max: number) {
  const out = [...positions];
  for (let k = 1; k < out.length; k++) out[k] = Math.max(out[k], out[k - 1] + gap);
  if (out.length && out[out.length - 1] > max) {
    out[out.length - 1] = max;
    for (let k = out.length - 2; k >= 0; k--) out[k] = Math.min(out[k], out[k + 1] - gap);
  }
  return out;
}

export function LineChart({
  series,
  xLabels,
  height = 200,
  label,
}: {
  series: LineSeries[];
  xLabels: string[];
  height?: number;
  label: string;
}) {
  const n = xLabels.length;
  const max = axisMax(series);
  const x = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => 100 - (v / max) * 100;
  const plotHeight = height - PLOT_PADDING_PX;

  // Etiquetas del último valor de cada serie, ordenadas por altura y separadas.
  const lastLabels = series
    .map((s) => {
      const i = lastIndex(s.values);
      if (i < 0) return null;
      const value = s.values[i] as number;
      return { key: s.key, color: COLORS[s.colorClass].text, i, value, px: (y(value) / 100) * plotHeight };
    })
    .filter((l) => l !== null)
    .sort((a, b) => a.px - b.px);
  const dodged = dodge(
    lastLabels.map((l) => l.px),
    LABEL_GAP_PX,
    plotHeight + LABEL_GAP_PX / 2,
  );
  lastLabels.forEach((l, k) => (l.px = dodged[k]));

  const summary = series
    .map((s) => {
      const i = lastIndex(s.values);
      return i < 0 ? `${s.label}: sin datos` : `${s.label}: ${s.values[i]}`;
    })
    .join(", ");
  const xTicks = [...new Set([0, Math.floor((n - 1) / 2), n - 1])].filter((i) => i >= 0);
  const dotSeries = [...series].sort(
    (a, b) => DOT_ORDER.indexOf(a.colorClass) - DOT_ORDER.indexOf(b.colorClass),
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-medium text-muted">{label}</h2>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`size-2.5 rounded-full ${COLORS[s.colorClass].bg}`} />
              {s.label}
            </li>
          ))}
        </ul>
      </div>

      <div
        role="img"
        aria-label={`${label}. Última semana con datos: ${summary}.`}
        className="relative pt-2 pr-8 pb-6 pl-7"
        style={{ height }}
      >
        <div aria-hidden="true" className="relative h-full">
          {[0, max / 2, max].map((v) => (
            <span
              key={v}
              className="absolute right-full mr-2 -translate-y-1/2 text-xs text-muted"
              style={{ top: `${y(v)}%` }}
            >
              {v}
            </span>
          ))}
          {xTicks.map((i) => (
            <span
              key={i}
              className={`absolute top-full mt-1.5 text-xs whitespace-nowrap text-muted ${
                n <= 1 ? "-translate-x-1/2" : i === 0 ? "" : i === n - 1 ? "-translate-x-full" : "-translate-x-1/2"
              }`}
              style={{ left: `${x(i)}%` }}
            >
              {xLabels[i]}
            </span>
          ))}

          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
          >
            {[0, max / 2, max].map((v) => (
              <line
                key={v}
                x1="0"
                x2="100"
                y1={y(v)}
                y2={y(v)}
                className="stroke-line"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {series.map((s) => (
              <g key={s.key} className={COLORS[s.colorClass].stroke} fill="none">
                {segments(s.values, x, y).map((d) => (
                  <path
                    key={d}
                    d={d}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </g>
            ))}
            {/* Puntos después de las líneas. Un trazo de largo cero con extremo redondo
                dibuja un punto que no se deforma; solo el último dato queda visible,
                el resto es un área invisible con su <title>. */}
            {dotSeries.map((s) => (
              <g key={s.key} className={COLORS[s.colorClass].stroke} fill="none">
                {s.values.map((v, i) => {
                  if (v === null) return null;
                  const isLast = i === lastIndex(s.values);
                  return (
                    <path
                      key={i}
                      d={`M ${x(i)} ${y(v)} Z`}
                      strokeWidth={isLast ? DOT_DIAMETER : 12}
                      strokeLinecap="round"
                      strokeOpacity={isLast ? 1 : 0}
                      vectorEffect="non-scaling-stroke"
                    >
                      <title>{`${s.label}, semana del ${xLabels[i]}: ${v}`}</title>
                    </path>
                  );
                })}
              </g>
            ))}
          </svg>

          {lastLabels.map((l) => (
            <span
              key={l.key}
              className={`absolute ml-2 -translate-y-1/2 text-xs font-medium ${l.color}`}
              style={{ left: `${x(l.i)}%`, top: `${l.px}px` }}
            >
              {l.value}
            </span>
          ))}
        </div>
      </div>

      {/* La tabla va dentro de un div: una tabla no se encoge a 1px y empujaría el ancho. */}
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
            </tr>
          </thead>
          <tbody>
            {xLabels.map((week, i) => (
              <tr key={week}>
                <th scope="row">{week}</th>
                {series.map((s) => (
                  <td key={s.key}>{s.values[i] ?? "Sin datos"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
