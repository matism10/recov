"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/app/avatar";
import { AvailabilityBadge, ErrorMessage, SuccessMessage, buttonPrimary } from "@/app/ui";
import { saveAttendance, type AttendanceState } from "./actions";

export type AttendanceEntry = {
  playerId: string;
  name: string;
  position: string | null;
  injured: boolean; // availability = lesionado (solo informativo)
};

// Lista del plantel: todos parten presentes y se toca a quien faltó. Guardar envía
// solo los ausentes; la base marca al resto como presente.
export function AttendanceForm({
  eventId,
  entries,
  initialAbsent,
  saved,
}: {
  eventId: string;
  entries: AttendanceEntry[];
  initialAbsent: string[];
  saved: boolean; // ya había una lista guardada
}) {
  const [absent, setAbsent] = useState(() => new Set(initialAbsent));
  const [state, setState] = useState<AttendanceState>({});
  const [pending, startTransition] = useTransition();

  const toggle = (id: string) => {
    setState({});
    setAbsent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const absentCount = entries.filter((e) => absent.has(e.playerId)).length;
  const presentCount = entries.length - absentCount;

  const save = () =>
    startTransition(async () => {
      const ids = entries.filter((e) => absent.has(e.playerId)).map((e) => e.playerId);
      setState(await saveAttendance(eventId, ids));
    });

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3 text-center">
        <div className="flex flex-col-reverse rounded-xl bg-disponible-bg px-3 py-3 text-disponible-fg">
          <dt className="text-sm">Presentes</dt>
          <dd className="font-display text-3xl font-bold tabular-nums">{presentCount}</dd>
        </div>
        <div className="flex flex-col-reverse rounded-xl bg-lesionado-bg px-3 py-3 text-lesionado-fg">
          <dt className="text-sm">Ausentes</dt>
          <dd className="font-display text-3xl font-bold tabular-nums">{absentCount}</dd>
        </div>
      </dl>

      <p className="text-sm text-muted">
        {saved ? "Lista guardada: puedes corregirla y volver a guardar. " : ""}
        Todos parten como presentes. Toca a quien faltó.
      </p>

      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-mist">
        {entries.map((e) => {
          const isAbsent = absent.has(e.playerId);
          return (
            <li key={e.playerId}>
              <button
                type="button"
                onClick={() => toggle(e.playerId)}
                aria-pressed={isAbsent}
                disabled={pending}
                className={`flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition disabled:opacity-60 ${
                  isAbsent ? "bg-lesionado-bg/40" : "hover:bg-white"
                }`}
              >
                <Avatar name={e.name} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{e.name}</span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    {e.position ?? "Sin posición"}
                    {e.injured && <AvailabilityBadge status="lesionado" />}
                  </span>
                </span>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-sm font-medium ${
                    isAbsent ? "bg-lesionado-bg text-lesionado-fg" : "bg-disponible-bg text-disponible-fg"
                  }`}
                >
                  {isAbsent ? "Ausente" : "Presente"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="space-y-2">
        <button type="button" onClick={save} disabled={pending} className={`w-full sm:w-auto ${buttonPrimary}`}>
          {pending ? "Guardando…" : "Guardar asistencia"}
        </button>
        {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
        {state.ok && !pending && (
          <SuccessMessage>
            Asistencia guardada: {presentCount} {presentCount === 1 ? "presente" : "presentes"} y {absentCount}{" "}
            {absentCount === 1 ? "ausente" : "ausentes"}.
          </SuccessMessage>
        )}
      </div>
    </div>
  );
}
