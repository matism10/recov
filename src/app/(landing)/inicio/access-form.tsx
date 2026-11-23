"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { requestAccess, type RequestState } from "./actions";
import { FORM_ROLES, FORM_SPORTS, validateRequest, type Field } from "@/lib/landing/config";

export function AccessForm() {
  const [state, action, pending] = useActionState<RequestState, FormData>(requestAccess, { status: "idle" });
  const [clientErrors, setClientErrors] = useState<Partial<Record<Field, string>>>({});
  const errors = { ...state.errors, ...clientErrors };

  if (state.status === "ok") {
    return (
      <div role="status" className="lp-form-ok">
        <p className="lp-display">Recibimos tu solicitud.</p>
        <p>Te respondemos por correo para contarte los próximos pasos.</p>
      </div>
    );
  }

  const aria = (id: Field) => ({ "aria-invalid": !!errors[id], "aria-describedby": errors[id] ? `e-${id}` : undefined });
  const field = (id: Field, label: string, control: React.ReactNode, wide = false) => (
    <div className={`lp-field${wide ? " lp-field-wide" : ""}`}>
      <label htmlFor={`f-${id}`}>{label}</label>
      {control}
      {errors[id] && <p id={`e-${id}`} className="lp-error">{errors[id]}</p>}
    </div>
  );

  return (
    <form
      action={action}
      noValidate
      aria-label="Pedir acceso anticipado"
      onSubmit={(e) => {
        const f = new FormData(e.currentTarget);
        const get = (k: string) => String(f.get(k) ?? "");
        const errs = validateRequest({ club: get("club"), sport: get("sport"), role: get("role"), name: get("name"), email: get("email") });
        setClientErrors(errs);
        if (Object.keys(errs).length) e.preventDefault();
      }}
      className="lp-form"
    >
      {/* Honeypot: oculto para personas. */}
      <div aria-hidden="true" className="lp-hp">
        <label>
          Sitio web <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {field("club", "Nombre del club", <input id="f-club" name="club" required maxLength={120} autoComplete="organization" {...aria("club")} />, true)}
      {field(
        "sport",
        "Deporte",
        <select id="f-sport" name="sport" required defaultValue="" {...aria("sport")}>
          <option value="" disabled>Elige</option>
          {FORM_SPORTS.map((s) => <option key={s}>{s}</option>)}
        </select>,
      )}
      {field(
        "role",
        "Tu rol",
        <select id="f-role" name="role" required defaultValue="" autoComplete="organization-title" {...aria("role")}>
          <option value="" disabled>Elige</option>
          {FORM_ROLES.map((s) => <option key={s}>{s}</option>)}
        </select>,
      )}
      {field("name", "Nombre", <input id="f-name" name="name" required maxLength={120} autoComplete="name" {...aria("name")} />)}
      {field("email", "Correo", <input id="f-email" name="email" type="email" required maxLength={254} autoComplete="email" inputMode="email" {...aria("email")} />)}
      {state.message && <p role="alert" className="lp-error lp-field-wide">{state.message}</p>}
      <button type="submit" disabled={pending} className="lp-btn lp-btn-lg lp-btn-navy">
        {pending ? "Enviando…" : <>Pedir acceso anticipado <span aria-hidden="true">↗</span></>}
      </button>
      <p className="lp-form-note">
        Te respondemos por correo. Sin pago automático ni contrato.{" "}
        <Link href="/privacidad">Política de Privacidad</Link>
      </p>
    </form>
  );
}
