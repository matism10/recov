import "server-only";
import { createClient } from "@supabase/supabase-js";

// Acceso con la clave de servicio (SUPABASE_SERVICE_ROLE_KEY, solo servidor, nunca
// NEXT_PUBLIC_). Se salta RLS, así que expone una sola cosa: el correo de una
// persona. Se usa únicamente después de un review_member exitoso, que ya verificó
// que quien confirma es de la dirección del mismo club.

export async function getUserEmail(userId: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.warn("[admin] Falta SUPABASE_SERVICE_ROLE_KEY: no se puede leer el correo.");
    return null;
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) {
    console.error("[admin] No se pudo leer el correo del usuario:", error.message);
    return null;
  }
  return data.user?.email ?? null;
}
