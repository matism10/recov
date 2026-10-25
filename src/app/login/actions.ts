"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_CLUB_COOKIE } from "@/lib/active-club";

const SLUG_RE = /^[a-z0-9-]{1,80}$/;

// Inicia sesión. Desde el link de un plantel (/c/[slug], pestaña "Iniciar sesión")
// llega el slug: se vuelve a ese link, que decide si entra, espera o se une. Desde
// /login entra al plantel activo (el proxy lo valida y, si hace falta, elige otro).
export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const slugRaw = String(formData.get("slug") ?? "");
  const slug = SLUG_RE.test(slugRaw) ? slugRaw : null;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(slug ? `/c/${slug}?tab=login&error=1` : "/login?error=1");
  }
  // El layout (sidebar) no se vuelve a renderizar al navegar: se refresca al entrar.
  revalidatePath("/", "layout");
  redirect(slug ? `/c/${slug}` : "/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // El plantel activo es de la cuenta que sale: no debe pasar a la siguiente.
  (await cookies()).delete(ACTIVE_CLUB_COOKIE);
  revalidatePath("/", "layout");
  redirect("/login");
}
