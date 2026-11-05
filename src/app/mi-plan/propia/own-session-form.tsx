"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ErrorMessage, buttonPrimary, fieldClass, labelClass, optionalClass } from "@/app/ui";
import { RpeScale } from "@/app/rpe-scale";
import { formatLoad } from "@/lib/srpe";
import { GYM_LIMITS } from "@/lib/gym";
import { logOwnSession } from "../actions";

export function OwnSessionForm({ dates }: { dates: { date: string; label: string }[] }) {
  const router = useRouter();
  const [date, setDate] = useState(dates[0].date);
  const [minutes, setMinutes] = useState("60");
  const [rpe, setRpe] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const mins = Number(minutes);

  const send = () =>
    startTransition(async () => {
      setError(null);
      const res = await logOwnSession({ date, minutes: mins, rpe, note });
      if (res.error || !res.logId) setError(res.error ?? "No se pudo guardar la sesión.");
      else router.push(`/mi-plan/listo/${res.logId}`);
    });

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className={labelClass}>Fecha</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {dates.map((d) => (
            <button
              key={d.date}
              type="button"
              aria-pressed={date === d.date}
              onClick={() => setDate(d.date)}
              className={`min-h-11 rounded-xl border px-2 text-sm font-medium ${
                date === d.date ? "border-brand bg-brand-soft text-brand-text" : "border-line bg-white text-ink"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className={labelClass}>Duración (minutos)</span>
        <input
          type="number"
          inputMode="numeric"
          min={GYM_LIMITS.minutesMin}
          max={GYM_LIMITS.minutesMax}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          className={`mt-1 ${fieldClass}`}
        />
      </label>

      <div>
        <p className={labelClass}>
          ¿Qué tan dura fue? <span className={optionalClass}>(puedes responderlo después)</span>
        </p>
        <div className="mt-2">
          <RpeScale value={rpe} onChange={setRpe} disabled={pending} />
        </div>
      </div>

      <label className="block">
        <span className={labelClass}>
          Nota <span className={optionalClass}>(opcional)</span>
        </span>
        <input
          value={note}
          maxLength={GYM_LIMITS.noteMax}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ej.: pierna y core"
          className={`mt-1 ${fieldClass}`}
        />
      </label>

      <div className="space-y-3 border-t border-line pt-4">
        {rpe !== null && Number.isInteger(mins) && mins > 0 && (
          <p className="flex items-baseline justify-between text-sm text-muted">
            Carga de la sesión
            <span className="font-display text-lg font-bold text-ink tabular-nums">
              {rpe} × {mins} min = {formatLoad(rpe * mins)}
            </span>
          </p>
        )}
        <button type="button" onClick={send} disabled={pending} className={`h-13 w-full text-base ${buttonPrimary}`}>
          {pending ? "Guardando…" : "Guardar sesión"}
        </button>
        {error && <ErrorMessage>{error}</ErrorMessage>}
      </div>
    </div>
  );
}
