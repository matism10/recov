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

const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200";
const primaryButton =
  "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60";
const secondaryButton =
  "rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

const DOT_STYLE: Record<PhaseDraft["status"], string> = {
  completada: "bg-emerald-500",
  en_curso: "bg-amber-500",
  pendiente: "bg-slate-300",
};

function Timeline({ phases }: { phases: PhaseDraft[] }) {
  return (
    <ol className="space-y-3 border-l-2 border-slate-200 pl-5">
      {phases.map((ph) => (
        <li key={ph.id ?? ph.name} className="relative">
          <span
            className={`absolute top-1.5 -left-[27px] size-3 rounded-full border-2 border-white ${DOT_STYLE[ph.status]}`}
          />
          <p className="font-medium text-slate-900">{ph.name}</p>
          <p className="text-sm text-slate-500">
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
    return (
      <p role="alert" className="text-sm text-red-600">
        {state.error}
      </p>
    );
  }
  if (state.ok && !pending) {
    return (
      <p role="status" className="text-sm text-emerald-700">
        Cambios guardados.
      </p>
    );
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
          <li
            key={row.id ?? `nueva-${i}`}
            className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_9rem_9rem_auto] sm:items-end"
          >
            <label className="text-xs font-medium text-slate-600">
              Fase · {PHASE_STATUS_LABEL[row.status]}
              <input
                value={row.name}
                required
                maxLength={PHASE_NAME_MAX}
                onChange={(e) => update(i, { name: e.target.value })}
                className={`mt-1 ${fieldClass}`}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Desde
              <input
                type="date"
                value={row.started_on}
                onChange={(e) => update(i, { started_on: e.target.value })}
                className={`mt-1 ${fieldClass}`}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Hasta
              <input
                type="date"
                value={row.ended_on}
                min={row.started_on || undefined}
                onChange={(e) => update(i, { ended_on: e.target.value })}
                className={`mt-1 ${fieldClass}`}
              />
            </label>
            <button
              type="button"
              onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
              disabled={pending || rows.length === 1}
              className="text-sm text-slate-500 underline disabled:opacity-40"
            >
              Quitar
            </button>
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
          className="text-sm font-medium text-emerald-700 underline"
        >
          + Agregar fase
        </button>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Guardando…" : "Guardar fases"}
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
        <p className="rounded-2xl bg-white p-5 text-sm text-slate-500 ring-1 ring-slate-200">
          Sin fases registradas.
        </p>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          {phases.length === 0 ? (
            <button type="button" onClick={() => setEditing(true)} className={primaryButton}>
              Cargar fases sugeridas
            </button>
          ) : (
            <>
              {canAdvance && (
                <form action={advanceAction}>
                  <input type="hidden" name="injury_id" value={injuryId} />
                  <button type="submit" disabled={advancing} className={primaryButton}>
                    {advancing ? "Guardando…" : "Avanzar a la siguiente fase"}
                  </button>
                </form>
              )}
              <button type="button" onClick={() => setEditing(true)} className={secondaryButton}>
                Editar fases
              </button>
            </>
          )}
        </div>
      )}
      <Feedback state={advanceState} pending={advancing} />
    </div>
  );
}
