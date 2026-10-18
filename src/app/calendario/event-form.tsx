"use client";

import { useActionState, useState, type FormEvent } from "react";
import {
  EVENT_TYPES,
  EVENT_TYPE_LABEL,
  LOCATION_MAX,
  MAX_WEEKS,
  NOTES_MAX,
  OPPONENT_MAX,
  timeToMinutes,
  type EventType,
} from "@/lib/events";
import { ErrorMessage, buttonPrimary, fieldClass, inputClass, labelClass, optionalClass } from "@/app/ui";
import { createEvent, updateEvent, type EventFormState } from "./actions";

export type EventFormValues = {
  type: EventType;
  date: string;
  start: string;
  end: string;
  location: string;
  opponent: string;
  notes: string;
};

// Crear: elige tipo y, en entrenamientos, la repetición semanal.
// Editar: misma ocurrencia, sin tipo ni repetición.
export function EventForm({
  eventId,
  defaults,
}: {
  eventId?: string;
  defaults: EventFormValues;
}) {
  const editing = Boolean(eventId);
  const [state, formAction, pending] = useActionState<EventFormState, FormData>(
    editing ? updateEvent : createEvent,
    {},
  );
  const [type, setType] = useState<EventType>(defaults.type);
  const [clientError, setClientError] = useState<string | null>(null);

  // La base es la autoridad; aquí solo se evita un envío que fallaría seguro.
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    const data = new FormData(e.currentTarget);
    const start = String(data.get("start") ?? "");
    const end = String(data.get("end") ?? "");
    if (start && end && timeToMinutes(end) <= timeToMinutes(start)) {
      e.preventDefault();
      setClientError("La hora de término debe ser posterior a la de inicio.");
      return;
    }
    setClientError(null);
  };

  const error = clientError ?? state.error;
  // Tras un error, lo enviado; si no, los valores iniciales.
  const v = { ...defaults, weeks: "1", ...state.values };

  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-4">
      {editing ? (
        <input type="hidden" name="event_id" value={eventId} />
      ) : (
        <fieldset>
          <legend className={labelClass}>Tipo de evento</legend>
          <div className="mt-1 grid grid-cols-2 gap-1 rounded-xl border border-line bg-mist p-1">
            {EVENT_TYPES.map((t) => (
              <label
                key={t}
                className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg text-sm font-medium transition has-focus-visible:ring-2 has-focus-visible:ring-brand-strong ${
                  type === t ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value={t}
                  checked={type === t}
                  onChange={() => setType(t)}
                  className="sr-only"
                />
                {EVENT_TYPE_LABEL[t]}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label className={labelClass}>
        Fecha
        <input type="date" name="date" required defaultValue={v.date} className={inputClass} />
      </label>

      {/* min-w-0: cada celda puede encogerse a la mitad del ancho. */}
      <div className="grid grid-cols-2 gap-3">
        <label className={`min-w-0 ${labelClass}`}>
          Hora de inicio
          <input type="time" name="start" required defaultValue={v.start} className={inputClass} />
        </label>
        <label className={`min-w-0 ${labelClass}`}>
          Hora de término
          <input type="time" name="end" required defaultValue={v.end} className={inputClass} />
        </label>
      </div>

      <label className={labelClass}>
        Lugar <span className={optionalClass}>(opcional)</span>
        <input
          name="location"
          maxLength={LOCATION_MAX}
          defaultValue={v.location}
          placeholder="Ej.: Cancha 2, Estadio Municipal"
          className={inputClass}
        />
      </label>

      {type === "competencia" && (
        <label className={labelClass}>
          Rival <span className={optionalClass}>(opcional)</span>
          <input
            name="opponent"
            maxLength={OPPONENT_MAX}
            defaultValue={v.opponent}
            placeholder="Ej.: Club Deportivo Los Andes"
            className={inputClass}
          />
        </label>
      )}

      <label className={labelClass}>
        Notas <span className={optionalClass}>(opcional)</span>
        <textarea
          name="notes"
          rows={3}
          maxLength={NOTES_MAX}
          defaultValue={v.notes}
          className={inputClass}
        />
      </label>

      {!editing && type === "entrenamiento" && (
        <div>
          <label className={labelClass}>
            Repetir semanalmente
            <span className="mt-1 flex items-center gap-2">
              <input
                type="number"
                name="weeks"
                min={1}
                max={MAX_WEEKS}
                defaultValue={v.weeks}
                required
                aria-describedby="weeks-help"
                className={`${fieldClass} max-w-28`}
              />
              <span className="font-normal text-muted">semanas</span>
            </span>
          </label>
          <p id="weeks-help" className="mt-1 text-sm text-muted">
            Crea un entrenamiento por semana, el mismo día y a la misma hora (de 1 a {MAX_WEEKS},
            incluida esta). Son eventos independientes: editar o cancelar uno no cambia los demás.
          </p>
        </div>
      )}

      {error && <ErrorMessage>{error}</ErrorMessage>}

      <button type="submit" disabled={pending} className={`w-full ${buttonPrimary}`}>
        {pending ? "Guardando…" : editing ? "Guardar cambios" : "Crear evento"}
      </button>
    </form>
  );
}
