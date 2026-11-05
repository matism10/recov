"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ErrorMessage, buttonPrimary } from "@/app/ui";
import { WELLNESS_ITEMS, type WellnessItem, type WellnessReport } from "@/lib/srpe";
import { submitWellness } from "./actions";

type Answers = Partial<Record<WellnessItem, number>>;

// Las 5 preguntas con chips de 1 a 5 y etiquetas en los extremos, "N de 5 respondidas",
// el total y "Enviar" (habilitado con las 5). Al enviar vuelve al Resumen.
export function WellnessForm({ initial }: { initial: WellnessReport | null }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>(() =>
    initial
      ? {
          fatigue: initial.fatigue,
          sleep: initial.sleep,
          soreness: initial.soreness,
          stress: initial.stress,
          mood: initial.mood,
        }
      : {},
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const values = WELLNESS_ITEMS.map((q) => answers[q.key]).filter((v): v is number => v !== undefined);
  const count = values.length;
  const done = count === WELLNESS_ITEMS.length;
  const total = values.reduce((a, b) => a + b, 0);

  const send = () =>
    startTransition(async () => {
      setError(null);
      const res = await submitWellness(answers as Record<WellnessItem, number>);
      if (res.error) setError(res.error);
      else router.push("/dashboard");
    });

  return (
    <div className="space-y-6">
      {initial && <p className="text-sm text-muted">Ya respondiste este check: puedes corregirlo.</p>}
      {WELLNESS_ITEMS.map((q) => (
        <fieldset key={q.key} className="space-y-2">
          <legend className="mb-2 font-semibold text-ink">{q.title}</legend>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => {
              const selected = answers[q.key] === n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${q.title}: ${n}${n === 1 ? ` (${q.low})` : n === 5 ? ` (${q.high})` : ""}`}
                  disabled={pending}
                  onClick={() => {
                    setAnswers((a) => ({ ...a, [q.key]: n }));
                    setError(null);
                  }}
                  className={`h-11 rounded-xl border font-display text-base font-bold tabular-nums transition disabled:opacity-60 ${
                    selected ? "border-brand bg-brand text-ink" : "border-line bg-mist text-ink hover:bg-white"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-muted">
            <span>{q.low}</span>
            <span>{q.high}</span>
          </div>
        </fieldset>
      ))}

      <div className="space-y-3 border-t border-line pt-4">
        <div className="flex items-baseline justify-between gap-4" aria-live="polite">
          <span className="text-sm text-muted">{count} de 5 respondidas</span>
          <span className="font-display text-lg font-bold text-ink tabular-nums">
            {done ? total : "—"} / 25
          </span>
        </div>
        <button type="button" onClick={send} disabled={pending || !done} className={`h-13 w-full text-base ${buttonPrimary}`}>
          {pending ? "Enviando…" : "Enviar"}
        </button>
        {error && <ErrorMessage>{error}</ErrorMessage>}
      </div>
    </div>
  );
}
