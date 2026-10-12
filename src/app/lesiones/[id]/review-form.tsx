"use client";

import { useActionState, useState, type MouseEvent } from "react";
import {
  AVAILABILITY_LABEL,
  MANUAL_AVAILABILITY,
  type Availability,
  type ManualAvailability,
} from "@/lib/roles";
import { SEVERITY_LABEL, type InjurySeverity, type InjuryStatus } from "@/lib/injuries";
import { reviewInjury, type ReviewInjuryState } from "./actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200";
const labelClass = "block text-sm font-medium text-slate-700";
const secondaryButton =
  "rounded-lg border border-slate-300 px-4 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

const CONFIRM_MESSAGE = {
  descartar:
    "¿Descartar esta lesión? Quedará como descartada y, si el jugador no tiene otra lesión abierta, volverá a estar disponible.",
  cerrar:
    "¿Dar de alta esta lesión? Quedará cerrada y, si el jugador no tiene otra lesión abierta, volverá a estar disponible.",
};

export function ReviewForm({
  injuryId,
  status,
  startedOn,
  expectedReturnOn,
  severity,
  availability,
}: {
  injuryId: string;
  status: InjuryStatus;
  startedOn: string;
  expectedReturnOn: string | null;
  severity: InjurySeverity | null;
  availability: Availability;
}) {
  const [state, formAction, pending] = useActionState<ReviewInjuryState, FormData>(
    reviewInjury,
    {},
  );
  const [chosenSeverity, setChosenSeverity] = useState<InjurySeverity | "">(
    severity ?? "",
  );
  // Al confirmar se sugiere "Lesionado"; si ya está en reintegro se mantiene.
  // "En revisión" no es una opción: confirmar la lesión la resuelve.
  const [chosenAvailability, setChosenAvailability] = useState<ManualAvailability>(
    availability === "reintegro" ? "reintegro" : "lesionado",
  );

  // Descartar y dar de alta piden confirmación antes de enviarse.
  function confirmDecision(
    e: MouseEvent<HTMLButtonElement>,
    decision: keyof typeof CONFIRM_MESSAGE,
  ) {
    if (!window.confirm(CONFIRM_MESSAGE[decision])) e.preventDefault();
  }

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="injury_id" value={injuryId} />
        <input type="hidden" name="decision" value="confirmar" />

        <div className="grid gap-3 sm:grid-cols-3">
          <label className={labelClass}>
            Gravedad
            <select
              name="severity"
              required
              value={chosenSeverity}
              onChange={(e) => setChosenSeverity(e.target.value as InjurySeverity)}
              className={inputClass}
            >
              <option value="" disabled>
                Elige
              </option>
              {Object.entries(SEVERITY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
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
            Disponibilidad
            <select
              name="availability"
              value={chosenAvailability}
              onChange={(e) => setChosenAvailability(e.target.value as ManualAvailability)}
              className={inputClass}
            >
              {MANUAL_AVAILABILITY.map((value) => (
                <option key={value} value={value}>
                  {AVAILABILITY_LABEL[value]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Confirmar lesión"}
        </button>
      </form>

      <form action={formAction} className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
        <input type="hidden" name="injury_id" value={injuryId} />
        <button
          type="submit"
          name="decision"
          value="descartar"
          disabled={pending}
          onClick={(e) => confirmDecision(e, "descartar")}
          className={secondaryButton}
        >
          Descartar lesión
        </button>
        {status === "activa" && (
          <button
            type="submit"
            name="decision"
            value="cerrar"
            disabled={pending}
            onClick={(e) => confirmDecision(e, "cerrar")}
            className={secondaryButton}
          >
            Dar de alta
          </button>
        )}
      </form>

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
    </div>
  );
}
