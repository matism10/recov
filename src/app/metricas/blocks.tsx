// Bloques de la pestaña Lesiones de /metricas (funciones dash_* de 0020 y 0046).
// Cada bloque recibe su propio resultado: si una llamada falla, solo ese bloque
// muestra el error y el resto de la página se renderiza.
import { OCCURRED_DURING_LABEL } from "@/lib/injuries";
import {
  deadlineLabel,
  formatShortDate,
  type AvailabilityWeek,
  type DashSummary,
  type MetricsResult,
  type PlaceCount,
  type PlaceKey,
  type PlayerStatus,
  type PositionCount,
  type RecurringPlayer,
  type UpcomingReturn,
  type WeekCount,
} from "@/lib/metrics";
import { Avatar } from "@/app/avatar";
import { BarChart } from "@/app/bar-chart";
import { BarList, MetricsBlock, MetricsError, metricCardClass, percentOf } from "@/app/metrics";
import { StackedBarChart } from "@/app/stacked-bar-chart";
import { TooltipTarget } from "@/app/chart-tooltip";
import { InfoBox } from "@/app/info-box";
import { AVAILABILITY_ICON, AvailabilityBadge, SectionTitle } from "@/app/ui";

const MAX_POSITIONS = 10; // en dos columnas: 5 y 5
const UPCOMING_VISIBLE = 4;

const PLACE_LABEL: Record<PlaceKey, string> = {
  ...OCCURRED_DURING_LABEL,
  sin_dato: "Sin dato",
};
const PLACE_ORDER: PlaceKey[] = ["entrenamiento", "competencia", "externo", "sin_dato"];

function injuriesLabel(n: number) {
  return n === 1 ? "1 lesión" : `${n} lesiones`;
}

function percent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

// a) Lesiones nuevas por semana
export function InjuriesByWeekBlock({ result }: { result: MetricsResult<WeekCount[]> }) {
  const heading = "Lesiones nuevas por semana";
  if (!result.ok) {
    return (
      <MetricsBlock heading={heading}>
        <MetricsError />
      </MetricsBlock>
    );
  }
  const weeks = result.data;
  const total = weeks.reduce((sum, w) => sum + w.injuries_count, 0);
  return (
    <MetricsBlock heading={heading} info="lesiones_semana" footer={`${injuriesLabel(total)} en ${weeks.length} semanas`}>
      <BarChart
        valueText={injuriesLabel}
        label={heading}
        values={weeks.map((w) => w.injuries_count)}
        xLabels={weeks.map((w) => formatShortDate(w.week_start))}
        highlightIndex={weeks.length - 1}
      />
    </MetricsBlock>
  );
}

// b) Lugar de la lesión
export function InjuriesByPlaceBlock({ result }: { result: MetricsResult<PlaceCount[]> }) {
  const heading = "Lugar de la lesión";
  if (!result.ok) {
    return (
      <MetricsBlock heading={heading}>
        <MetricsError />
      </MetricsBlock>
    );
  }
  const counts = new Map(result.data.map((p) => [p.place_key, p.injuries_count]));
  const total = PLACE_ORDER.reduce((sum, k) => sum + (counts.get(k) ?? 0), 0);
  if (total === 0) {
    return (
      <MetricsBlock heading={heading}>
        <p className="text-sm text-muted">Sin lesiones en los últimos 12 meses.</p>
      </MetricsBlock>
    );
  }
  return (
    <MetricsBlock heading={heading} info="lugar" footer={`Últimos 12 meses · ${injuriesLabel(total)}`}>
      <BarList
        rows={PLACE_ORDER.filter((key) => key !== "sin_dato" || (counts.get(key) ?? 0) > 0).map((key) => {
          const value = counts.get(key) ?? 0;
          return {
            key,
            label: PLACE_LABEL[key],
            value,
            valueLabel: `${value} · ${percent(value, total)}%`,
            tip: { title: PLACE_LABEL[key], lines: [`${injuriesLabel(value)} · ${percent(value, total)} % del total`] },
            muted: key === "sin_dato",
          };
        })}
      />
    </MetricsBlock>
  );
}

