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
import {
  ErrorMessage,
  SuccessMessage,
  buttonPrimary,
  buttonSecondary,
  inputClass,
  labelClass,
} from "@/app/ui";


const CONFIRM_MESSAGE = {
  descartar:
    "¿Descartar esta lesión? Quedará como descartada y, si el jugador no tiene otra lesión actual, volverá a estar disponible.",
  cerrar:
    "¿Dar de alta esta lesión? Quedará cerrada y, si el jugador no tiene otra lesión actual, volverá a estar disponible.",
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
          className={`w-full ${buttonPrimary}`}
        >
          {pending ? "Guardando…" : "Confirma la lesión"}
        </button>
      </form>

      {/* Descartar queda aparte de "Confirma la lesión": acción de texto en rojo,
          al otro extremo. Mismo envío y misma confirmación que antes. */}
      <form
        action={formAction}
        className="flex flex-wrap items-center gap-3 border-t border-line pt-4"
      >
        <input type="hidden" name="injury_id" value={injuryId} />
        {status === "activa" && (
          <button
            type="submit"
            name="decision"
            value="cerrar"
            disabled={pending}
            onClick={(e) => confirmDecision(e, "cerrar")}
            className={buttonSecondary}
          >
            Da de alta
          </button>
        )}
        <button
          type="submit"
          name="decision"
          value="descartar"
          disabled={pending}
          onClick={(e) => confirmDecision(e, "descartar")}
          className="ml-auto inline-flex min-h-11 items-center text-sm font-medium text-danger underline disabled:opacity-60"
        >
          Descarta la lesión
        </button>
      </form>

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      {state.ok && !pending && (
        <SuccessMessage>Cambios guardados.</SuccessMessage>
      )}
    </div>
  );
}
