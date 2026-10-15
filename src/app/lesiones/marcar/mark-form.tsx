"use client";

import { useActionState } from "react";
import { NOTE_MAX, NOTE_MIN, OCCURRED_DURING_LABEL } from "@/lib/injuries";
import { markPlayerInjured, type MarkInjuredState } from "./actions";
import { ErrorMessage, buttonPrimary, inputClass, labelClass } from "@/app/ui";

// El jugador ya viene elegido desde su fila del plantel.
export function MarkForm({ playerId }: { playerId: string }) {
  const [state, formAction, pending] = useActionState<MarkInjuredState, FormData>(
    markPlayerInjured,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="player_id" value={playerId} />

      <fieldset>
        <legend className={labelClass}>¿Dónde ocurrió?</legend>
        <div className="mt-2 flex gap-6">
          {Object.entries(OCCURRED_DURING_LABEL).map(([value, label]) => (
            <label key={value} className="flex min-h-11 items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="occurred_during"
                value={value}
                required
                className="size-4 accent-brand-strong"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className={labelClass}>
        Qué pasó
        <input
          name="note"
          required
          minLength={NOTE_MIN}
          maxLength={NOTE_MAX}
          placeholder="Ej.: Golpe en la rodilla"
          className={inputClass}
        />
      </label>

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}

      <button
        type="submit"
        disabled={pending}
        className={`w-full ${buttonPrimary}`}
      >
        {pending ? "Guardando…" : "Marca lesionado"}
      </button>
    </form>
  );
}
