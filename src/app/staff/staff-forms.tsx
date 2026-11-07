"use client";

import { useActionState, useState, useTransition } from "react";
import { ROLE_LABEL, STAFF_ROLES, type UserRole } from "@/lib/roles";
import {
  resetMemberPermissions,
  setHeadCoach,
  setKineDelegate,
  setMemberPermission,
  setNominaDelegate,
  setStaffRoles,
  setStaffSevens,
  type StaffState,
} from "./actions";
import { PERMISSION_GROUPS, type Permission } from "@/lib/permissions";
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
      {/* Head coach no es una casilla: se nombra con "Nombrar head coach" (con confirmación). */}
      {roles.includes("head_coach") && <input type="hidden" name="roles" value="head_coach" />}

      <fieldset>
        <legend className="sr-only">Roles de {name}</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {STAFF_ROLES.filter((r) => r !== "head_coach").map((r) => (
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
            ¿Quitar a {name} del staff? Perderá el acceso a los datos del plantel.
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

// Interruptores de permisos agrupados (detalle de /staff). Cada cambio se guarda al
// tocarlo; solo el head coach puede editarlos (readOnly para el manager).
export function PermissionSwitches({
  profileId,
  perms,
  defaults,
  readOnly,
}: {
  profileId: string;
  perms: Permission[];
  defaults: Permission[];
  readOnly: boolean;
}) {
  const [pendingKey, setPendingKey] = useState<Permission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(key: Permission, next: boolean) {
    setError(null);
    setPendingKey(key);
    startTransition(async () => {
      const res = await setMemberPermission(profileId, key, next);
      if (res.error) setError(res.error);
      setPendingKey(null);
    });
  }

  return (
    <div className="space-y-5">
      {PERMISSION_GROUPS.map((group) => (
        <fieldset key={group.title}>
          <legend className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
            {group.title}
          </legend>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
            {group.items.map(({ key, label }) => {
              const on = perms.includes(key);
              const changed = on !== defaults.includes(key);
              return (
                <li key={key} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
                  <span className="text-sm text-ink">
                    {label}
                    {changed && (
                      <span className="ml-2 text-xs text-muted">{on ? "· extra" : "· quitado"}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={label}
                    disabled={readOnly || pendingKey !== null}
                    onClick={() => toggle(key, !on)}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
                      on ? "bg-brand-strong" : "bg-line"
                    } ${pendingKey === key ? "animate-pulse" : ""}`}
                  >
                    <span
                      className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${
                        on ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </div>
  );
}

export function ResetPermissionsButton({ profileId }: { profileId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await resetMemberPermissions(profileId);
            setError(res.error ?? null);
          })
        }
        className={textButton}
      >
        {pending ? "Restableciendo…" : "Restablecer al rol"}
      </button>
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </div>
  );
}

// Nombrar head coach (con diálogo de confirmación) o, para el principal, quitarle el
// rol a un co-head coach.
export function HeadCoachButton({
  profileId,
  name,
  roles,
  mode,
}: {
  profileId: string;
  name: string;
  roles: UserRole[];
  mode: "nombrar" | "quitar";
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    startTransition(async () => {
      const res = await setHeadCoach(profileId, roles, mode === "nombrar");
      setError(res.error ?? null);
      if (!res.error) setConfirming(false);
    });
  }

  const question =
    mode === "nombrar"
      ? `¿Nombrar a ${name} head coach? Tendrá los mismos permisos que tú, incluido gestionar el staff y aprobar registros.`
      : `¿Quitarle a ${name} el rol de head coach? Conserva sus otros roles.`;

  return (
    <div className="space-y-2">
      {confirming ? (
        <div role="alertdialog" aria-label={question} className="space-y-3 rounded-xl border border-line bg-white p-4">
          <p className="text-sm text-ink">{question}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={run}
              className={`text-sm ${mode === "nombrar" ? buttonPrimary : buttonDanger}`}
            >
              {pending ? "Guardando…" : mode === "nombrar" ? "Sí, nombrar head coach" : "Sí, quitar head coach"}
            </button>
            <button type="button" disabled={pending} onClick={() => setConfirming(false)} className={textButton}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={mode === "nombrar" ? `text-sm ${buttonPrimary}` : textButton}
        >
          {mode === "nombrar" ? "Nombrar head coach" : "Quitar head coach"}
        </button>
      )}
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </div>
  );
}

// "Participa en Sevens" (solo rugby con Sevens activo; head coach y manager).
export function SevensSwitch({ profileId, enabled }: { profileId: string; enabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-2">
        <span className="text-sm text-ink">Participa en Sevens</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Participa en Sevens"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await setStaffSevens(profileId, !enabled);
              setError(res.error ?? null);
            })
          }
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
            enabled ? "bg-brand-strong" : "bg-line"
          } ${pending ? "animate-pulse" : ""}`}
        >
          <span
            className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </div>
  );
}
