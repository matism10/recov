"use client";

import {
  startTransition as startAction,
  useActionState,
  useId,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { resizeAvatar } from "@/app/avatar-resize";
import { Avatar } from "@/app/avatar";
import { PhoneField } from "@/app/phone-field";
import { PHONE_ERROR, formatPhone, normalizePhone } from "@/lib/phone";
import {
  ErrorMessage,
  SuccessMessage,
  buttonPrimary,
  buttonSecondary,
  inputClass,
  labelClass,
  optionalClass,
  textButton,
} from "@/app/ui";
import {
  changePassword,
  setAvatar,
  updatePhone,
  updateProfile,
  type PhoneState,
  type ProfileState,
} from "./actions";

const optional = <span className={optionalClass}>(opcional)</span>;

function Feedback({ state, pending }: { state: ProfileState; pending: boolean }) {
  if (state.error) return <ErrorMessage>{state.error}</ErrorMessage>;
  if (state.ok && !pending) return <SuccessMessage>Cambios guardados.</SuccessMessage>;
  return null;
}

// Foto: se achica en el navegador, se sube directo a Storage (carpeta propia)
// y set_my_avatar la deja en el perfil.
export function AvatarForm({
  name,
  url,
  folder,
}: {
  name: string;
  url: string | null;
  folder: string;
}) {
  const [preview, setPreview] = useState<string | null>(url);
  const [state, setState] = useState<ProfileState>({});
  const [pending, startTransition] = useTransition();

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    startTransition(async () => {
      setState({});
      let blob: Blob;
      try {
        blob = await resizeAvatar(file);
      } catch {
        setState({ error: "No pudimos leer esa imagen. Prueba con una foto JPG o PNG." });
        return;
      }
      const path = `${folder}/${crypto.randomUUID()}.jpg`;
      const { error } = await createClient()
        .storage.from("avatars")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (error) {
        setState({ error: "No se pudo subir la foto. Intenta de nuevo." });
        return;
      }
      const result = await setAvatar(path);
      if (result.ok) setPreview(URL.createObjectURL(blob));
      setState(result);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await setAvatar(null);
      if (result.ok) setPreview(null);
      setState(result);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <Avatar name={name} url={preview} size="lg" />
        <div className="flex flex-wrap gap-x-4">
          <label className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-brand-text underline">
            {preview ? "Cambia la foto" : "Agrega una foto"}
            <input
              type="file"
              accept="image/*"
              onChange={pick}
              disabled={pending}
              className="sr-only"
            />
          </label>
          {preview && (
            <button type="button" onClick={remove} disabled={pending} className={textButton}>
              Quita la foto
            </button>
          )}
        </div>
      </div>
      {pending && <p className="text-sm text-muted">Guardando…</p>}
      <Feedback state={state} pending={pending} />
    </div>
  );
}

export type PlayerFields = {
  position: string | null;
  secondaryPosition: string | null;
  heightCm: number | null;
  weightKg: number | null;
};

export function ProfileForm({
  firstName,
  lastName,
  player,
  positions,
}: {
  firstName: string;
  lastName: string;
  player: PlayerFields | null;
  positions: string[];
}) {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(
    updateProfile,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="is_player" value={player ? "1" : "0"} />

      <div className="grid grid-cols-2 gap-3">
        <label className={labelClass}>
          Nombre
          <input
            name="first_name"
            required
            maxLength={100}
            autoComplete="given-name"
            defaultValue={firstName}
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
            defaultValue={lastName}
            className={inputClass}
          />
        </label>
      </div>

      {player && (
        <>
          <label className={labelClass}>
            Posición principal
            <select
              name="position"
              required
              defaultValue={player.position ?? ""}
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
              defaultValue={player.secondaryPosition ?? ""}
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
                defaultValue={player.heightCm ?? ""}
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
                defaultValue={player.weightKg ?? ""}
                className={inputClass}
              />
            </label>
          </div>
        </>
      )}

      <Feedback state={state} pending={pending} />

      <button type="submit" disabled={pending} className={`w-full ${buttonPrimary}`}>
        {pending ? "Guardando…" : "Guarda los cambios"}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(
    changePassword,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
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
      </div>

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      {state.ok && !pending && <SuccessMessage>Contraseña actualizada.</SuccessMessage>}

      <button type="submit" disabled={pending} className={`w-full ${buttonSecondary}`}>
        {pending ? "Guardando…" : "Cambia la contraseña"}
      </button>
    </form>
  );
}

// Teléfono del jugador: se valida y normaliza antes de enviar (la acción lo
// revisa de nuevo). "Quita" lo borra.
export function PhoneForm({ phone }: { phone: string | null }) {
  const [state, formAction, pending] = useActionState<PhoneState, FormData>(updatePhone, {
    phone: phone ?? "",
  });
  const [clientError, setClientError] = useState<string | null>(null);
  const id = useId();
  const saved = state.phone ?? "";
  const error = clientError ?? state.error ?? null;

  // Validar en onSubmit: si se cortara dentro de la acción, React igual limpia el campo.
  function validate(e: FormEvent<HTMLFormElement>) {
    const input = e.currentTarget.elements.namedItem("phone");
    if (input instanceof HTMLInputElement && normalizePhone(input.value) === null) {
      e.preventDefault();
      setClientError(PHONE_ERROR);
      input.focus();
    }
  }

  function submit(formData: FormData) {
    setClientError(null);
    formData.set("phone", normalizePhone(String(formData.get("phone") ?? "")) ?? "");
    formAction(formData);
  }

  function remove() {
    setClientError(null);
    const formData = new FormData();
    formData.set("phone", "");
    startAction(() => formAction(formData));
  }

  return (
    <form action={submit} onSubmit={validate} className="space-y-4">
      {/* key: tras guardar, el campo muestra el número ya normalizado */}
      <PhoneField
        key={saved}
        id={id}
        defaultValue={saved ? formatPhone(saved) : ""}
        error={error}
        onChange={() => clientError && setClientError(null)}
        disabled={pending}
      />
      {state.ok && !pending && !clientError && (
        <SuccessMessage>{saved ? "Teléfono guardado." : "Teléfono quitado."}</SuccessMessage>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={`flex-1 ${buttonSecondary}`}>
          {pending ? "Guardando…" : "Guarda el teléfono"}
        </button>
        {saved && (
          <button type="button" onClick={remove} disabled={pending} className={textButton}>
            Quita
          </button>
        )}
      </div>
    </form>
  );
}
