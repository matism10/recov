"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClubId, getSessionUser } from "@/lib/session";
import { STAFF_ROLES, type UserRole } from "@/lib/roles";

export type StaffState = { ok?: boolean; error?: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Plantel activo de quien hace el cambio, explícito para las funciones (p_club_id).
async function activeClub() {
  const user = await getSessionUser();
  return user ? getActiveClubId(user.id) : null;
}

function errorMessage(error: { code?: string; message: string }, fallback: string) {
  // P0001: excepción propia de la función, con mensaje en español.
  return error.code === "P0001" ? error.message : fallback;
}

// Cambia los roles de un miembro del staff, o lo quita del staff (decision = "quitar").
// set_staff_roles verifica que quien llama sea de la dirección, que no se modifique
// a sí mismo y que la persona sea staff confirmado del mismo club.
export async function setStaffRoles(
  _prevState: StaffState,
  formData: FormData,
): Promise<StaffState> {
  const profileId = String(formData.get("profile_id") ?? "");
  const remove = formData.get("decision") === "quitar";
  const roles = formData.getAll("roles").map(String);

  if (!UUID_RE.test(profileId)) return { error: "Persona no válida." };
  if (!roles.every((r) => (STAFF_ROLES as readonly string[]).includes(r))) {
    return { error: "Rol no válido." };
  }
  if (!remove && roles.length === 0) {
    return { error: "Elige al menos un rol, o usa “Quitar del staff”." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_staff_roles", {
    p_profile_id: profileId,
    p_roles: remove ? [] : (roles as UserRole[]),
    p_club_id: await activeClub(),
  });
  if (error) return { error: errorMessage(error, "No se pudieron guardar los cambios.") };

  revalidatePath("/staff");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Delega las funciones de kinesiólogo en alguien del staff, o quita la delegación
// (profile_id vacío). set_kine_delegate verifica el permiso y que sea staff confirmado.
export async function setKineDelegate(
  _prevState: StaffState,
  formData: FormData,
): Promise<StaffState> {
  const profileId = String(formData.get("profile_id") ?? "");
  if (profileId && !UUID_RE.test(profileId)) return { error: "Persona no válida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_kine_delegate", {
    p_profile_id: profileId || null,
    p_club_id: await activeClub(),
  });
  if (error) return { error: errorMessage(error, "No se pudo guardar la delegación.") };

  revalidatePath("/staff");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Delega las nóminas (convocatoria y participación) en alguien del staff, o quita
// la delegación (profile_id vacío). set_nomina_delegate verifica el permiso y que
// sea staff confirmado del club.
export async function setNominaDelegate(
  _prevState: StaffState,
  formData: FormData,
): Promise<StaffState> {
  const profileId = String(formData.get("profile_id") ?? "");
  if (profileId && !UUID_RE.test(profileId)) return { error: "Persona no válida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_nomina_delegate", {
    p_profile_id: profileId || null,
    p_club_id: await activeClub(),
  });
  if (error) return { error: errorMessage(error, "No se pudo guardar la delegación.") };

  revalidatePath("/staff");
  revalidatePath("/calendario");
  return { ok: true };
}
