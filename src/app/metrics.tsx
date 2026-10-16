// Piezas compartidas de métricas: la franja de /dashboard y la página /metricas.
import type { ReactNode } from "react";
import { formatShortDate, type AvailabilityWeek } from "@/lib/metrics";
import { Users } from "lucide-react";
import { AVAILABILITY_ICON } from "@/app/ui";
import { LineChart, type ChartColor } from "@/app/line-chart";

// Tarjeta de métricas: la misma en la franja de /dashboard y en /metricas.
export const metricCardClass = "rounded-xl border border-line bg-white p-5";

// Tono de la tarjeta: el color fijo del estado que cuenta, o neutro para el total.
// Clases literales: Tailwind solo genera las que aparecen escritas en el código.
const TONES = {
  neutral: { Icon: Users, value: "text-ink", icon: "bg-mist text-ink", bar: "bg-ink" },
  disponible: {
    Icon: AVAILABILITY_ICON.disponible,
    value: "text-disponible",
    icon: "bg-disponible-bg text-disponible",
    bar: "bg-disponible",
  },
  lesionado: {
    Icon: AVAILABILITY_ICON.lesionado,
    value: "text-lesionado",
    icon: "bg-lesionado-bg text-lesionado",
    bar: "bg-lesionado",
  },
  reintegro: {
    Icon: AVAILABILITY_ICON.reintegro,
    value: "text-reintegro",
    icon: "bg-reintegro-bg text-reintegro",
    bar: "bg-reintegro",
  },
} as const;

export type StatTone = keyof typeof TONES;

// Porcentaje del plantel, redondeado; sin plantel no hay porcentaje.
export function percentOf(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

// Tarjeta de cifra: etiqueta e ícono arriba, número grande, barra con la parte
// del plantel y, abajo, qué significa la cifra y su porcentaje.
export function StatCard({
  label,
  value,
  tone = "neutral",
  description,
  percent = null,
  extra,
}: {
  label: string;
  value: number;
  tone?: StatTone;
  description: string;
  percent?: number | null;
  extra?: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div className={`flex flex-col justify-between gap-4 ${metricCardClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
            <span className={`font-display text-5xl leading-none font-extrabold ${t.value}`}>
              {value}
            </span>
            {extra}
          </p>
        </div>
        <span
          aria-hidden="true"
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${t.icon}`}
        >
          <t.Icon className="size-5" />
        </span>
      </div>
      <div className="space-y-3">
        {percent !== null && (
          <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-line/60">
            <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${percent}%` }} />
          </div>
        )}
        <div className="flex items-end justify-between gap-3 text-sm">
          <p className="text-muted">{description}</p>
          {percent !== null && (
            <p className="shrink-0 font-medium text-ink">{percent}% del plantel</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function MetricsError() {
  return <p className="text-sm text-muted">No se pudieron cargar las métricas.</p>;
}

// Bloque de /metricas: título, subtítulo opcional, contenido y pie.
export function MetricsBlock({
  heading,
  subtitle,
  footer,
  children,
}: {
  heading: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={metricCardClass}>
      <h2 className="text-sm font-medium text-muted">{heading}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
      {footer && <p className="mt-4 text-xs text-muted">{footer}</p>}
    </section>
  );
}

export type BarRow = {
  key: string;
  label: string;
  value: number;
  valueLabel: string;
  muted?: boolean; // "Sin dato": barra gris y etiqueta apagada
};

// Barras horizontales en HTML: etiqueta | barra | valor. El ancho es relativo al máximo.
export function BarList({ rows }: { rows: BarRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-sm">
          <span className={`truncate ${r.muted ? "text-muted" : "text-ink"}`}>{r.label}</span>
          <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-line/60">
            <span
              className={`block h-full rounded-full ${r.muted ? "bg-muted/40" : "bg-brand-strong"}`}
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </span>
          <span className="text-right font-medium whitespace-nowrap text-ink">{r.valueLabel}</span>
        </li>
      ))}
    </ul>
  );
}

type AvailabilityKey = "disponible" | "en_revision" | "lesionado" | "reintegro";

const SERIES: Record<AvailabilityKey, { label: string; colorClass: ChartColor }> = {
  disponible: { label: "Disponibles", colorClass: "disponible" },
  en_revision: { label: "En revisión", colorClass: "revision" },
  lesionado: { label: "Lesionados", colorClass: "lesionado" },
  reintegro: { label: "En reintegro", colorClass: "reintegro-fg" },
};

// Con menos semanas que esto, se aclara desde cuándo hay historial.
const SHORT_HISTORY_WEEKS = 3;

// Disponibilidad semana a semana. Una semana cuyas cuatro cifras suman 0 no tiene
// historial (el club aún no registraba): es "sin datos", no cero jugadores.
export function AvailabilityChart({
  weeks,
  keys,
  height,
  heading,
}: {
  weeks: AvailabilityWeek[];
  keys: AvailabilityKey[];
  height?: number;
  heading: string;
}) {
  const hasData = weeks.map(
    (w) => w.disponible + w.en_revision + w.lesionado + w.reintegro > 0,
  );
  const firstWithData = hasData.indexOf(true);
  if (firstWithData < 0) {
    return (
      <>
        <h2 className="mb-3 text-sm font-medium text-muted">{heading}</h2>
        <p className="text-sm text-muted">Sin historial todavía.</p>
      </>
    );
  }
  const weeksWithData = hasData.filter(Boolean).length;
  return (
    <>
      <LineChart
        label={heading}
        height={height}
        xLabels={weeks.map((w) => formatShortDate(w.week_start))}
        series={keys.map((key) => ({
          key,
          ...SERIES[key],
          values: weeks.map((w, i) => (hasData[i] ? w[key] : null)),
        }))}
      />
      {weeksWithData < SHORT_HISTORY_WEEKS && (
        <p className="mt-1 text-xs text-muted">
          El historial empieza el {formatShortDate(weeks[firstWithData].week_start)}
        </p>
      )}
    </>
  );
}
