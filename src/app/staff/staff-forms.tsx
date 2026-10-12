"use client";

import { useActionState, useState } from "react";
import { ROLE_LABEL, STAFF_ROLES, type UserRole } from "@/lib/roles";
import { setKineDelegate, setStaffRoles, type StaffState } from "./actions";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200";
const primaryButton =
  "rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60";

function Feedback({ state, pending }: { state: StaffState; pending: boolean }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {state.error}
      </p>
    );
  }
  if (state.ok && !pending) {
    return (
      <p role="status" className="text-sm text-emerald-700">
        Cambios guardados.
      </p>
    );
  }
  return null;
}

export function DelegateForm({
  staff,
  currentDelegateId,
}: {
  staff: { id: string; full_name: string | null }[];
  currentDelegateId: string | null;
}) {
  const [state, formAction, pending] = useActionState<StaffState, FormData>(
    setKineDelegate,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <select
          name="profile_id"
          defaultValue={currentDelegateId ?? ""}
          key={currentDelegateId ?? ""}
          aria-label="Persona con funciones de kinesiólogo"
          className={`${inputClass} sm:w-72`}
        >
          <option value="">Sin delegación</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
      <Feedback state={state} pending={pending} />
    </form>
  );
}

export function RolesForm({
  profileId,
  name,
  roles,
}: {
  profileId: string;
  name: string;
  roles: UserRole[];
}) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [state, formAction, pending] = useActionState<StaffState, FormData>(
    setStaffRoles,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="profile_id" value={profileId} />

      <fieldset>
        <legend className="sr-only">Roles de {name}</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {STAFF_ROLES.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="roles"
                value={r}
                defaultChecked={roles.includes(r)}
                disabled={pending}
                className="size-4 accent-emerald-600"
              />
              {ROLE_LABEL[r]}
            </label>
          ))}
        </div>
      </fieldset>

      {confirmingRemove ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-600">
            ¿Quitar a {name} del staff? Perderá el acceso a los datos del club.
          </span>
          <button
            type="submit"
            name="decision"
            value="quitar"
            disabled={pending}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Sí, quitar"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingRemove(false)}
            disabled={pending}
            className="text-sm text-slate-500 underline"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            name="decision"
            value="guardar"
            disabled={pending}
            className={primaryButton}
          >
            {pending ? "Guardando…" : "Guardar roles"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingRemove(true)}
            disabled={pending}
            className="text-sm text-slate-500 underline"
          >
            Quitar del staff
          </button>
        </div>
      )}

      <Feedback state={state} pending={pending} />
    </form>
  );
}
