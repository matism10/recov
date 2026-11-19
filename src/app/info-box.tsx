"use client";

// "¿Cómo se lee?": un ícono "i" que abre una explicación corta debajo del título de un
// bloque de Métricas. Botón con aria-expanded y aria-controls; el texto sale de
// src/lib/metrics-help.ts para que todos los bloques hablen igual.
import { useId, useState } from "react";
import { Info } from "lucide-react";
import { METRICS_HELP, type MetricsHelpKey } from "@/lib/metrics-help";

export function InfoBox({ topic, label = "¿Cómo se lee?" }: { topic: MetricsHelpKey; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const help = METRICS_HELP[topic];
  return (
    <div className="text-sm">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-brand-text hover:underline focus-visible:outline-2 focus-visible:outline-brand-strong"
      >
        <Info aria-hidden="true" className="size-4" />
        {label}
      </button>
      <div id={id} hidden={!open} className="mt-2 space-y-1.5 rounded-lg bg-brand-soft/60 px-3 py-2.5 text-ink">
        {help.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
    </div>
  );
}
