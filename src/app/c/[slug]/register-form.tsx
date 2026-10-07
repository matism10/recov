"use client";

import { useActionState, useState } from "react";
import { ROLE_LABEL, STAFF_SIGNUP_ROLES } from "@/lib/roles";
import { registerMember, type RegisterState } from "./actions";

type Kind = "jugador" | "staff";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200";
const labelClass = "block text-sm font-medium text-slate-700";
const optional = <span className="font-normal text-slate-400">(opcional)</span>;

export function RegisterForm({
  slug,
  positions,
}: {
  slug: string;
  positions: string[];
}) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(
    registerMember,
    {},
  );
  const f = state.fields;

  if (!kind) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {(["jugador", "staff"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className="rounded-lg border border-slate-300 px-4 py-3 font-medium text-slate-900 transition hover:border-emerald-600 hover:bg-emerald-50"
          >
            {k === "jugador" ? "Soy jugador" : "Soy staff"}
          </button>
        ))}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="kind" value={kind} />

      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-900">
          {kind === "jugador" ? "Registro de jugador" : "Registro de staff"}
        </span>
        <button
          type="button"
          onClick={() => setKind(null)}
          disabled={pending}
          className="text-slate-500 underline"
        >
          Cambiar
        </button>
      </div>

      <label className={labelClass}>
        Correo
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={f?.email}
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Contraseña
        <input
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className={labelClass}>
          Nombre
          <input
            name="first_name"
            required
            maxLength={100}
            autoComplete="given-name"
            defaultValue={f?.firstName}
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
            defaultValue={f?.lastName}
            className={inputClass}
          />
        </label>
      </div>

      {kind === "jugador" ? (
        <>
          <label className={labelClass}>
            Posición principal
            <select
              name="position"
              required
              defaultValue={f?.position ?? ""}
              className={inputClass}
            >
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
            Posición secundaria {optional}
            <select
              name="secondary_position"
              defaultValue={f?.secondaryPosition ?? ""}
              className={inputClass}
            >
              <option value="">Ninguna</option>
              {positions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Altura (cm) {optional}
              <input
                name="height_cm"
                type="number"
                min={100}
                max={250}
                step={1}
                defaultValue={f?.height}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Peso (kg) {optional}
              <input
                name="weight_kg"
                type="number"
                min={30}
                max={250}
                step={0.1}
                defaultValue={f?.weight}
                className={inputClass}
              />
            </label>
          </div>
        </>
      ) : (
        <label className={labelClass}>
          Puesto
          <select
            name="role"
            required
            defaultValue={f?.role ?? ""}
            className={inputClass}
          >
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

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </button>
    </form>
  );
}
