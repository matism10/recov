"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ErrorMessage, buttonPrimary } from "@/app/ui";
import { WELLNESS_ITEMS, toShown, toStored, type WellnessItem, type WellnessReport } from "@/lib/srpe";
import { submitWellness } from "./actions";

// Respuestas en la orientación que ve el jugador (en Fatiga, Dolor muscular y Estrés,
// 5 = más). Se pasan a la escala guardada (5 = mejor) solo al enviar.
type Answers = Partial<Record<WellnessItem, number>>;

// Las 5 preguntas con chips de 1 a 5 y la etiqueta de cada extremo, "N de 5 respondidas",
// el total (Bienestar /25, en la escala guardada) y "Enviar" (habilitado con las 5).
// Al enviar vuelve al Resumen.
export function WellnessForm({ initial }: { initial: WellnessReport | null }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>(() =>
    initial
      ? {
          fatigue: toShown("fatigue", initial.fatigue),
          sleep: toShown("sleep", initial.sleep),
          soreness: toShown("soreness", initial.soreness),
          stress: toShown("stress", initial.stress),
          mood: toShown("mood", initial.mood),
        }
      : {},
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const answered = WELLNESS_ITEMS.filter((q) => answers[q.key] !== undefined);
  const count = answered.length;
  const done = count === WELLNESS_ITEMS.length;
  const total = answered.reduce((sum, q) => sum + toStored(q.key, answers[q.key]!), 0);

  const send = () =>
    startTransition(async () => {
      setError(null);
      const stored = Object.fromEntries(
        WELLNESS_ITEMS.map((q) => [q.key, toStored(q.key, answers[q.key]!)]),
      ) as Record<WellnessItem, number>;
      const res = await submitWellness(stored);
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
                  aria-label={`${q.title}: ${n}${n === 1 ? ` (${q.min})` : n === 5 ? ` (${q.max})` : ""}`}
                  disabled={pending}
                  onClick={() => {
                    setAnswers((a) => ({ ...a, [q.key]: n }));
                    setError(null);
                  }}
                  className={`h-11 rounded-xl border font-display text-base font-bold tabular-nums transition disabled:opacity-60 ${
                    selected ? "border-brand bg-brand text-ink" : "border-line bg-card text-ink hover:bg-mist"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-muted">
            <span>1 · {q.min}</span>
            <span>5 · {q.max}</span>
          </div>
        </fieldset>
      ))}

      <div className="space-y-3 border-t border-line pt-4">
        <div className="flex items-baseline justify-between gap-4" aria-live="polite">
          <span className="text-sm text-muted">{count} de 5 respondidas</span>
          <span className="text-sm text-muted">
            Bienestar{" "}
            <span className="font-display text-lg font-bold text-ink tabular-nums">{done ? total : "—"} / 25</span>
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
