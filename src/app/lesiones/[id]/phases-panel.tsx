"use client";

import { useActionState, useState } from "react";
import {
  MAX_PHASES,
  PHASE_NAME_MAX,
  PHASE_STATUS_LABEL,
  formatDate,
  templatePhases,
  type PhaseDraft,
} from "@/lib/injuries";
import { advancePhase, savePhases, type PhasesState } from "./actions";
import {
  ErrorMessage,
  PhaseDot,
  SuccessMessage,
  buttonPrimary,
  buttonSecondary,
  cardClass,
  fieldClass,
  textButton,
} from "@/app/ui";

const primaryButton = `text-sm ${buttonPrimary}`;
const secondaryButton = `text-sm ${buttonSecondary}`;

function Timeline({ phases }: { phases: PhaseDraft[] }) {
  return (
    <ol className="space-y-3 border-l-2 border-line pl-5">
      {phases.map((ph) => (
        <li key={ph.id ?? ph.name} className="relative">
          <PhaseDot status={ph.status} />
          <p className="font-medium text-ink">{ph.name}</p>
          <p className="text-sm text-muted">
            {PHASE_STATUS_LABEL[ph.status]}
            {ph.started_on && ` · desde ${formatDate(ph.started_on)}`}
            {ph.ended_on && ` · hasta ${formatDate(ph.ended_on)}`}
          </p>
        </li>
      ))}
    </ol>
  );
}

function Feedback({ state, pending }: { state: PhasesState; pending: boolean }) {
  if (state.error) {
    return <ErrorMessage>{state.error}</ErrorMessage>;
  }
  if (state.ok && !pending) {
    return <SuccessMessage>Cambios guardados.</SuccessMessage>;
  }
  return null;
}

function Editor({
  injuryId,
  initial,
  onDone,
}: {
  injuryId: string;
  initial: PhaseDraft[];
  onDone: () => void;
}) {
  const [rows, setRows] = useState<PhaseDraft[]>(initial);
  const [state, formAction, pending] = useActionState<PhasesState, FormData>(
    async (prev, formData) => {
      const result = await savePhases(prev, formData);
      if (result.ok) onDone();
      return result;
    },
    {},
  );

  function update(i: number, changes: Partial<PhaseDraft>) {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...changes } : row)));
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="injury_id" value={injuryId} />
      <input type="hidden" name="phases" value={JSON.stringify(rows)} />

      <ul className="space-y-3">
        {rows.map((row, i) => (
          // Tarjeta apilada (la columna de fases es angosta en escritorio): número y
          // estado con "Quita", el nombre a todo el ancho y las fechas lado a lado
          // si la tarjeta da (container query: depende de la tarjeta, no de la ventana).
          <li key={row.id ?? `nueva-${i}`} className={`@container space-y-2 p-4 ${cardClass}`}>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={`${injuryId}-fase-${i}`} className="text-xs font-medium text-muted">
                Fase {i + 1} · {PHASE_STATUS_LABEL[row.status]}
              </label>
              <button
                type="button"
                onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
                disabled={pending || rows.length === 1}
                aria-label={`Quita la fase ${i + 1}`}
                className={`-my-2 ${textButton}`}
              >
                Quita
              </button>
            </div>
            <input
              id={`${injuryId}-fase-${i}`}
              value={row.name}
              required
              maxLength={PHASE_NAME_MAX}
              onChange={(e) => update(i, { name: e.target.value })}
              className={fieldClass}
            />
            <div className="grid grid-cols-1 gap-3 pt-1 @[18.5rem]:grid-cols-2">
              <label className="min-w-0 text-xs font-medium text-muted">
                Desde
                <input
                  type="date"
                  value={row.started_on}
                  onChange={(e) => update(i, { started_on: e.target.value })}
                  className={`mt-1 min-w-0 ${fieldClass}`}
                />
              </label>
              <label className="min-w-0 text-xs font-medium text-muted">
                Hasta
                <input
                  type="date"
                  value={row.ended_on}
                  min={row.started_on || undefined}
                  onChange={(e) => update(i, { ended_on: e.target.value })}
                  className={`mt-1 min-w-0 ${fieldClass}`}
                />
              </label>
            </div>
          </li>
        ))}
      </ul>

      {rows.length < MAX_PHASES && (
        <button
          type="button"
          onClick={() =>
            setRows((r) => [...r, { name: "", status: "pendiente", started_on: "", ended_on: "" }])
          }
          disabled={pending}
          className="inline-flex min-h-11 items-center text-sm font-medium text-brand-text underline"
        >
          + Agrega una fase
        </button>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Guardando…" : "Guarda las fases"}
        </button>
        <button type="button" onClick={onDone} disabled={pending} className={secondaryButton}>
          Cancelar
        </button>
      </div>
      <Feedback state={state} pending={pending} />
    </form>
  );
}

// Línea de tiempo de fases. Quien gestiona lesiones (kinesiólogo, delegado y
// head coach) puede cargar la plantilla, editarla y avanzar de fase si la
// lesión está activa; el resto solo la ve.
export function PhasesPanel({
  injuryId,
  phases,
  canEdit,
  startedOn,
  expectedReturnOn,
}: {
  injuryId: string;
  phases: PhaseDraft[];
  canEdit: boolean;
  startedOn: string;
  expectedReturnOn: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [advanceState, advanceAction, advancing] = useActionState<PhasesState, FormData>(
    advancePhase,
    {},
  );
  const canAdvance = phases.some((p) => p.status !== "completada");

  if (editing) {
    return (
      <Editor
        injuryId={injuryId}
        initial={phases.length > 0 ? phases : templatePhases(startedOn, expectedReturnOn)}
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {phases.length > 0 ? (
        <Timeline phases={phases} />
      ) : (
        <p className={`p-5 text-sm text-muted ${cardClass}`}>
          Sin fases registradas.
        </p>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          {phases.length === 0 ? (
            <button type="button" onClick={() => setEditing(true)} className={primaryButton}>
              Carga las fases sugeridas
            </button>
          ) : (
            <>
              {canAdvance && (
                <form action={advanceAction}>
                  <input type="hidden" name="injury_id" value={injuryId} />
                  <button type="submit" disabled={advancing} className={primaryButton}>
                    {advancing ? "Guardando…" : "Avanza a la siguiente fase"}
                  </button>
                </form>
              )}
              <button type="button" onClick={() => setEditing(true)} className={secondaryButton}>
                Edita las fases
              </button>
            </>
          )}
        </div>
      )}
      <Feedback state={advanceState} pending={advancing} />
    </div>
  );
}
