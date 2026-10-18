"use client";

import { useActionState } from "react";
import {
  CARD_METRICS,
  DASHBOARD_METRICS,
  DASHBOARD_METRIC_LABEL,
  type DashboardMetric,
} from "@/lib/dashboard-metrics";
import { ErrorMessage, SuccessMessage, buttonPrimary, textButton } from "@/app/ui";
import { setDashboardMetrics, type MetricsState } from "./actions";

const GROUPS = [
  { legend: "Tarjetas", items: DASHBOARD_METRICS.filter((m) => CARD_METRICS.includes(m)) },
  { legend: "Gráficos y listas", items: DASHBOARD_METRICS.filter((m) => !CARD_METRICS.includes(m)) },
];

// Casillas con las métricas del catálogo; se muestran en el Resumen en este orden.
export function MetricsForm({ selected }: { selected: DashboardMetric[] }) {
  const [state, formAction, pending] = useActionState<MetricsState, FormData>(
    setDashboardMetrics,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {GROUPS.map((group) => (
        <fieldset key={group.legend}>
          <legend className="text-sm font-medium text-ink">{group.legend}</legend>
          <div className="mt-1 grid gap-x-6 sm:grid-cols-2">
            {group.items.map((m) => (
              <label key={m} className="flex min-h-11 items-center gap-3 text-sm text-ink">
                <input
                  type="checkbox"
                  name="metrics"
                  value={m}
                  defaultChecked={selected.includes(m)}
                  className="size-4 accent-brand-strong"
                />
                {DASHBOARD_METRIC_LABEL[m]}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="submit" disabled={pending} className={`text-sm ${buttonPrimary}`}>
          {pending ? "Guardando…" : "Guarda las métricas"}
        </button>
        <button
          type="submit"
          name="decision"
          value="reset"
          disabled={pending}
          className={textButton}
        >
          Vuelve a las de siempre
        </button>
      </div>

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      {state.ok && !pending && <SuccessMessage>Métricas guardadas.</SuccessMessage>}
    </form>
  );
}
