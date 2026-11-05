"use client";

import { RPE_LABELS, RPE_VALUES } from "@/lib/srpe";

// Escala vertical de esfuerzo de 0 a 10 (6, 8 y 9 sin texto). La usan /reportar
// (entrenamientos y partidos) y el esfuerzo del gimnasio.
export function RpeScale({
  value,
  onChange,
  disabled = false,
}: {
  value: number | null;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Esfuerzo de 0 a 10" className="space-y-1">
      {RPE_VALUES.map((n) => {
        const selected = value === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(n)}
            className={`flex min-h-11 w-full items-center gap-3.5 rounded-xl border px-3 text-left transition disabled:opacity-60 ${
              selected ? "border-brand bg-brand-soft" : "border-transparent hover:bg-mist"
            }`}
          >
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-lg font-display font-bold tabular-nums ${
                selected ? "bg-brand text-ink" : "bg-mist text-ink"
              }`}
            >
              {n}
            </span>
            <span className="font-medium text-ink">{RPE_LABELS[n] ?? ""}</span>
          </button>
        );
      })}
    </div>
  );
}
