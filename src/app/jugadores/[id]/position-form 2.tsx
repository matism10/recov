"use client";

import { useActionState } from "react";
import { setPlayerPositions, type PositionState } from "./actions";
import { ErrorMessage, SuccessMessage, buttonPrimary, inputClass, labelClass, optionalClass } from "@/app/ui";

// Formulario "Cambiar posición" de la ficha (solo con el permiso posicion_cambiar).
export function PositionForm({
  playerId,
  position,
  secondary,
  options,
  sevens,
}: {
  playerId: string;
  position: string | null;
  secondary: string | null;
  options: string[];
  // Solo rugby con Sevens activo y si el jugador está en el grupo.
  sevens: { position: string | null; secondary: string | null; options: string[] } | null;
}) {
  const [state, formAction, pending] = useActionState<PositionState, FormData>(setPlayerPositions, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="player_id" value={playerId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Posición principal
          <select name="position" defaultValue={position ?? ""} required className={inputClass}>
            <option value="" disabled>
              Elige una posición
            </option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Posición secundaria <span className={optionalClass}>(opcional)</span>
          <select name="secondary" defaultValue={secondary ?? ""} className={inputClass}>
            <option value="">Sin secundaria</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      </div>

      {sevens && (
        <div className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="with_sevens" value="1" />
          <label className={labelClass}>
            Posición en Sevens
            <select name="sevens_position" defaultValue={sevens.position ?? ""} className={inputClass}>
              <option value="">Sin elegir</option>
              {sevens.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Secundaria en Sevens <span className={optionalClass}>(opcional)</span>
            <select name="sevens_secondary" defaultValue={sevens.secondary ?? ""} className={inputClass}>
              <option value="">Sin secundaria</option>
              {sevens.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <p className="text-xs text-muted">
        Los planes de gimnasio asignados por posición se recalculan con la nueva posición.
      </p>
      <button type="submit" disabled={pending} className={`text-sm ${buttonPrimary}`}>
        {pending ? "Guardando…" : "Guarda la posición"}
      </button>
      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      {state.ok && !pending && <SuccessMessage>Posición guardada.</SuccessMessage>}
    </form>
  );
}
