"use client";

import { useActionState } from "react";
import { ErrorMessage, SuccessMessage } from "@/app/ui";
import { setClubSevens, type SevensState } from "@/app/sevens-actions";

// Interruptor "Activar Sevens" (solo clubes de rugby). Se guarda al tocarlo. El valor
// que se pide sale de lo guardado (`enabled`), no de un estado local: así el envío
// siempre pide lo contrario de lo que hay.
export function SevensToggle({ enabled }: { enabled: boolean }) {
  const [state, formAction, pending] = useActionState<SevensState, FormData>(setClubSevens, {});
  // Mientras se guarda, el interruptor ya muestra el cambio.
  const on = pending ? !enabled : enabled;

  return (
    <form action={formAction} className="space-y-3">
      <button
        type="submit"
        name="enabled"
        value={String(!enabled)}
        role="switch"
        aria-checked={on}
        disabled={pending}
        className="flex min-h-11 w-full items-center justify-between gap-4 rounded-xl border border-line bg-white px-4 py-2 text-left disabled:opacity-60"
      >
        <span className="font-medium text-ink">Activar Sevens</span>
        <span
          aria-hidden="true"
          className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-brand-strong" : "bg-line"}`}
        >
          <span
            className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`}
          />
        </span>
      </button>
      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      {state.ok && !pending && (
        <SuccessMessage>{enabled ? "Sevens activado." : "Sevens desactivado."}</SuccessMessage>
      )}
    </form>
  );
}
