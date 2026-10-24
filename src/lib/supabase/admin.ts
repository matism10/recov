import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Acceso con la clave de servicio (SUPABASE_SERVICE_ROLE_KEY, solo servidor, nunca
// NEXT_PUBLIC_). Se salta RLS, así que expone solo lo justo para los correos de
// cuenta; cada función la llama una acción que ya verificó quién pide qué:
// - getUserEmail: tras un review_member exitoso (aviso de aprobación).
// - createEmailVerificationToken: para el propio usuario recién registrado o que
//   pide reenviar su verificación (la acción usa su sesión).
// - allowAuthEmail: límite de correos de verificación y recuperación.
// - createRecoveryTokenHash: link para recuperar contraseña (no dice si la cuenta existe).

function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.warn("[admin] Falta SUPABASE_SERVICE_ROLE_KEY.");
    return null;
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getUserEmail(userId: string): Promise<string | null> {
  const admin = adminClient();
  if (!admin) return null;
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) {
    console.error("[admin] No se pudo leer el correo del usuario:", error.message);
    return null;
  }
  return data.user?.email ?? null;
}

// Token nuevo para el link "Verifica tu correo" (reemplaza al anterior).
// null si la cuenta ya está verificada o si algo falla.
export async function createEmailVerificationToken(profileId: string): Promise<string | null> {
  const admin = adminClient();
  if (!admin) return null;
  const { data, error } = await admin.rpc("create_email_verification", { p_profile_id: profileId });
  if (error) {
    console.error("[admin] No se pudo crear el token de verificación:", error.message);
    return null;
  }
  return (data as string | null) ?? null;
}

// true si se puede mandar otro correo de ese tipo a ese correo (1 por minuto, 5 por hora).
export async function allowAuthEmail(
  email: string,
  kind: "verificacion" | "recuperacion",
): Promise<boolean> {
  const admin = adminClient();
  if (!admin) return false;
  const { data, error } = await admin.rpc("allow_auth_email", { p_email: email, p_kind: kind });
  if (error) {
    console.error("[admin] No se pudo revisar el límite de correos:", error.message);
    return false;
  }
  return data === true;
}

// Token (hash) para el link de recuperar contraseña; null si no hay cuenta con ese
// correo o si algo falla. El correo lo envía la app, no Supabase.
export async function createRecoveryTokenHash(email: string): Promise<string | null> {
  const admin = adminClient();
  if (!admin) return null;
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error) return null; // Sin cuenta con ese correo (o error): no se envía nada.
  return data.properties?.hashed_token ?? null;
}
