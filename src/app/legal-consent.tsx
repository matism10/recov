"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { signOut } from "@/app/login/actions";
import { acceptTermsAction, declareGuardianAction, type LegalState } from "./legal-actions";
import { ErrorMessage, buttonPrimary, cardClass, textButton } from "@/app/ui";
import { GUARDIAN_DECLARATION } from "@/lib/legal/content";

const linkCls = "font-medium text-brand-text underline";

// Casilla de aceptación (registro y pantalla de aceptación). Los textos legales abren en
// otra pestaña para no perder lo escrito.
export function TermsConsent({ checked, onChange, name = "consent" }: { checked: boolean; onChange: (v: boolean) => void; name?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-brand-strong"
      />
      <span>
        He leído y acepto los{" "}
        <Link href="/terminos" target="_blank" rel="noopener" className={linkCls}>
          Términos de uso
        </Link>{" "}
        y la{" "}
        <Link href="/privacidad" target="_blank" rel="noopener" className={linkCls}>
          Política de privacidad
        </Link>
        .
      </span>
    </label>
  );
}

// Pantalla bloqueante: aceptación de términos (cuentas existentes) o declaración del plantel.
export function LegalScreen({ kind, next }: { kind: "terms" | "guardian"; next?: string }) {
  const [state, formAction, pending] = useActionState<LegalState, FormData>(
    kind === "terms" ? acceptTermsAction : declareGuardianAction,
    {},
  );
  const [checked, setChecked] = useState(false);
  return (
    <main className="flex flex-1 items-center justify-center bg-white px-4 py-10">
      <form action={formAction} className={`w-full max-w-sm space-y-5 p-6 ${cardClass}`}>
        <h1 className="text-xl font-extrabold text-ink">
          {kind === "terms" ? "Antes de continuar" : "Declaración del plantel"}
        </h1>
        {kind === "terms" ? (
          <>
            <p className="text-sm text-muted">Actualizamos nuestros textos legales. Para seguir usando Recov, acéptalos.</p>
            <TermsConsent checked={checked} onChange={setChecked} />
          </>
        ) : (
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="consent"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-brand-strong"
            />
            <span>{GUARDIAN_DECLARATION}</span>
          </label>
        )}
        {next && <input type="hidden" name="next" value={next} />}
        {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
        <button type="submit" disabled={!checked || pending} className={`w-full ${buttonPrimary}`}>
          {pending ? "Guardando…" : kind === "terms" ? "Continuar" : "Confirmar"}
        </button>
        <button type="submit" formAction={signOut} formNoValidate className={`block w-full text-center ${textButton}`}>
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
