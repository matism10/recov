// Gráfico de barras en SVG, renderizado en el servidor (sin JS en el cliente).
// Misma técnica que LineChart: trazado en un viewBox 0–100 estirado al ancho
// disponible y etiquetas en HTML para que se lean igual en cualquier ancho.

const PLOT_PADDING_PX = 32; // pt-2 + pb-6 del contenedor del trazado
const ZERO_BAR_PX = 2; // una semana en 0 se ve como una línea, no desaparece
const BAR_WIDTH = 0.6; // fracción del espacio de cada barra

// Máximo del eje y: par, para que la guía central también sea un entero.
function axisMax(values: number[]) {
  const max = Math.max(0, ...values);
  return Math.max(2, max % 2 === 0 ? max : max + 1);
}

export function BarChart({
  values,
  xLabels,
  label,
  highlightIndex,
  height = 200,
}: {
  values: number[];
  xLabels: string[];
  label: string;
  highlightIndex?: number;
  height?: number;
}) {
  const n = values.length;
  const max = axisMax(values);
  const plotHeight = height - PLOT_PADDING_PX;
  const slot = 100 / Math.max(n, 1);
  const center = (i: number) => slot * (i + 0.5);
  const y = (v: number) => 100 - (v / max) * 100;
  const minHeight = (ZERO_BAR_PX / plotHeight) * 100;
  const total = values.reduce((sum, v) => sum + v, 0);
  const xTicks = [...new Set([0, Math.floor((n - 1) / 2), n - 1])].filter((i) => i >= 0);

  return (
    <div>
      <div
        role="img"
        aria-label={`${label}: ${total} en ${n} semanas; la última semana, ${values[n - 1] ?? 0}.`}
        className="relative pt-2 pb-6 pl-7"
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
              className="absolute top-full mt-1.5 -translate-x-1/2 text-xs whitespace-nowrap text-muted"
              style={{ left: `${center(i)}%` }}
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
            {values.map((v, i) => {
              const barHeight = Math.max(100 - y(v), minHeight);
              return (
                <rect
                  key={i}
                  x={center(i) - (slot * BAR_WIDTH) / 2}
                  width={slot * BAR_WIDTH}
                  y={100 - barHeight}
                  height={barHeight}
                  className={i === highlightIndex ? "fill-brand" : "fill-brand-strong"}
                >
                  <title>{`Semana del ${xLabels[i]}: ${v}`}</title>
                </rect>
              );
            })}
          </svg>
        </div>
      </div>

      {/* La tabla va dentro de un div: una tabla no se encoge a 1px y empujaría el ancho. */}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Semana</th>
              <th scope="col">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {xLabels.map((week, i) => (
              <tr key={week}>
                <th scope="row">{week}</th>
                <td>{values[i]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
