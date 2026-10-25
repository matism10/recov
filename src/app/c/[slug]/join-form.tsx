"use client";

import { useActionState, useState } from "react";
import { Send, Shirt, Users } from "lucide-react";
import { ROLE_LABEL, STAFF_SIGNUP_ROLES } from "@/lib/roles";
import { joinClub, type JoinState } from "./actions";
import { ErrorMessage, buttonPrimary, inputClass, labelClass, optionalClass } from "@/app/ui";

type Kind = "jugador" | "staff";

const KINDS = [
  { kind: "jugador", label: "Jugador", Icon: Shirt },
  { kind: "staff", label: "Staff", Icon: Users },
] as const;

// "Únete a este plantel": la cuenta ya existe, solo elige cómo se une. Jugador:
// posiciones del deporte del plantel. Staff: puesto. Nombre y apellido solo se
// piden (ya completos, para confirmar) si la cuenta no tiene ficha de jugador.
export function JoinForm({
  slug,
  positions,
  confirmName,
}: {
  slug: string;
  positions: string[];
  confirmName: { first: string; last: string } | null;
}) {
  const [kind, setKind] = useState<Kind>("jugador");
  const [state, formAction, pending] = useActionState<JoinState, FormData>(joinClub, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="kind" value={kind} />

      <fieldset>
        <legend className={labelClass}>Te unes como</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {KINDS.map(({ kind: k, label, Icon }) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              disabled={pending}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 font-medium text-ink transition ${
                kind === k
                  ? "border-brand-strong bg-brand-soft"
                  : "border-line bg-white hover:bg-mist"
              }`}
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {confirmName && (
        <fieldset>
          <legend className="text-sm text-muted">Confirma cómo aparecerás en este plantel.</legend>
          <div className="mt-2 grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Nombre
            <input
              name="first_name"
              required
              maxLength={100}
              autoComplete="given-name"
              defaultValue={confirmName.first}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Apellido
            <input
              name="last_name"
              required
              maxLength={100}
              autoComplete="family-name"
              defaultValue={confirmName.last}
              className={inputClass}
            />
          </label>
          </div>
        </fieldset>
      )}

      {kind === "jugador" ? (
        <>
          <label className={labelClass}>
            Posición principal
            <select name="position" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Elige una posición
              </option>
              {positions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Posición secundaria <span className={optionalClass}>(opcional)</span>
            <select name="secondary_position" defaultValue="" className={inputClass}>
              <option value="">Ninguna</option>
              {positions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <label className={labelClass}>
          Puesto
          <select name="role" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Elige tu puesto
            </option>
            {STAFF_SIGNUP_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
      )}

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}

      <button type="submit" disabled={pending} className={`w-full ${buttonPrimary}`}>
        <Send aria-hidden="true" className="size-4" />
        {pending ? "Enviando…" : "Envía tu solicitud"}
      </button>
    </form>
  );
}
