"use client";

import { useActionState } from "react";
import { NOTE_MAX, NOTE_MIN, OCCURRED_DURING_LABEL } from "@/lib/injuries";
import { markPlayerInjured, type MarkInjuredState } from "./actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200";
const labelClass = "block text-sm font-medium text-slate-700";

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
            <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="occurred_during"
                value={value}
                required
                className="size-4 accent-emerald-600"
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
          placeholder="Ej.: Golpe en la rodilla en un ruck"
          className={inputClass}
        />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Marcar lesionado"}
      </button>
    </form>
  );
}
