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

// Dos grupos de casillas: computador y celular, cada uno con el catálogo completo.
// En el Resumen se muestran en este orden.
const DEVICES = [
  { name: "metrics", legend: "En computador" },
  { name: "metrics_mobile", legend: "En celular" },
] as const;

export function MetricsForm({
  desktop,
  mobile,
}: {
  desktop: DashboardMetric[];
  mobile: DashboardMetric[];
}) {
  const [state, formAction, pending] = useActionState<MetricsState, FormData>(
    setDashboardMetrics,
    {},
  );
  const selected = { metrics: desktop, metrics_mobile: mobile };

  return (
    <form action={formAction} className="space-y-6">
      {DEVICES.map((device) => (
        <fieldset key={device.name} className="space-y-3">
          <legend className="font-medium text-ink">{device.legend}</legend>
          {GROUPS.map((group) => (
            <div key={group.legend}>
              <p className="text-sm text-muted">{group.legend}</p>
              <div className="mt-1 grid gap-x-6 sm:grid-cols-2">
                {group.items.map((m) => (
                  <label key={m} className="flex min-h-11 items-center gap-3 text-sm text-ink">
                    <input
                      type="checkbox"
                      name={device.name}
                      value={m}
                      defaultChecked={selected[device.name].includes(m)}
                      className="size-4 accent-brand-strong"
                    />
                    {DASHBOARD_METRIC_LABEL[m]}
                  </label>
                ))}
              </div>
            </div>
          ))}
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
