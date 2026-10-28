"use client";

import { useActionState, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActiveFormat } from "./plantel-activo";
import { setMySevensPosition, type SevensState } from "./sevens-actions";
import { FORMAT_LABEL, SEVENS_POSITIONS, type Format } from "@/lib/sevens";
import { ErrorMessage, buttonPrimary, labelClass, inputClass, textButton } from "./ui";

// Selector segmentado "Rugby 15 | Sevens". Solo va arriba del Resumen.
export function FormatSwitch({ format }: { format: Format }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Mientras se guarda, se marca el elegido; después manda el formato del servidor.
  const [chosen, setChosen] = useState<Format | null>(null);
  const current = pending && chosen ? chosen : format;

  function choose(next: Format) {
    if (next === current || pending) return;
    setChosen(next);
    startTransition(async () => {
      const { ok } = await setActiveFormat(next);
      if (ok) router.refresh();
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label="Formato"
      className="mb-6 inline-flex w-full rounded-xl border border-line bg-mist p-1 sm:w-auto"
    >
      {(["15", "7"] as const).map((f) => (
        <button
          key={f}
          type="button"
          role="radio"
          aria-checked={current === f}
          onClick={() => choose(f)}
          disabled={pending}
          className={`min-h-11 flex-1 rounded-lg px-5 text-sm font-medium transition sm:flex-none ${
            current === f ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          {FORMAT_LABEL[f]}
        </button>
      ))}
    </div>
  );
}

// Chip pasivo del encabezado cuando el formato activo es Sevens.
export function SevensChip({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-text ${className}`}
    >
      Sevens
    </span>
  );
}

const DISMISS_KEY = "recov_sevens_position_later";

// Aviso para quien está en el grupo y no tiene posición de Sevens. "Ahora no" lo
// oculta solo en esta sesión del navegador.
function readDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    // Sin sessionStorage (modo privado): el aviso se muestra igual.
    return false;
  }
}

export function SevensPositionBanner() {
  const [hidden, setHidden] = useState(false);
  // En el servidor no hay sessionStorage: el aviso parte visible y el cliente lo corrige.
  const dismissed = useSyncExternalStore(
    () => () => {},
    readDismissed,
    () => false,
  );
  const [position, setPosition] = useState("");
  const [state, formAction, pending] = useActionState<SevensState, FormData>(setMySevensPosition, {});

  if (hidden || dismissed || state.ok) return null;

  function later() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Sin sessionStorage: se oculta solo hasta recargar.
    }
    setHidden(true);
  }

  return (
    <section className="mb-8 space-y-4 rounded-xl border border-brand-strong bg-brand-soft p-5">
      <div>
        <h2 className="font-medium text-ink">Elige tu posición en Sevens</h2>
        <p className="mt-1 text-sm text-ink">
          Puede ser distinta a tu posición en Rugby 15. Con ella te encuentran en la nómina y en
          los filtros del plantel.
        </p>
      </div>
      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Principal
            <select
              name="position"
              required
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className={`${inputClass} min-h-11`}
            >
              <option value="">Elige una posición</option>
              {SEVENS_POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Secundaria (opcional)
            <select name="secondary" defaultValue="" className={`${inputClass} min-h-11`}>
              <option value="">Sin secundaria</option>
              {SEVENS_POSITIONS.filter((p) => p !== position).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={!position || pending} className={buttonPrimary}>
            {pending ? "Guardando…" : "Guardar posición"}
          </button>
          <button type="button" onClick={later} className={`min-h-11 ${textButton}`}>
            Ahora no
          </button>
        </div>
        {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      </form>
    </section>
  );
}
