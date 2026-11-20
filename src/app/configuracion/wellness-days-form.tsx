"use client";

import { useState, useTransition } from "react";
import { ErrorMessage, SuccessMessage, buttonPrimary } from "@/app/ui";
import { WEEKDAYS } from "@/lib/srpe";
import { saveWellnessDays, type WellnessDaysState } from "./wellness-actions";

// Casillas de lunes a domingo y "Guardar". Al menos un día.
export function WellnessDaysForm({ initial }: { initial: number[] }) {
  const [days, setDays] = useState(() => new Set(initial));
  const [state, setState] = useState<WellnessDaysState>({});
  const [pending, startTransition] = useTransition();

  const toggle = (iso: number) => {
    setState({});
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  };

  const save = () =>
    startTransition(async () => {
      setState(await saveWellnessDays([...days].sort()));
    });

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Días del check</legend>
        <ul className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => {
            const checked = days.has(d.iso);
            return (
              <li key={d.iso}>
                <label
                  className={`relative inline-flex min-h-11 min-w-14 cursor-pointer items-center justify-center rounded-full border px-4 text-sm font-medium transition focus-within:outline-2 focus-within:outline-brand-strong ${
                    checked
                      ? "border-brand-strong bg-brand-strong text-white"
                      : "border-line bg-card text-ink hover:bg-mist"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(d.iso)}
                    disabled={pending}
                    aria-label={d.label}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                  />
                  <span aria-hidden="true">{d.short}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="space-y-2">
        <button
          type="button"
          onClick={save}
          disabled={pending || days.size === 0}
          className={`w-full sm:w-auto ${buttonPrimary}`}
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
        {days.size === 0 && <p className="text-sm text-muted">Elige al menos un día.</p>}
        {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
        {state.ok && !pending && <SuccessMessage>Días guardados.</SuccessMessage>}
      </div>
    </div>
  );
}
