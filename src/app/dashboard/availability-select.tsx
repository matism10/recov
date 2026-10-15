"use client";

import { useActionState, useRef } from "react";
import { AVAILABILITY_LABEL, MANUAL_AVAILABILITY, type Availability } from "@/lib/roles";
import { AVAILABILITY_STYLE, AvailabilityIcon, ErrorMessage } from "@/app/ui";
import { setPlayerAvailability, type AvailabilityState } from "./actions";

// Color del ícono junto al selector: el tono oscuro de cada estado (contraste sobre blanco).
const ICON_COLOR: Record<Availability, string> = {
  disponible: "text-disponible-fg",
  en_revision: "text-revision-fg",
  lesionado: "text-lesionado-fg",
  reintegro: "text-reintegro-fg",
};

// Cambia la disponibilidad apenas se elige otra opción. El ícono va al lado del
// <select> (no puede ir dentro de las opciones) y el significado lo lleva el texto.
export function AvailabilitySelect({
  playerId,
  playerName,
  value,
}: {
  playerId: string;
  playerName: string;
  value: Availability;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<AvailabilityState, FormData>(
    setPlayerAvailability,
    {},
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="player_id" value={playerId} />
      <div className="flex items-center gap-2">
        <AvailabilityIcon status={value} className={`size-5 ${ICON_COLOR[value]}`} />
        <select
          name="availability"
          defaultValue={value}
          key={value}
          disabled={pending}
          onChange={() => formRef.current?.requestSubmit()}
          aria-label={`Disponibilidad de ${playerName}`}
          className={`min-h-11 cursor-pointer rounded-xl border-0 py-2 pl-3 pr-8 text-sm font-medium disabled:opacity-60 ${AVAILABILITY_STYLE[value]}`}
        >
          {MANUAL_AVAILABILITY.map((a) => (
            <option key={a} value={a}>
              {AVAILABILITY_LABEL[a]}
            </option>
          ))}
        </select>
      </div>
      {state.error && <ErrorMessage className="text-xs">{state.error}</ErrorMessage>}
    </form>
  );
}
