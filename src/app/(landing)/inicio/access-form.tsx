"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { requestAccess, type RequestState } from "./actions";
import { FORM_ROLES, FORM_SPORTS, validateRequest, type Field } from "@/lib/landing/config";

const input =
  "mt-1 block min-h-11 w-full rounded-xl border border-[#CBD9E6] bg-white px-3 py-2 text-base text-[#0B1B2B] outline-none focus:border-[#0B1B2B] focus:ring-2 focus:ring-[#E8F6FE]";

export function AccessForm() {
  const [state, action, pending] = useActionState<RequestState, FormData>(requestAccess, { status: "idle" });
  const [clientErrors, setClientErrors] = useState<Partial<Record<Field, string>>>({});
  const errors = { ...state.errors, ...clientErrors };

  if (state.status === "ok") {
    return (
      <div role="status" className="rounded-2xl bg-white p-6 text-[#0B1B2B]">
        <p className="font-[family-name:var(--l-title)] text-xl font-extrabold tracking-tight">Recibimos tu solicitud.</p>
        <p className="mt-2 text-[#3F5266]">Te respondemos por correo para contarte los próximos pasos.</p>
      </div>
    );
  }

  const field = (id: Field, label: string, children: React.ReactNode) => (
    <div>
      <label htmlFor={`f-${id}`} className="text-sm font-semibold text-[#0B1B2B]">
        {label}
      </label>
      {children}
      {errors[id] && (
        <p id={`e-${id}`} className="mt-1 text-sm text-[#B42318]">
          {errors[id]}
        </p>
      )}
    </div>
  );
  const aria = (id: Field) => ({ "aria-invalid": !!errors[id], "aria-describedby": errors[id] ? `e-${id}` : undefined });

  return (
    <form
      action={action}
      noValidate
      onSubmit={(e) => {
        const f = new FormData(e.currentTarget);
        const get = (k: string) => String(f.get(k) ?? "");
        const errs = validateRequest({ club: get("club"), sport: get("sport"), role: get("role"), name: get("name"), email: get("email") });
        setClientErrors(errs);
        if (Object.keys(errs).length) e.preventDefault();
      }}
      className="space-y-3 rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(11,27,43,0.18)] sm:p-6"
    >
      {/* Honeypot: oculto para personas. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Sitio web <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {field("club", "Nombre del club", <input id="f-club" name="club" required maxLength={120} autoComplete="organization" className={input} {...aria("club")} />)}
      <div className="grid gap-3 sm:grid-cols-2">
        {field(
          "sport",
          "Deporte",
          <select id="f-sport" name="sport" required defaultValue="" className={input} {...aria("sport")}>
            <option value="" disabled>Elige</option>
            {FORM_SPORTS.map((s) => <option key={s}>{s}</option>)}
          </select>,
        )}
        {field(
          "role",
          "Tu cargo",
          <select id="f-role" name="role" required defaultValue="" autoComplete="organization-title" className={input} {...aria("role")}>
            <option value="" disabled>Elige</option>
            {FORM_ROLES.map((s) => <option key={s}>{s}</option>)}
          </select>,
        )}
      </div>
      {field("name", "Tu nombre", <input id="f-name" name="name" required maxLength={120} autoComplete="name" className={input} {...aria("name")} />)}
      {field("email", "Correo", <input id="f-email" name="email" type="email" required maxLength={254} autoComplete="email" inputMode="email" className={input} {...aria("email")} />)}
      {state.message && <p role="alert" className="text-sm text-[#B42318]">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-full bg-[#0B1B2B] px-6 font-bold text-white transition hover:bg-[#12304A] disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Pedir acceso anticipado"}
      </button>
      <p className="text-xs text-[#3F5266]">
        5 datos y te respondemos por correo. Al enviar aceptas la{" "}
        <Link href="/privacidad" className="underline">Política de Privacidad</Link>.
      </p>
    </form>
  );
}
