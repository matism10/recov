"use client";

import { useActionState } from "react";
import { resetPassword, type ResetState } from "./actions";
import { ErrorMessage, buttonPrimary, inputClass, labelClass } from "@/app/ui";

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<ResetState, FormData>(resetPassword, {});

  return (
    <form action={formAction} className="space-y-5">
      {/* Tras el primer intento, el link ya abrió la sesión: no se manda de nuevo. */}
      {!state.sessionReady && <input type="hidden" name="token" value={token} />}
      <label className={labelClass}>
        Contraseña nueva
        <input
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Repite la contraseña
        <input
          name="confirm"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className={inputClass}
        />
      </label>
      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      <button type="submit" disabled={pending} className={`w-full ${buttonPrimary}`}>
        {pending ? "Guardando…" : "Guarda y entra"}
      </button>
    </form>
  );
}
