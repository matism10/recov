import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/roles";

// Usuario confirmado del club, o redirección: sin sesión a /login, pendiente a
// /pendiente y el resto al Resumen.
export async function requireMember() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Desde 0005 hay dos relaciones profiles–clubs: hay que nombrar la FK.
  const { data: profile } = await supabase
    .from("profiles")
    .select("roles, status, clubs!profiles_club_id_fkey(name, sport)")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.status === "pendiente") redirect("/pendiente");
  if (profile?.status !== "confirmado") redirect("/dashboard");

  const club = Array.isArray(profile.clubs) ? profile.clubs[0] : profile.clubs;
  return {
    supabase,
    roles: (profile.roles ?? []) as UserRole[],
    club: club as { name: string; sport: string } | null,
  };
}
