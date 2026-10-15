"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ProfileState = { ok?: boolean; error?: string };

const MAX_NAME = 100;
const MIN_PASSWORD = 6;

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function done() {
  revalidatePath("/perfil");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Nombre y apellido para todos; posición, altura y peso solo cuentan si la
// cuenta es de un jugador. update_my_profile valida todo y el trigger de 0016
// valida la posición contra el deporte del club.
export async function updateProfile(
  _prevState: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const firstName = text(formData, "first_name");
  const lastName = text(formData, "last_name");
  const isPlayer = formData.get("is_player") === "1";

  if (!firstName || !lastName) return { error: "Nombre y apellido son obligatorios." };
  if (firstName.length > MAX_NAME || lastName.length > MAX_NAME) {
    return { error: `Nombre y apellido no pueden superar los ${MAX_NAME} caracteres.` };
  }

  let player = {};
  if (isPlayer) {
    const position = text(formData, "position");
    const secondary = text(formData, "secondary_position");
    const heightRaw = text(formData, "height_cm");
    const weightRaw = text(formData, "weight_kg").replace(",", ".");
    if (!position) return { error: "Elige tu posición principal." };
    if (secondary && secondary === position) {
      return { error: "La posición secundaria debe ser distinta de la principal." };
    }
    const height = heightRaw ? Number(heightRaw) : null;
    if (height !== null && (!Number.isInteger(height) || height < 100 || height > 250)) {
      return { error: "La altura debe ser un número entero entre 100 y 250 cm." };
    }
    let weight = weightRaw ? Number(weightRaw) : null;
    if (weight !== null) {
      if (!Number.isFinite(weight) || weight < 30 || weight > 250) {
        return { error: "El peso debe estar entre 30 y 250 kg." };
      }
      weight = Math.round(weight * 10) / 10;
    }
    player = {
      p_position: position,
      p_secondary_position: secondary || null,
      p_height_cm: height,
      p_weight_kg: weight,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_profile", {
    p_first_name: firstName,
    p_last_name: lastName,
    ...player,
  });
  if (error) {
    // P0001: mensaje propio de la función. 23514: el trigger rechazó la posición.
    if (error.code === "P0001") return { error: error.message };
    if (error.code === "23514") {
      return { error: "La posición no es válida para el deporte de tu club." };
    }
    return { error: "No se pudieron guardar los cambios. Intenta de nuevo." };
  }
  return done();
}

export async function changePassword(
  _prevState: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < MIN_PASSWORD) {
    return { error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` };
  }
  if (password !== confirm) return { error: "Las contraseñas no coinciden." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      error:
        error.code === "weak_password"
          ? "La contraseña es muy débil. Prueba con una más larga."
          : error.code === "same_password"
            ? "La contraseña nueva debe ser distinta de la actual."
            : "No se pudo cambiar la contraseña. Intenta de nuevo.",
    };
  }
  return { ok: true };
}

// Fija la foto ya subida al bucket avatars, o la quita (path vacío).
// set_my_avatar verifica que la ruta sea del propio usuario y que el archivo exista.
export async function setAvatar(path: string | null): Promise<ProfileState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_avatar", { p_path: path });
  if (error) {
    return {
      error: error.code === "P0001" ? error.message : "No se pudo guardar la foto.",
    };
  }
  return done();
}
