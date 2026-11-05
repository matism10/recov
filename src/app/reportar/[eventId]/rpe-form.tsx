"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ErrorMessage, buttonPrimary, textButton } from "@/app/ui";
import { formatLoad } from "@/lib/srpe";
import { RpeScale } from "@/app/rpe-scale";
import { submitRpe } from "./actions";

// Escala vertical de 0 a 10 (6, 8 y 9 sin texto), la carga calculada en vivo y los
// botones "Guardar" y "No fui". Al guardar vuelve al Resumen.
export function RpeForm({
  eventId,
  match,
  minutes,
  estimated,
  initialRpe,
  answeredAbsent,
}: {
  eventId: string;
  match: boolean;
  minutes: number;
  estimated: boolean;
  initialRpe: number | null;
  answeredAbsent: boolean;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<number | null>(initialRpe);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const send = (absent: boolean) =>
    startTransition(async () => {
      setError(null);
      const res = await submitRpe(eventId, absent ? null : picked, absent);
      if (res.error) setError(res.error);
      else router.push("/dashboard");
    });

  return (
    <div className="space-y-5">
      {answeredAbsent && (
        <p className="text-sm text-muted">
          Avisaste que no {match ? "jugaste" : "fuiste"}. Si sí {match ? "jugaste" : "fuiste"}, elige un número y guarda.
        </p>
      )}
      {initialRpe !== null && (
        <p className="text-sm text-muted">Ya respondiste: puedes corregirlo hasta 48 horas después.</p>
      )}

      <RpeScale
        value={picked}
        disabled={pending}
        onChange={(n) => {
          setPicked(n);
          setError(null);
        }}
      />

      <div className="space-y-3 border-t border-line pt-4">
        <div className="flex items-baseline justify-between gap-4" aria-live="polite">
          <span className="text-sm text-muted">Carga de la sesión</span>
          <span className="font-display text-lg font-bold text-ink tabular-nums">
            {picked === null
              ? "Elige un número"
              : `${picked} × ${minutes} min = ${formatLoad(picked * minutes)}${estimated ? " estimada" : ""}`}
          </span>
        </div>
        {estimated && (
          <p className="text-xs text-muted">
            Estimada con la duración del partido: los minutos exactos dependen de cómo se cargó la participación.
          </p>
        )}
        <button
          type="button"
          onClick={() => send(false)}
          disabled={pending || picked === null}
          className={`h-13 w-full text-base ${buttonPrimary}`}
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => send(true)}
          disabled={pending}
          className={`w-full justify-center ${textButton}`}
        >
          {match ? "No jugué este partido" : "No fui a este entrenamiento"}
        </button>
        {error && <ErrorMessage>{error}</ErrorMessage>}
      </div>
    </div>
  );
}
