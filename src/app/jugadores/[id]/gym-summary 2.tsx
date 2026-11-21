// "Gimnasio" en la ficha del jugador (staff): plan asignado, cumplimiento por semana
// (últimas 6) y últimas sesiones. Datos de player_gym_summary.
import { dayLabel, formatLoad, WEEKDAYS } from "@/lib/srpe";
import { rangeLabel, type PlayerGymSummary } from "@/lib/gym";
import { cardClass } from "@/app/ui";

export function GymSummary({ data }: { data: PlayerGymSummary | null }) {
  if (!data) {
    return <p className={`p-5 text-sm text-muted ${cardClass}`}>No se pudo cargar el gimnasio.</p>;
  }
  const weeks = data.weeks;
  const current = weeks.at(-1);
  return (
    <div className={`space-y-5 p-5 ${cardClass}`}>
      <div>
        <h3 className="mb-1 font-semibold text-ink">Plan asignado</h3>
        {data.plans.length === 0 ? (
          <p className="text-sm text-muted">No tiene un plan de gimnasio vigente.</p>
        ) : (
          <ul className="space-y-2">
            {data.plans.map((p) => (
              <li key={p.id} className="rounded-lg bg-white px-3 py-2">
                <p className="font-medium text-ink">{p.name}</p>
                <p className="text-xs text-muted">{rangeLabel(p.starts_on, p.ends_on)}</p>
                <p className="mt-1 text-sm text-ink">
                  {p.sessions
                    .map((s) => `${s.label} · ${WEEKDAYS[s.weekday - 1].short} · ${s.exercise_count} ejerc.`)
                    .join(" — ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h3 className="font-semibold text-ink">Cumplimiento por semana</h3>
          {current && current.assigned > 0 && (
            <span className="text-sm text-muted">
              Esta semana: {current.done} de {current.assigned}
            </span>
          )}
        </div>
        {weeks.every((w) => w.assigned === 0) ? (
          <p className="text-sm text-muted">Sin sesiones asignadas en las últimas 6 semanas.</p>
        ) : (
          <ol className="grid grid-cols-6 gap-2" aria-label="Sesiones hechas de las asignadas, últimas 6 semanas">
            {weeks.map((w, i) => {
              const last = i === weeks.length - 1;
              const full = w.assigned > 0 && w.done >= w.assigned;
              return (
                <li key={w.week_start} className="flex flex-col items-center gap-1">
                  <span
                    className={`flex h-10 w-full items-center justify-center rounded-lg text-sm font-semibold tabular-nums ${
                      w.assigned === 0
                        ? "bg-white text-muted"
                        : full
                          ? "bg-[#0369A1] text-white"
                          : w.done > 0
                            ? "bg-brand-soft text-brand-text"
                            : "bg-line text-ink"
                    }`}
                  >
                    {w.assigned === 0 ? "—" : `${w.done}/${w.assigned}`}
                  </span>
                  <span className="text-[11px] text-muted">{last ? "Actual" : `S-${weeks.length - 1 - i}`}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div>
        <h3 className="mb-1 font-semibold text-ink">Últimas sesiones</h3>
        {data.recent.length === 0 ? (
          <p className="text-sm text-muted">Aún no registra sesiones de gimnasio.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.recent.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2.5">
                <span className="w-20 shrink-0 text-[13px] text-muted">{dayLabel(r.performed_on)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-ink">{r.own ? "Por su cuenta" : r.label}</span>
                  <span className="block text-xs text-muted">
                    {r.own
                      ? `${r.minutes} min`
                      : `${r.done_exercises} de ${r.total_exercises ?? r.done_exercises} ejercicios · ${r.minutes} min`}
                    {r.rpe !== null ? ` · esfuerzo ${r.rpe}` : " · sin esfuerzo"}
                  </span>
                </span>
                <span className="font-display font-bold text-ink tabular-nums">
                  {r.rpe !== null ? formatLoad(r.rpe * r.minutes) : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
