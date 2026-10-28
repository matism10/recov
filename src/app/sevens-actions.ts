"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SEVENS_POSITIONS } from "@/lib/sevens";

export type SevensState = { ok?: boolean; error?: string };

// Activa o desactiva Sevens en el plantel activo. set_club_sevens valida que quien
// llama sea de la dirección y que el club sea de rugby.
export async function setClubSevens(_prev: SevensState, formData: FormData): Promise<SevensState> {
  const enabled = formData.get("enabled") === "true";
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_club_sevens", { p_enabled: enabled });
  if (error) {
    return {
      error:
        error.code === "42501"
          ? "Solo el head coach o el manager activan Sevens."
          : "No se pudo guardar el cambio.",
    };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// Arma el grupo Sevens con la lista completa (los que salen quedan archivados y, si
// vuelven, conservan su posición). set_sevens_group valida dirección y membresías.
export async function setSevensGroup(memberIds: string[]): Promise<SevensState> {
  const ids = [...new Set(memberIds)].filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_sevens_group", { p_member_ids: ids });
  if (error) {
    return {
      error:
        error.code === "42501"
          ? "Solo el head coach o el manager arman el grupo Sevens."
          : "No se pudo guardar el grupo. Revisa que Sevens esté activo.",
    };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// La posición propia en Sevens (principal obligatoria, secundaria opcional y distinta).
export async function setMySevensPosition(_prev: SevensState, formData: FormData): Promise<SevensState> {
  const position = String(formData.get("position") ?? "");
  const secondary = String(formData.get("secondary") ?? "") || null;
  const valid = SEVENS_POSITIONS as readonly string[];
  if (!valid.includes(position)) return { error: "Elige tu posición principal." };
  if (secondary && (!valid.includes(secondary) || secondary === position)) {
    return { error: "La posición secundaria debe ser distinta de la principal." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_sevens_position", {
    p_position: position,
    p_secondary: secondary,
  });
  if (error) {
    return {
      error: error.code === "42501" ? "No estás en el grupo Sevens." : "No se pudo guardar tu posición.",
    };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
