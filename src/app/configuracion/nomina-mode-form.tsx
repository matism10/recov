"use client";

import { useActionState, useState } from "react";
import { CircleAlert } from "lucide-react";
import {
  NOMINA_MODES,
  NOMINA_MODE_HINT,
  NOMINA_MODE_LABEL,
  type NominaMode,
} from "@/lib/match-load";
import { ErrorMessage, SuccessMessage, buttonPrimary } from "@/app/ui";
import { setNominaMode, type NominaModeState } from "./actions";

// Modo de registro de la participación. Si ya hay partidos cargados, se avisa que
// se conservan y que las métricas pasan a usar el nuevo modo.
export function NominaModeForm({ mode, loadedCount }: { mode: NominaMode; loadedCount: number }) {
  const [selected, setSelected] = useState<NominaMode>(mode);
  const [state, formAction, pending] = useActionState<NominaModeState, FormData>(setNominaMode, {});
  const changed = selected !== mode;

  return (
    <form action={formAction} className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="sr-only">Modo de registro</legend>
        {NOMINA_MODES.map((m) => (
          <label
            key={m}
            className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
              selected === m ? "border-brand-strong bg-brand-soft" : "border-line bg-white hover:bg-mist"
            }`}
          >
            <input
              type="radio"
              name="mode"
              value={m}
              checked={selected === m}
              onChange={() => setSelected(m)}
              disabled={pending}
              className="mt-1 size-4 accent-brand-strong"
            />
            <span>
              <span className="block font-medium text-ink">
                {NOMINA_MODE_LABEL[m]}
                {m === mode && <span className="font-normal text-muted"> (actual)</span>}
              </span>
              <span className="block text-sm text-muted">{NOMINA_MODE_HINT[m]}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {changed && loadedCount > 0 && (
        <p className="flex items-start gap-1.5 rounded-xl bg-revision-bg p-3 text-sm text-revision-fg">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Ya hay participaciones cargadas: los partidos anteriores se conservan; las métricas
          usan el nuevo modo. Los datos menos detallados que el nuevo modo no suman minutos.
        </p>
      )}
      <button type="submit" disabled={pending || !changed} className={`text-sm ${buttonPrimary}`}>
        {pending ? "Guardando…" : "Guarda el modo"}
      </button>
      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      {state.ok && !pending && !changed && <SuccessMessage>Modo guardado.</SuccessMessage>}
    </form>
  );
}
