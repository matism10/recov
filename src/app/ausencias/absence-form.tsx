"use client";

import { useState, useTransition } from "react";
import { ErrorMessage, buttonPrimary, fieldClass, inputClass, labelClass, optionalClass } from "@/app/ui";
import { ABSENCE_REASONS, ABSENCE_REASON_LABEL, NOTE_MAX, type AbsenceScope } from "@/lib/absences";
import { declareAbsence } from "./actions";

export type EventOption = { id: string; title: string; when: string };
export type PlayerOption = { id: string; name: string };

const SQUAD = "__plantel__";

// Aviso de ausencia, para el jugador y para el staff (modal "Declarar ausencia").
// Jugador: sin selector de jugador. Staff: elige un jugador y, solo con `canSquad`
// (paron_declarar), también "Todo el plantel", que solo admite "Varios días".
// Un evento = lista de próximos eventos; varios días = desde / hasta (o "Aún no sé").
export function AbsenceForm({
  events,
  today,
  players,
  canSquad = false,
  submitLabel = "Avisar",
  onDone,
}: {
  events: EventOption[];
  today: string;
  players?: PlayerOption[];
  canSquad?: boolean;
  submitLabel?: string;
  onDone: () => void;
}) {
  const staffMode = !!players;
  const [target, setTarget] = useState<string>(players?.[0]?.id ?? "");
  const [scope, setScope] = useState<AbsenceScope>("evento");
  const [eventId, setEventId] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState("");
  const [unknownEnd, setUnknownEnd] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const squad = staffMode && target === SQUAD;
  const effectiveScope: AbsenceScope = squad ? "periodo" : scope;

  const ready =
    reason !== "" &&
    (!staffMode || target !== "") &&
    (effectiveScope === "evento" ? eventId !== "" : startsOn !== "" && (unknownEnd || endsOn !== ""));

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const res = await declareAbsence({
        playerId: staffMode && !squad ? target : null,
        scope: effectiveScope,
        eventId: effectiveScope === "evento" ? eventId : null,
        startsOn: effectiveScope === "periodo" ? startsOn : null,
        endsOn: effectiveScope === "periodo" && !unknownEnd ? endsOn : null,
        reason,
        note,
      });
      if (res.error) setError(res.error);
      else onDone();
    });

  return (
    <div className="space-y-5">
      {staffMode && (
        <div>
          <label htmlFor="abs-player" className={labelClass}>
            Jugador
          </label>
          <select
            id="abs-player"
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              setError(null);
            }}
            className={inputClass}
          >
            {players!.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            {canSquad && <option value={SQUAD}>Todo el plantel (parón)</option>}
          </select>
        </div>
      )}

      {!squad && (
        <div role="group" aria-label="Tipo de aviso" className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-mist p-1">
          {(
            [
              ["evento", "Un evento"],
              ["periodo", "Varios días"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={scope === key}
              onClick={() => {
                setScope(key);
                setError(null);
              }}
              className={`min-h-11 rounded-lg text-sm font-medium transition ${
                scope === key ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {effectiveScope === "evento" ? (
        <fieldset>
          <legend className={labelClass}>¿A cuál no {staffMode ? "va" : "vas"}?</legend>
          {events.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No hay eventos próximos en el calendario.</p>
          ) : (
            <ul className="mt-2 max-h-64 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-card">
              {events.map((e) => {
                const selected = eventId === e.id;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setEventId(e.id);
                        setError(null);
                      }}
                      className={`flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition ${
                        selected ? "bg-brand-soft" : "hover:bg-mist"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`size-4 shrink-0 rounded-full border-2 ${
                          selected ? "border-brand-strong bg-brand-strong" : "border-line"
                        }`}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">{e.title}</span>
                        <span className="block text-sm text-muted">{e.when}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="abs-from" className={labelClass}>
                Desde
              </label>
              <input
                id="abs-from"
                type="date"
                value={startsOn}
                onChange={(e) => setStartsOn(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="abs-to" className={labelClass}>
                Hasta
              </label>
              <input
                id="abs-to"
                type="date"
                value={unknownEnd ? "" : endsOn}
                min={startsOn || undefined}
                disabled={unknownEnd}
                onChange={(e) => setEndsOn(e.target.value)}
                className={`${inputClass} disabled:opacity-60`}
              />
            </div>
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={unknownEnd}
              onChange={(e) => setUnknownEnd(e.target.checked)}
              className="size-5 rounded border-line accent-brand-text"
            />
            Aún no sé cuándo vuelvo
          </label>
        </div>
      )}

      <div>
        <label htmlFor="abs-reason" className={labelClass}>
          Motivo
        </label>
        <select
          id="abs-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={inputClass}
        >
          <option value="">Elige un motivo</option>
          {ABSENCE_REASONS.map((r) => (
            <option key={r} value={r}>
              {ABSENCE_REASON_LABEL[r]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="abs-note" className={labelClass}>
          Nota <span className={optionalClass}>(opcional)</span>
        </label>
        <textarea
          id="abs-note"
          value={note}
          maxLength={NOTE_MAX}
          rows={2}
          onChange={(e) => setNote(e.target.value)}
          className={`mt-1 ${fieldClass}`}
        />
        <p className="mt-1 flex justify-between gap-3 text-xs text-muted">
          <span>No escribas datos de salud; las lesiones van en Lesiones.</span>
          <span className="tabular-nums">
            {note.length}/{NOTE_MAX}
          </span>
        </p>
      </div>

      <div className="space-y-2">
        <button type="button" onClick={submit} disabled={pending || !ready} className={`w-full ${buttonPrimary}`}>
          {pending ? "Guardando…" : submitLabel}
        </button>
        {error && <ErrorMessage>{error}</ErrorMessage>}
      </div>
    </div>
  );
}
