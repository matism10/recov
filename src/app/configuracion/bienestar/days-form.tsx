"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { ErrorMessage, SuccessMessage, buttonPrimary } from "@/app/ui";
import { WEEKDAYS } from "@/lib/srpe";
import { saveWellnessDays, type WellnessDaysState } from "./actions";

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
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-mist">
          {WEEKDAYS.map((d) => {
            const checked = days.has(d.iso);
            return (
              <li key={d.iso}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2 hover:bg-white">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(d.iso)}
                    disabled={pending}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`flex size-5 shrink-0 items-center justify-center rounded-md border peer-focus-visible:ring-2 peer-focus-visible:ring-brand-strong ${
                      checked ? "border-brand-strong bg-brand-strong text-white" : "border-muted bg-white"
                    }`}
                  >
                    {checked && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  <span className="text-ink">{d.label}</span>
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