// c) Lesiones por posición
export function InjuriesByPositionBlock({ result }: { result: MetricsResult<PositionCount[]> }) {
  const heading = "Lesiones por posición";
  if (!result.ok) {
    return (
      <MetricsBlock heading={heading}>
        <MetricsError />
      </MetricsBlock>
    );
  }
  const rows = [...result.data]
    .sort((a, b) => b.injuries_count - a.injuries_count || a.position_name.localeCompare(b.position_name))
    .slice(0, MAX_POSITIONS);
  return (
    <MetricsBlock heading={heading} info="posicion" subtitle="Últimos 12 meses">
      {rows.length > 0 ? (
        <BarList
          columns={2}
          rows={rows.map((p) => ({
            key: p.position_name,
            label: p.position_name,
            value: p.injuries_count,
            valueLabel: `${p.injuries_count} · ${p.players_count} jug.`,
            tip: {
              title: p.position_name,
              lines: [injuriesLabel(p.injuries_count), p.players_count === 1 ? "1 jugador" : `${p.players_count} jugadores`],
            },
          }))}
        />
      ) : (
        <p className="text-sm text-muted">Sin lesiones en los últimos 12 meses.</p>
      )}
    </MetricsBlock>
  );
}

// d) Jugadores recurrentes
export function RecurringPlayersBlock({
  result,
  status,
  avatarUrls,
}: {
  result: MetricsResult<RecurringPlayer[]>;
  status: Map<string, PlayerStatus> | null;
  avatarUrls: Map<string, string>;
}) {
  const heading = "Jugadores recurrentes";
  const subtitle = "2 o más lesiones en 12 meses";
  if (!result.ok) {
    return (
      <MetricsBlock heading={heading} subtitle={subtitle}>
        <MetricsError />
      </MetricsBlock>
    );
  }
  return (
    <MetricsBlock heading={heading} subtitle={subtitle} info="recurrentes">
      {result.data.length > 0 ? (
        <ul className="divide-y divide-line">
          {result.data.map((p) => {
            const userId = status?.get(p.player_id)?.user_id;
            return (
              <li key={p.player_id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={p.full_name} url={userId ? avatarUrls.get(userId) : null} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{p.full_name}</p>
                    <p className="text-sm text-muted">
                      {p.position_name} · última {formatShortDate(p.last_injury_on)}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    p.injuries_count >= 3
                      ? "bg-lesionado-bg text-lesionado-fg"
                      : "bg-revision-bg text-revision-fg"
                  }`}
                >
                  {p.injuries_count} lesiones
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nadie con 2 o más lesiones en 12 meses.</p>
      )}
    </MetricsBlock>
  );
}

// e) Próximas altas estimadas: vencidas primero (resaltadas) y luego por fecha. Compacta:
// 4 filas y "Ver las N altas" para el resto (<details>, sin JS).
export function UpcomingReturnsBlock({
  result,
  status,
  avatarUrls,
}: {
  result: MetricsResult<UpcomingReturn[]>;
  status: Map<string, PlayerStatus> | null;
  avatarUrls: Map<string, string>;
}) {
  const heading = "Próximas altas estimadas";
  const subtitle = "Próximos 30 días";
  if (!result.ok) {
    return (
      <MetricsBlock heading={heading} subtitle={subtitle} info="altas">
        <MetricsError />
      </MetricsBlock>
    );
  }
  const rows = [...result.data].sort(
    (a, b) =>
      Number(b.days_left < 0) - Number(a.days_left < 0) ||
      a.return_on.localeCompare(b.return_on) ||
      a.full_name.localeCompare(b.full_name),
  );
  if (rows.length === 0) {
    return (
      <MetricsBlock heading={heading} subtitle={subtitle} info="altas">
        <p className="text-sm text-muted">Sin altas estimadas en los próximos 30 días.</p>
      </MetricsBlock>
    );
  }
  const overdue = rows.filter((r) => r.days_left < 0).length;
  const row = (r: UpcomingReturn) => {
    const late = r.days_left < 0;
    const s = status?.get(r.player_id);
    return (
      <li
        key={r.injury_id}
        className={`flex items-center gap-3 rounded-lg px-2 py-2.5 ${late ? "bg-revision-bg/60" : ""}`}
      >
        <Avatar name={r.full_name} url={s?.user_id ? avatarUrls.get(s.user_id) : null} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">{r.full_name}</p>
          <p className="text-sm text-muted">
            {formatShortDate(r.return_on)} ·{" "}
            <span className={late ? "font-medium text-revision-fg" : ""}>{deadlineLabel(r.days_left)}</span>
          </p>
        </div>
        {s && <AvailabilityBadge status={s.availability} />}
      </li>
    );
  };
  return (
    <MetricsBlock
      heading={heading}
      subtitle={overdue > 0 ? `${subtitle} · ${overdue === 1 ? "1 vencida" : `${overdue} vencidas`}` : subtitle}
      info="altas"
    >
      <ul className="-mx-2 space-y-1">{rows.slice(0, UPCOMING_VISIBLE).map(row)}</ul>
      {rows.length > UPCOMING_VISIBLE && (
        <details className="group mt-2">
          <summary className="cursor-pointer list-none text-sm font-medium text-brand-text hover:underline [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Ver las {rows.length} altas</span>
            <span className="hidden group-open:inline">Ver menos</span>
          </summary>
          <ul className="-mx-2 mt-2 space-y-1">{rows.slice(UPCOMING_VISIBLE).map(row)}</ul>
        </details>
      )}
    </MetricsBlock>
  );
}

// Franja de estado: una sola tarjeta con Disponibles (n y %), Lesionados (+N en revisión),
// En reintegro y el total, sobre una barra proporcional con los colores de siempre.
export function StatusStrip({ result }: { result: MetricsResult<DashSummary> }) {
  if (!result.ok) {
    return (
      <section className={metricCardClass}>
        <MetricsError />
      </section>
    );
  }
  const d = result.data;
  const segments = [
    { key: "disponible", label: "Disponibles", value: d.disponibles, bar: "bg-disponible" },
    { key: "lesionado", label: "Lesionados", value: d.lesionados, bar: "bg-lesionado" },
    { key: "en_revision", label: "En revisión", value: d.en_revision, bar: "bg-revision" },
    { key: "reintegro", label: "En reintegro", value: d.reintegro, bar: "bg-reintegro" },
  ];
  const DispIcon = AVAILABILITY_ICON.disponible;
  const LesIcon = AVAILABILITY_ICON.lesionado;
  const ReiIcon = AVAILABILITY_ICON.reintegro;
  const pct = (n: number) => percentOf(n, d.total);
  return (
    <section className={metricCardClass} aria-labelledby="estado-plantel">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <SectionTitle>
          <span id="estado-plantel">Estado del plantel hoy</span>
        </SectionTitle>
        <p className="text-sm text-muted">
          <span className="font-semibold text-ink tabular-nums">{d.total}</span> {d.total === 1 ? "jugador" : "jugadores"}
        </p>
      </div>
      <div className="mt-1.5">
        <InfoBox topic="estado" />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <dt className="flex items-center gap-1.5 text-sm text-muted">
            <DispIcon aria-hidden="true" className="size-4 text-disponible" />
            Disponibles
          </dt>
          <dd className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
            <span className="font-display text-3xl font-extrabold text-disponible tabular-nums sm:text-4xl">{d.disponibles}</span>
            {pct(d.disponibles) !== null && <span className="text-sm font-medium text-ink">{pct(d.disponibles)} %</span>}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-sm text-muted">
            <LesIcon aria-hidden="true" className="size-4 text-lesionado" />
            Lesionados
          </dt>
          <dd className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
            <span className="font-display text-3xl font-extrabold text-lesionado tabular-nums sm:text-4xl">{d.lesionados}</span>
            {d.en_revision > 0 && (
              <span className="text-sm font-medium text-revision-fg">+{d.en_revision} en revisión</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-sm text-muted">
            <ReiIcon aria-hidden="true" className="size-4 text-reintegro" />
            En reintegro
          </dt>
          <dd className="mt-1 font-display text-3xl font-extrabold text-reintegro tabular-nums sm:text-4xl">{d.reintegro}</dd>
        </div>
      </dl>
      {d.total > 0 && (
        <div aria-hidden="true" className="mt-4 flex h-3 gap-0.5 overflow-visible rounded-full">
          {segments
            .filter((x) => x.value > 0)
            .map((x) => (
              <TooltipTarget
                key={x.key}
                tip={{ title: x.label, lines: [`${x.value} de ${d.total} · ${pct(x.value)} %`] }}
                className={`h-full first:rounded-l-full last:rounded-r-full ${x.bar}`}
                style={{ flexGrow: x.value, flexBasis: 0 }}
              />
            ))}
        </div>
      )}
    </section>
  );
}

// "Jugadores no disponibles por semana": barras apiladas de 12 semanas (lesionados, en
// revisión y en reintegro; los disponibles no se dibujan). Mismos datos que la serie de
// disponibilidad (dash_availability_series); una semana en 0 en las cuatro cifras no
// tiene historial y queda vacía.
export function UnavailableWeeksBlock({
  result,
  summary,
}: {
  result: MetricsResult<AvailabilityWeek[]>;
  summary: MetricsResult<DashSummary>;
}) {
  const heading = "Jugadores no disponibles por semana";
  const today = summary.ok
    ? `Hoy ${summary.data.lesionados + summary.data.en_revision + summary.data.reintegro} de ${summary.data.total}`
    : undefined;
  if (!result.ok) {
    return (
      <MetricsBlock heading={heading} subtitle={today} info="no_disponibles">
        <MetricsError />
      </MetricsBlock>
    );
  }
  const weeks = result.data;
  const hasData = weeks.map((w) => w.disponible + w.en_revision + w.lesionado + w.reintegro > 0);
  const firstWithData = hasData.indexOf(true);
  if (firstWithData < 0) {
    return (
      <MetricsBlock heading={heading} subtitle={today} info="no_disponibles">
        <p className="text-sm text-muted">Sin historial todavía.</p>
      </MetricsBlock>
    );
  }
  const weeksWithData = hasData.filter(Boolean).length;
  return (
    <MetricsBlock
      heading={heading}
      subtitle={today}
      info="no_disponibles"
      footer={weeksWithData < 3 ? `El historial empieza el ${formatShortDate(weeks[firstWithData].week_start)}` : undefined}
    >
      <StackedBarChart
        label={heading}
        height={240}
        series={[
          { key: "lesionado", label: "Lesionados", fill: "fill-lesionado", swatch: "bg-lesionado" },
          { key: "en_revision", label: "En revisión", fill: "fill-revision", swatch: "bg-revision" },
          { key: "reintegro", label: "En reintegro", fill: "fill-reintegro", swatch: "bg-reintegro" },
        ]}
        columns={weeks.map((w, i) => {
          const label = formatShortDate(w.week_start);
          if (!hasData[i]) return { label, values: null };
          const out = w.lesionado + w.en_revision + w.reintegro;
          const all = out + w.disponible;
          return {
            label,
            values: { lesionado: w.lesionado, en_revision: w.en_revision, reintegro: w.reintegro },
            tip: {
              title: `Semana del ${label}`,
              lines: [
                `No disponibles: ${out} de ${all}`,
                `Lesionados ${w.lesionado} · En revisión ${w.en_revision} · En reintegro ${w.reintegro}`,
              ],
            },
          };
        })}
      />
    </MetricsBlock>
  );
}
