"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const MIN_PASSWORD = 6;

// sessionReady: el link ya se usó y abrió la sesión; el siguiente intento no lo vuelve a usar.
export type ResetState = { error?: string; sessionReady?: boolean };

// Usa el link de recuperación (verifyOtp abre la sesión de esa cuenta) y guarda la
// contraseña nueva en el mismo paso. El link se consume aquí y no al abrir la
// página, así que los antivirus de correo que visitan links no lo gastan.
export async function resetPassword(prev: ResetState, formData: FormData): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < MIN_PASSWORD) {
    return { ...prev, error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` };
  }
  if (password !== confirm) return { ...prev, error: "Las contraseñas no coinciden." };

  const supabase = await createClient();
  if (token) {
    const { error: otpError } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: token });
    if (otpError) redirect("/recuperar?error=link");
  } else {
    // Reintento tras un error: la sesión ya la abrió el link.
    const { data } = await supabase.auth.getUser();
    if (!data.user) redirect("/recuperar?error=link");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      sessionReady: true,
      error:
        error.code === "same_password"
          ? "La contraseña nueva debe ser distinta de la anterior."
          : error.code === "weak_password"
            ? "La contraseña es muy débil. Prueba con una más larga."
            : "No se pudo guardar la contraseña. Intenta de nuevo.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
