import { redirect } from "next/navigation";
import { getProfile, getSessionUser, getSupabase } from "@/lib/session";
import type { UserRole } from "@/lib/roles";
import type { NominaMode } from "@/lib/match-load";

// Usuario confirmado del club, o redirección: sin sesión a /login, pendiente a
// /pendiente y el resto al Resumen.
export async function requireMember() {
  // Sesión y perfil compartidos con el layout en el mismo request (src/lib/session.ts).
  const supabase = await getSupabase();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  if (profile?.status === "pendiente") redirect("/pendiente");
  if (!profile || profile.status !== "confirmado") redirect("/dashboard");

  const club = profile.club;
  return {
    supabase,
    userId: user.id,
    roles: (profile.roles ?? []) as UserRole[],
    club: club as {
      name: string;
      sport: string;
      nomina_delegate_id: string | null;
      nomina_mode: NominaMode;
    } | null,
  };
}
