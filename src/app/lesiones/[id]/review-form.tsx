"use client";

import { useActionState } from "react";
import { SEVERITY_LABEL, type InjurySeverity } from "@/lib/injuries";
import { reviewInjury, type ReviewInjuryState } from "./actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200";
const labelClass = "block text-sm font-medium text-slate-700";

export function ReviewForm({
  injuryId,
  startedOn,
  expectedReturnOn,
  severity,
  reviewed,
}: {
  injuryId: string;
  startedOn: string;
  expectedReturnOn: string | null;
  severity: InjurySeverity | null;
  reviewed: boolean;
}) {
  const [state, formAction, pending] = useActionState<ReviewInjuryState, FormData>(
    reviewInjury,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="injury_id" value={injuryId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Fecha estimada de alta
          <input
            name="expected_return_on"
            type="date"
            required
            min={startedOn}
            defaultValue={expectedReturnOn ?? ""}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Gravedad
          <select
            name="severity"
            defaultValue={severity ?? ""}
            className={inputClass}
          >
            <option value="">Sin definir</option>
            {Object.entries(SEVERITY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!reviewed && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            name="mark_reviewed"
            type="checkbox"
            className="size-4 accent-emerald-600"
          />
          Marcar como revisada
        </label>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state.ok && !pending && (
        <p role="status" className="text-sm text-emerald-700">
          Cambios guardados.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
