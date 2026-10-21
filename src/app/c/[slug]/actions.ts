"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STAFF_SIGNUP_ROLES, type StaffSignupRole } from "@/lib/roles";
import { PHONE_ERROR, normalizePhone } from "@/lib/phone";

const MAX_NAME = 100;
const MIN_PASSWORD = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RegisterFields = {
  email: string;
  firstName: string;
  lastName: string;
  position: string;
  secondaryPosition: string;
  height: string;
  weight: string;
  phone: string;
  role: string;
};

export type RegisterState = {
  error?: string;
  fields?: RegisterFields;
};

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function registerMember(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const slug = text(formData, "slug");
  const kind = text(formData, "kind");
  const password = String(formData.get("password") ?? "");
  const fields: RegisterFields = {
    email: text(formData, "email").toLowerCase(),
    firstName: text(formData, "first_name"),
    lastName: text(formData, "last_name"),
    position: text(formData, "position"),
    secondaryPosition: text(formData, "secondary_position"),
    height: text(formData, "height_cm"),
    weight: text(formData, "weight_kg").replace(",", "."),
    phone: text(formData, "phone"),
    role: text(formData, "role"),
  };
  const fail = (error: string): RegisterState => ({ error, fields });

  // Validación previa: se replica lo que exige register_member para no crear
  // una cuenta que después no se pueda registrar en el club.
  if (kind !== "jugador" && kind !== "staff") {
    return fail("Elige si eres jugador o staff.");
  }
  if (!EMAIL_RE.test(fields.email)) return fail("Ingresa un correo válido.");
  if (password.length < MIN_PASSWORD) {
    return fail(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
  }
  if (!fields.firstName || !fields.lastName) {
    return fail("Nombre y apellido son obligatorios.");
  }
  if (fields.firstName.length > MAX_NAME || fields.lastName.length > MAX_NAME) {
    return fail(`Nombre y apellido no pueden superar los ${MAX_NAME} caracteres.`);
  }

  const supabase = await createClient();

  const { data: club } = await supabase
    .rpc("club_public_info", { p_slug: slug })
    .maybeSingle<{ name: string; sport: string }>();
  if (!club) return fail("Este link no es válido.");

  let height: number | null = null;
  let weight: number | null = null;
  let phone = "";

  if (kind === "jugador") {
    const { data: positions } = await supabase
      .from("positions")
      .select("name")
      .eq("sport", club.sport);
    const valid = new Set((positions ?? []).map((p) => p.name as string));

    if (!valid.has(fields.position)) {
      return fail("Elige tu posición principal.");
    }
    if (fields.secondaryPosition) {
      if (!valid.has(fields.secondaryPosition)) {
        return fail("La posición secundaria no es válida.");
      }
      if (fields.secondaryPosition === fields.position) {
        return fail("La posición secundaria debe ser distinta de la principal.");
      }
    }
    if (fields.height) {
      height = Number(fields.height);
      if (!Number.isInteger(height) || height < 100 || height > 250) {
        return fail("La altura debe ser un número entero entre 100 y 250 cm.");
      }
    }
    if (fields.weight) {
      weight = Number(fields.weight);
      if (!Number.isFinite(weight) || weight < 30 || weight > 250) {
        return fail("El peso debe estar entre 30 y 250 kg.");
      }
      weight = Math.round(weight * 10) / 10;
    }
    const normalized = normalizePhone(fields.phone);
    if (normalized === null) return fail(PHONE_ERROR);
    phone = normalized;
  } else if (!STAFF_SIGNUP_ROLES.includes(fields.role as StaffSignupRole)) {
    return fail("Elige tu puesto.");
  }

  // Crear la cuenta. Si el correo ya existe (por ejemplo, un intento anterior
  // en que la cuenta se creó pero el registro falló), se inicia sesión con esa
  // contraseña para completar el registro.
  const { data: signUp, error: signUpError } = await supabase.auth.signUp({
    email: fields.email,
    password,
  });

  if (signUpError) {
    if (
      signUpError.code !== "user_already_exists" &&
      signUpError.code !== "email_exists"
    ) {
      return fail(
        signUpError.code === "weak_password"
          ? "La contraseña es muy débil. Prueba con una más larga."
          : "No se pudo crear la cuenta. Intenta de nuevo.",
      );
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: fields.email,
      password,
    });
    if (signInError) {
      return fail(
        "Ese correo ya tiene una cuenta. Usa su contraseña o ingresa desde el login.",
      );
    }
  } else if (!signUp.session) {
    return fail(
      "La cuenta se creó, pero hay que confirmar el correo antes de continuar. Revisa tu bandeja y vuelve a este link.",
    );
  }

  const { error: rpcError } = await supabase.rpc("register_member", {
    p_club_slug: slug,
    p_kind: kind,
    p_first_name: fields.firstName,
    p_last_name: fields.lastName,
    ...(kind === "jugador"
      ? {
          p_position: fields.position,
          p_secondary_position: fields.secondaryPosition || null,
          p_height_cm: height,
          p_weight_kg: weight,
        }
      : { p_requested_role: fields.role }),
  });

  if (rpcError) {
    // No dejar una sesión abierta sin perfil. Reintentar con el mismo correo
    // y contraseña completa el registro.
    await supabase.auth.signOut();
    // P0001: excepción propia de register_member, con mensaje en español.
    return fail(
      rpcError.code === "P0001"
        ? rpcError.message
        : "No se pudo completar el registro. Intenta de nuevo.",
    );
  }

  // Foto de perfil opcional: si falla, el registro ya quedó hecho y se sigue.
  const avatar = formData.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    await saveAvatar(supabase, avatar);
  }

  // Teléfono opcional (solo jugadores): si no se guarda, el registro ya quedó
  // hecho; /pendiente avisa que se puede agregar después.
  if (phone) {
    const { error: phoneError } = await supabase.rpc("set_my_phone", { p_phone: phone });
    if (phoneError) redirect("/pendiente?telefono=no-guardado");
  }

  redirect("/pendiente");
}

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

async function saveAvatar(
  supabase: Awaited<ReturnType<typeof createClient>>,
  avatar: File,
) {
  if (avatar.size > AVATAR_MAX_BYTES || !AVATAR_TYPES.includes(avatar.type)) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .maybeSingle<{ club_id: string }>();
  if (!profile) return;

  const ext = avatar.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${profile.club_id}/${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, avatar, { contentType: avatar.type, upsert: false });
  if (error) return;

  await supabase.rpc("set_my_avatar", { p_path: path });
}
