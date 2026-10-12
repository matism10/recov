"use client";

import { useActionState, useRef } from "react";
import {
  AVAILABILITY_LABEL,
  AVAILABILITY_STYLE,
  type Availability,
} from "@/lib/roles";
import { setPlayerAvailability, type AvailabilityState } from "./actions";

// Cambia la disponibilidad apenas se elige otra opción.
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
    <form ref={formRef} action={formAction} className="text-right">
      <input type="hidden" name="player_id" value={playerId} />
      <select
        name="availability"
        defaultValue={value}
        key={value}
        disabled={pending}
        onChange={() => formRef.current?.requestSubmit()}
        aria-label={`Disponibilidad de ${playerName}`}
        className={`cursor-pointer rounded-full border-0 py-1 pl-3 pr-8 text-xs font-medium disabled:opacity-60 ${AVAILABILITY_STYLE[value]}`}
      >
        {(Object.keys(AVAILABILITY_LABEL) as Availability[]).map((a) => (
          <option key={a} value={a}>
            {AVAILABILITY_LABEL[a]}
          </option>
        ))}
      </select>
      {state.error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
