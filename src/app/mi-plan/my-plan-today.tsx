"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { compactDayLabel } from "@/lib/events";
import { playerIntensity, restLabel, setsReps, type GymTodaySession } from "@/lib/gym";
import { ErrorMessage } from "@/app/ui";
import { completeSession } from "./actions";

// Lista de ejercicios de la sesión: cada tarjeta se marca al tocarla, con los kilos
// grandes a la derecha. "Terminar sesión" guarda lo marcado; "Hice la sesión completa"
// marca todo de una vez (para quien entrena sin el celular).
export function MyPlanToday({ session }: { session: GymTodaySession }) {
  const router = useRouter();
  const [done, setDone] = useState<Set<string>>(() => new Set(session.done_ids ?? []));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const total = session.exercises.length;
  const count = session.exercises.filter((e) => done.has(e.id)).length;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const already = !!session.log_id;

  const toggle = (id: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const finish = (all: boolean) =>
    startTransition(async () => {
      setError(null);
      const res = await completeSession(session.plan_session_id, all ? [] : [...done], all);
      if (res.error || !res.logId) setError(res.error ?? "No se pudo guardar la sesión.");
      else router.push(`/mi-plan/listo/${res.logId}`);
    });

  return (
    <div className="mt-3">
      <p className="text-sm text-muted">
        {session.today ? "Hoy" : compactDayLabel(session.date)} · {session.label} · ~{session.est_minutes} min
      </p>
      <h1 className="font-display text-[28px] leading-tight font-extrabold text-ink">Mi plan de hoy</h1>
      <p className="text-sm text-muted">{session.plan_name}</p>

      <div className="mt-4 space-y-1.5" aria-live="polite">
        <p className="text-sm text-muted">
          {count} de {total} {total === 1 ? "ejercicio hecho" : "ejercicios hechos"}
          {already && " · ya guardada, puedes corregirla"}
        </p>
        <div
          role="progressbar"
          aria-label="Ejercicios hechos"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={count}
          className="h-1.5 overflow-hidden rounded-full bg-line"
        >
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {session.exercises.map((e) => {
          const on = done.has(e.id);
          const v = playerIntensity(e);
          const details = [setsReps(e.sets, e.reps), e.rest_seconds !== null ? `descanso ${restLabel(e.rest_seconds)}` : null, e.note]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={e.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(e.id)}
                disabled={pending}
                className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition disabled:opacity-70 ${
                  on ? "border-[#BAE6FD] bg-[#F0F9FF]" : "border-line bg-white hover:bg-mist"
                }`}
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-lg border-2 ${
                    on ? "border-brand bg-brand text-[#082F49]" : "border-[#CBD5E1] bg-white text-transparent"
                  }`}
                >
                  <Check aria-hidden="true" className="size-4" strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{e.name}</span>
                  <span className="block text-[13px] text-muted">{details}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-lg font-extrabold text-ink">{v.main}</span>
                  {v.sub && <span className="block text-[11px] text-muted">{v.sub}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 space-y-2 border-t border-line pt-4">
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <button
          type="button"
          onClick={() => finish(false)}
          disabled={pending || count === 0}
          className={`flex h-13 w-full items-center justify-center rounded-2xl text-base font-semibold transition ${
            count > 0 ? "bg-brand text-[#082F49] hover:bg-brand-hover" : "bg-line text-muted"
          }`}
        >
          {pending ? "Guardando…" : already ? "Guardar cambios" : "Terminar sesión"}
        </button>
        <button
          type="button"
          onClick={() => finish(true)}
          disabled={pending}
          className="flex h-12 w-full items-center justify-center rounded-2xl border border-brand text-[15px] font-semibold text-brand-text transition hover:bg-brand-soft"
        >
          Hice la sesión completa
        </button>
      </div>
    </div>
  );
}
