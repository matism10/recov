import { createClient } from "@/lib/supabase/server";
import { isDirection, type UserRole } from "@/lib/roles";
import { getAvatarUrls } from "@/lib/avatars";
import { SidebarNav } from "./sidebar-nav";

// Navegación lateral de escritorio (lg+). Solo para usuarios confirmados: sin sesión,
// pendientes o rechazados no la ven. Las páginas siguen validando su propio acceso.
export async function Sidebar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Desde 0005 hay dos relaciones profiles–clubs: hay que nombrar la FK.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, roles, status, clubs!profiles_club_id_fkey(name)")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.status !== "confirmado") return null;

  const club = Array.isArray(profile.clubs) ? profile.clubs[0] : profile.clubs;
  const direction = isDirection((profile.roles ?? []) as UserRole[]);

  // RLS: solo la dirección ve perfiles pendientes.
  let pendingCount = 0;
  if (direction) {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendiente");
    pendingCount = count ?? 0;
  }
  const avatarUrl = (await getAvatarUrls(supabase, [user.id])).get(user.id) ?? null;

  return (
    <SidebarNav
      clubName={club?.name ?? ""}
      fullName={profile.full_name ?? ""}
      avatarUrl={avatarUrl}
      direction={direction}
      pendingCount={pendingCount}
    />
  );
}
