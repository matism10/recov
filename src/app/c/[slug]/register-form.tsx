"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { ROLE_LABEL, STAFF_SIGNUP_ROLES } from "@/lib/roles";
import { resizeAvatar } from "@/app/avatar-resize";
import { registerMember, type RegisterState } from "./actions";
import { ErrorMessage, buttonPrimary, inputClass, labelClass, optionalClass, textButton } from "@/app/ui";

type Kind = "jugador" | "staff";

const optional = <span className={optionalClass}>(opcional)</span>;

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
  const [avatar, setAvatar] = useState<Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  async function pickAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarError(null);
    try {
      const blob = await resizeAvatar(file);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatar(blob);
      setAvatarPreview(URL.createObjectURL(blob));
    } catch {
      setAvatarError("No pudimos leer esa imagen. Prueba con una foto JPG o PNG.");
    }
  }

  function removeAvatar() {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatar(null);
    setAvatarPreview(null);
  }

  // La foto ya achicada viaja en el FormData; el input de archivo no tiene name.
  function submit(formData: FormData) {
    if (avatar) formData.set("avatar", avatar, "foto.jpg");
    formAction(formData);
  }

  if (!kind) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {(["jugador", "staff"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className="min-h-11 rounded-xl border border-line bg-white px-4 py-3 font-medium text-ink transition hover:border-brand-strong hover:bg-brand-soft"
          >
            {k === "jugador" ? "Soy jugador" : "Soy staff"}
          </button>
        ))}
      </div>
    );
  }

  return (
    <form action={submit} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="kind" value={kind} />

      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-ink">
          {kind === "jugador" ? "Registro de jugador" : "Registro de staff"}
        </span>
        <button
          type="button"
          onClick={() => setKind(null)}
          disabled={pending}
          className={textButton}
        >
          Cambia
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-brand-text">
          {avatarPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarPreview} alt="Tu foto de perfil" className="h-full w-full object-cover" />
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8" aria-hidden="true">
              <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4 0-7 2-7 4.5V20h14v-1.5C19 16 16 14 12 14Z" />
            </svg>
          )}
        </div>
        <div className="text-sm">
          <span className="block font-medium text-ink">Foto de perfil {optional}</span>
          <div className="mt-1 flex gap-3">
            <label className="inline-flex min-h-11 cursor-pointer items-center font-medium text-brand-text underline">
              {avatar ? "Cambia la foto" : "Agrega una foto"}
              <input
                type="file"
                accept="image/*"
                onChange={pickAvatar}
                disabled={pending}
                className="sr-only"
              />
            </label>
            {avatar && (
              <button
                type="button"
                onClick={removeAvatar}
                disabled={pending}
                className={textButton}
              >
                Quita
              </button>
            )}
          </div>
          {avatarError && <ErrorMessage className="mt-1">{avatarError}</ErrorMessage>}
        </div>
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

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}

      <button
        type="submit"
        disabled={pending}
        className={`w-full ${buttonPrimary}`}
      >
        {pending ? "Creando cuenta…" : "Crea tu cuenta"}
      </button>
    </form>
  );
}
