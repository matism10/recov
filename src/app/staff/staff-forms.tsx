"use client";

import { useActionState, useState } from "react";
import { ROLE_LABEL, STAFF_ROLES, type UserRole } from "@/lib/roles";
import { setKineDelegate, setNominaDelegate, setStaffRoles, type StaffState } from "./actions";
import {
  ErrorMessage,
  SuccessMessage,
  buttonDanger,
  buttonPrimary,
  fieldClass,
  textButton,
} from "@/app/ui";

const primaryButton = `text-sm ${buttonPrimary}`;

function Feedback({ state, pending }: { state: StaffState; pending: boolean }) {
  if (state.error) {
    return <ErrorMessage>{state.error}</ErrorMessage>;
  }
  if (state.ok && !pending) {
    return <SuccessMessage>Cambios guardados.</SuccessMessage>;
  }
  return null;
}

// Delegación de funciones en alguien del staff: kinesiólogo o nóminas.
const DELEGATE_ACTIONS = { kine: setKineDelegate, nomina: setNominaDelegate };
const DELEGATE_LABEL = {
  kine: "Persona con funciones de kinesiólogo",
  nomina: "Persona que arma las nóminas",
};

export function DelegateForm({
  staff,
  currentDelegateId,
  kind = "kine",
}: {
  staff: { id: string; full_name: string | null }[];
  currentDelegateId: string | null;
  kind?: keyof typeof DELEGATE_ACTIONS;
}) {
  const [state, formAction, pending] = useActionState<StaffState, FormData>(
    DELEGATE_ACTIONS[kind],
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <select
          name="profile_id"
          defaultValue={currentDelegateId ?? ""}
          key={currentDelegateId ?? ""}
          aria-label={DELEGATE_LABEL[kind]}
          className={`${fieldClass} sm:w-72`}
        >
          <option value="">Sin delegación</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Guardando…" : "Guarda la delegación"}
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
            <label key={r} className="flex min-h-11 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="roles"
                value={r}
                defaultChecked={roles.includes(r)}
                disabled={pending}
                className="size-4 accent-brand-strong"
              />
              {ROLE_LABEL[r]}
            </label>
          ))}
        </div>
      </fieldset>

      {confirmingRemove ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted">
            ¿Quitar a {name} del staff? Perderá el acceso a los datos del club.
          </span>
          <button
            type="submit"
            name="decision"
            value="quitar"
            disabled={pending}
            className={`text-sm ${buttonDanger}`}
          >
            {pending ? "Guardando…" : "Sí, quita del staff"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingRemove(false)}
            disabled={pending}
            className={textButton}
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
            {pending ? "Guardando…" : "Guarda los roles"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingRemove(true)}
            disabled={pending}
            className={textButton}
          >
            Quita del staff
          </button>
        </div>
      )}

      <Feedback state={state} pending={pending} />
    </form>
  );
}
