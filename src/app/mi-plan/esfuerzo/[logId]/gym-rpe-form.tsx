"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ErrorMessage, buttonPrimary } from "@/app/ui";
import { formatLoad } from "@/lib/srpe";
import { RpeScale } from "@/app/rpe-scale";
import { submitGymRpe } from "../../actions";

// Esfuerzo de la sesión de gimnasio (0–10) con la carga en vivo. Al guardar vuelve a la
// pantalla de felicitaciones.
export function GymRpeForm({ logId, minutes, initialRpe }: { logId: string; minutes: number; initialRpe: number | null }) {
  const router = useRouter();
  const [picked, setPicked] = useState<number | null>(initialRpe);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const send = () =>
    startTransition(async () => {
      if (picked === null) return;
      setError(null);
      const res = await submitGymRpe(logId, picked);
      if (res.error) setError(res.error);
      else router.push(`/mi-plan/listo/${logId}`);
    });

  return (
    <div className="space-y-5">
      {initialRpe !== null && <p className="text-sm text-muted">Ya respondiste: puedes corregirlo hasta 2 días después.</p>}
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
            {picked === null ? "Elige un número" : `${picked} × ${minutes} min = ${formatLoad(picked * minutes)}`}
          </span>
        </div>
        <button type="button" onClick={send} disabled={pending || picked === null} className={`h-13 w-full text-base ${buttonPrimary}`}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
        {error && <ErrorMessage>{error}</ErrorMessage>}
      </div>
    </div>
  );
}
