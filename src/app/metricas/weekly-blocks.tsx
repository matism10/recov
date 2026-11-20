// Métricas → Carga: "Carga del plantel por semana" (barras apiladas por tipo con la carga
// promedio por jugador que respondió, línea punteada con el promedio de las 4 semanas
// anteriores y la semana en curso punteada) y "Bienestar del plantel" (promedio /25,
// 6 barras semanales y los 3 checks más bajos de los últimos 7 días). Datos de
// team_load_weekly y team_wellness_summary (exigen carga_ver en la base).
import Link from "next/link";
import { formatShortDate } from "@/lib/metrics";
import { formatAvg, formatLoad, wellnessItemText, wellnessSeverity } from "@/lib/srpe";
import { pctVs, type TeamLoadWeek, type TeamWellness } from "@/lib/team-weekly";
import { MetricsBlock, MetricsError } from "@/app/metrics";
import { StackedBarChart } from "@/app/stacked-bar-chart";
import { TooltipTarget } from "@/app/chart-tooltip";

// "+12 % sobre el promedio de las 4 anteriores" / "11 % bajo el promedio de las 4 anteriores".
const vsText = (n: number) =>
  n >= 0 ? `+${n} % sobre el promedio de las 4 anteriores` : `${Math.abs(n)} % bajo el promedio de las 4 anteriores`;

export function WeeklyLoadBlock({ weeks }: { weeks: TeamLoadWeek[] | null }) {
  const heading = "Carga del plantel por semana";
  if (!weeks) {
    return (
      <MetricsBlock heading={heading} info="carga_semana">
        <MetricsError />
      </MetricsBlock>
    );
  }
  if (weeks.every((w) => w.responded === 0)) {
    return (
      <MetricsBlock heading={heading} info="carga_semana">
        <p className="text-sm text-muted">Todavía no hay esfuerzos respondidos en las últimas 6 semanas.</p>
      </MetricsBlock>
    );
  }
  const current = weeks.find((w) => w.in_progress) ?? weeks[weeks.length - 1];
  const vs = pctVs(current.avg_load, current.prior_avg);
  const subtitle =
    current.avg_load !== null
      ? `Esta semana (en curso): ${formatLoad(current.avg_load)} por jugador${vs !== null ? ` · ${vsText(vs)}` : ""}`
      : "Promedio por jugador que respondió";
  return (
    <MetricsBlock heading={heading} subtitle={subtitle} info="carga_semana">
      <StackedBarChart
        label={`${heading}, promedio por jugador`}
        height={230}
        formatValue={formatLoad}
        reference={current.prior_avg !== null ? { value: current.prior_avg, label: "Promedio 4 semanas anteriores" } : null}
        series={[
          { key: "cancha", label: "Cancha", fill: "fill-brand-mid", swatch: "bg-brand-mid" },
          { key: "gimnasio", label: "Gimnasio", fill: "fill-brand-text", swatch: "bg-brand-text" },
          { key: "partido", label: "Partido", fill: "fill-alerta", swatch: "bg-alerta" },
        ]}
        columns={weeks.map((w) => {
          const label = formatShortDate(w.week_start);
          if (w.responded === 0) return { label, values: null, dashed: w.in_progress };
          const per = (v: number) => Math.round(v / w.responded);
          const p = pctVs(w.avg_load, w.prior_avg);
          return {
            label,
            dashed: w.in_progress,
            values: { cancha: per(w.cancha), gimnasio: per(w.gimnasio), partido: per(w.partido) },
            tip: {
              title: `Semana del ${label}${w.in_progress ? " (en curso)" : ""}`,
              lines: [
                `${formatLoad(w.avg_load ?? 0)} por jugador${p !== null ? ` · ${vsText(p)}` : ""}`,
                `Cancha ${formatLoad(per(w.cancha))} · Gimnasio ${formatLoad(per(w.gimnasio))} · Partido ${formatLoad(per(w.partido))}`,
                `Respondieron ${w.responded} de ${w.roster}`,
              ],
            },
          };
        })}
      />
    </MetricsBlock>
  );
}

export function TeamWellnessBlock({ data }: { data: TeamWellness | null }) {
  const heading = "Bienestar del plantel";
  if (!data) {
    return (
      <MetricsBlock heading={heading} info="bienestar_plantel">
        <MetricsError />
      </MetricsBlock>
    );
  }
  return (
    <MetricsBlock heading={heading} subtitle="Check de bienestar · 25 = mejor" info="bienestar_plantel">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-display text-4xl font-extrabold text-ink tabular-nums">
            {data.recent_avg !== null ? formatAvg(Number(data.recent_avg)) : "—"}
            <span className="text-base font-semibold text-muted"> / 25</span>
          </p>
          <p className="text-xs text-muted">
            Últimos 7 días · respondieron {data.recent_responded} de {data.roster}
          </p>
        </div>
        <div aria-hidden="true" className="flex h-16 items-end gap-1.5">
          {data.weeks.map((w) => {
            const label = formatShortDate(w.week_start);
            const v = w.avg_total === null ? null : Number(w.avg_total);
            return (
              <TooltipTarget
                key={w.week_start}
                className="flex h-full w-4 items-end"
                tip={{
                  title: `Semana del ${label}${w.in_progress ? " (en curso)" : ""}`,
                  lines: v === null ? ["Sin checks"] : [`Promedio ${formatAvg(v)} / 25`, `Respondieron ${w.responded}`],
                }}
              >
                <span
                  className={`block w-full rounded-sm ${v === null ? "h-0.5 bg-line" : w.in_progress ? "bg-brand/50" : "bg-brand-strong"}`}
                  style={v === null ? undefined : { height: `${Math.max(4, (v / 25) * 100)}%` }}
                />
              </TooltipTarget>
            );
          })}
        </div>
      </div>
      <p className="sr-only">
        Promedio por semana:{" "}
        {data.weeks
          .map((w) => `${formatShortDate(w.week_start)}: ${w.avg_total === null ? "sin checks" : formatAvg(Number(w.avg_total))}`)
          .join(", ")}
        .
      </p>

      <h3 className="mt-5 mb-2 text-sm font-medium text-ink">Los 3 más bajos · últimos 7 días</h3>
      {data.lowest.length === 0 ? (
        <p className="text-sm text-muted">Nadie respondió el check en los últimos 7 días.</p>
      ) : (
        <ul className="divide-y divide-line">
          {data.lowest.map((l) => {
            const bad = l.items.filter((i) => wellnessSeverity(i.stored) === "mal");
            return (
              <li key={l.player_id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <Link href={`/jugadores/${l.player_id}`} className="font-medium text-ink hover:underline">
                    {l.full_name}
                  </Link>
                  <p className={`text-xs ${bad.length ? "text-lesionado-fg" : "text-muted"}`}>
                    {bad.length ? bad.map((i) => wellnessItemText(i.key, i.stored)).join(", ") : "Sin ítems bajos"}
                  </p>
                </div>
                <span className="shrink-0 font-display font-bold text-ink tabular-nums">{l.total} / 25</span>
              </li>
            );
          })}
        </ul>
      )}
    </MetricsBlock>
  );
}
