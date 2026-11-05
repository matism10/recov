// Carga semanal sRPE (ficha del jugador, staff): 6 semanas en barras, la actual en
// naranjo si es "Carga alta", línea punteada con el promedio de las 4 semanas
// anteriores y las sesiones de la semana. También el bienestar reciente del jugador.
// Solo presentación: los cálculos vienen de player_weekly_load.
import { CircleAlert } from "lucide-react";
import { EVENT_TYPE_LABEL, chileDateTime, WEEKDAY_LABELS } from "@/lib/events";
import { cardClass } from "@/app/ui";
import {
  WELLNESS_ITEMS,
  dayLabel,
  formatLoad,
  isoWeekday,
  type WeeklyLoad,
  type WellnessReport,
} from "@/lib/srpe";

const CHART_PX = 96;

export function SrpeLoad({ data }: { data: WeeklyLoad | null }) {
  if (!data) {
    return <p className={`p-5 text-sm text-muted ${cardClass}`}>No se pudo cargar la carga semanal.</p>;
  }
  const weeks = data.weeks;
  const hasData = weeks.some((w) => w.sessions > 0);
  const max = Math.max(1, ...weeks.map((w) => w.load), data.baseline ?? 0);
  const comparable = data.prior_weeks >= 3 && data.baseline !== null && data.baseline > 0;
  const pct = data.pct_over;

  return (
    <div className={`space-y-4 p-5 ${cardClass}`}>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-muted">Esta semana (esfuerzo × minutos)</span>
          {data.high_load && (
            <span className="rounded-full bg-alerta-bg px-2.5 py-1 text-xs font-semibold text-alerta-fg">
              Carga alta
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-display text-4xl font-extrabold text-ink tabular-nums">
            {formatLoad(data.current_load)}
          </span>
          {comparable && pct !== null && (
            <span className={`text-sm font-semibold ${data.high_load ? "text-alerta-fg" : "text-muted"}`}>
              {pct >= 0 ? `+${pct} % sobre su promedio` : `${Math.abs(pct)} % bajo su promedio`}
            </span>
          )}
        </div>
        {!comparable && (
          <p className="text-xs text-muted">Se compara con su promedio cuando tenga 3 semanas previas con datos.</p>
        )}
      </div>

      {hasData ? (
        <div className="relative pt-2" style={{ height: CHART_PX + 28 }}>
          {comparable && (
            <>
              <div
                aria-hidden="true"
                className="absolute inset-x-0 border-t-[1.5px] border-dashed border-muted"
                style={{ bottom: 22 + Math.round((data.baseline! / max) * CHART_PX) }}
              />
              <span
                className="absolute right-0 bg-mist pl-1 text-[11px] text-muted"
                style={{ bottom: 26 + Math.round((data.baseline! / max) * CHART_PX) }}
              >
                promedio 4 sem · {formatLoad(data.baseline!)}
              </span>
            </>
          )}
          <ol className="flex h-full items-end gap-2.5" aria-label="Carga de las últimas 6 semanas">
            {weeks.map((w, i) => {
              const current = i === weeks.length - 1;
              const h = Math.max(w.load > 0 ? 4 : 2, Math.round((w.load / max) * CHART_PX));
              const label = current ? "Actual" : `S-${weeks.length - 1 - i}`;
              return (
                <li key={w.week_start} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="sr-only">
                    {current ? "Semana actual" : `Semana del ${dayLabel(w.week_start)}`}: {formatLoad(w.load)} en{" "}
                    {w.sessions} {w.sessions === 1 ? "sesión" : "sesiones"}
                  </span>
                  <div
                    aria-hidden="true"
                    className={`w-full rounded-md ${
                      current ? (data.high_load ? "bg-alerta" : "bg-brand") : "bg-[#cbd5e1]"
                    }`}
                    style={{ height: h }}
                    title={`${formatLoad(w.load)}${w.estimated ? " (estimada)" : ""}`}
                  />
                  <span aria-hidden="true" className="text-[11px] text-muted">
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <p className="text-sm text-muted">Aún no responde el esfuerzo de ninguna sesión.</p>
      )}

      <div>
        <h3 className="mb-1 font-semibold text-ink">Sesiones de la semana</h3>
        {data.current_sessions.length === 0 ? (
          <p className="text-sm text-muted">Sin sesiones respondidas esta semana.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.current_sessions.map((s) => (
              <li key={s.event_id} className="flex items-center gap-3 py-2.5">
                <span className="w-9 text-[13px] text-muted">
                  {WEEKDAY_LABELS[isoWeekday(chileDateTime(s.starts_at).date) - 1]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-ink">{EVENT_TYPE_LABEL[s.type]}</span>
                  <span className="block text-xs text-muted">
                    Esfuerzo {s.rpe} × {s.minutes} min{s.estimated ? " (estimado)" : ""}
                  </span>
                </span>
                <span className="font-display font-bold text-ink tabular-nums">{formatLoad(s.load)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {data.current_sessions.some((s) => s.estimated) && (
        <p className="flex items-start gap-1.5 text-xs text-muted">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          En partidos sin minutos exactos, la carga se estima con la duración del partido.
        </p>
      )}
    </div>
  );
}

// Últimos checks de bienestar del jugador, con el total y los 5 ítems.
export function WellnessHistory({ reports }: { reports: WellnessReport[] | null }) {
  if (!reports) {
    return <p className={`p-5 text-sm text-muted ${cardClass}`}>No se pudo cargar el bienestar.</p>;
  }
  if (reports.length === 0) {
    return <p className={`p-5 text-sm text-muted ${cardClass}`}>Aún no responde el check de bienestar.</p>;
  }
  return (
    <ul className={`divide-y divide-line ${cardClass}`}>
      {reports.map((r) => (
        <li key={r.report_date} className="space-y-2 px-5 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-ink">{dayLabel(r.report_date)}</span>
            <span className="font-display text-lg font-bold text-ink tabular-nums">
              {r.total}
              <span className="text-sm font-semibold text-muted"> / 25</span>
            </span>
          </div>
          <dl className="grid grid-cols-5 gap-2 text-center">
            {WELLNESS_ITEMS.map((q) => {
              const v = r[q.key];
              return (
                <div
                  key={q.key}
                  className={`flex flex-col-reverse rounded-lg px-1 py-1.5 ${v <= 2 ? "bg-alerta-bg text-alerta-fg" : "bg-white text-ink"}`}
                >
                  <dt className="truncate text-[11px]">{q.title === "Calidad del sueño" ? "Sueño" : q.title}</dt>
                  <dd className="font-display font-bold tabular-nums">{v}</dd>
                </div>
              );
            })}
          </dl>
        </li>
      ))}
    </ul>
  );
}
