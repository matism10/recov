"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ReviewState = { error?: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function reviewMember(
  _prevState: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const profileId = String(formData.get("profile_id") ?? "");
  const decision = String(formData.get("decision") ?? "");

  if (!UUID_RE.test(profileId)) return { error: "Registro no válido." };
  if (decision !== "confirmar" && decision !== "rechazar") {
    return { error: "Decisión no válida." };
  }

  // review_member verifica que quien llama sea de la dirección y del mismo club.
  // En el staff asigna el puesto solicitado.
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_member", {
    p_profile_id: profileId,
    p_decision: decision,
  });

  if (error) {
    // P0001: excepción propia de review_member, con mensaje en español.
    return {
      error:
        error.code === "P0001"
          ? error.message
          : "No se pudo guardar la decisión. Intenta de nuevo.",
    };
  }

  revalidatePath("/registros");
  revalidatePath("/dashboard");
  return {};
}
