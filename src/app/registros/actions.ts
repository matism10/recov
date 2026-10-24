"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { getUserEmail } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { approvedEmail } from "./approved-email";
import { appOrigin } from "@/lib/email-layout";

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
  const supabase = await getSupabase();
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

  // La decisión ya quedó guardada. Al confirmar, se avisa por correo; si el
  // correo falla, la confirmación se mantiene y la dirección ve un aviso.
  const emailSent = decision === "confirmar" ? await notifyApproved(profileId) : true;

  revalidatePath("/registros");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout"); // contador de pendientes del sidebar
  // La fila revisada desaparece de la lista, así que el aviso va arriba de la página.
  redirect(emailSent ? "/registros" : "/registros?correo=no-enviado");
}

async function notifyApproved(profileId: string): Promise<boolean> {
  try {
    const supabase = await getSupabase();
    const [user, email, { data: member }, origin] = await Promise.all([
      getSessionUser(),
      getUserEmail(profileId),
      // RLS: la dirección lee los perfiles de su club.
      supabase.from("profiles").select("full_name").eq("id", profileId).maybeSingle(),
      appOrigin(),
    ]);
    if (!email || !user) return false;

    const me = await getProfile(user.id);
    const loginUrl = `${origin}/login`;

    const result = await sendEmail(
      approvedEmail({
        to: email,
        fullName: (member?.full_name as string | null) ?? null,
        clubName: me?.club?.name ?? "Tu club",
        loginUrl,
      }),
    );
    return result.ok;
  } catch (error) {
    console.error("[registros] Aviso por correo:", error instanceof Error ? error.message : error);
    return false;
  }
}
