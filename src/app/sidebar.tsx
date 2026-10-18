import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isDirection, isStaff, type UserRole } from "@/lib/roles";
import { getAvatarUrls } from "@/lib/avatars";
import { clubLogoUrl } from "@/lib/club-logo";
import { SidebarNav } from "./sidebar-nav";
import { MobileNavBar } from "./mobile-nav";
import { ClubHeader as ClubHeaderBar } from "./club-header";
import { getClubIdentity } from "@/lib/club-identity";

// Datos de la navegación (sidebar de escritorio y barra móvil). Solo para usuarios
// confirmados: sin sesión, pendientes o rechazados no ven navegación. Las páginas
// siguen validando su propio acceso. `cache` evita repetir las consultas cuando
// varias piezas de la navegación las piden en el mismo request.
const getNavData = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Desde 0005 hay dos relaciones profiles–clubs: hay que nombrar la FK.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, roles, status, clubs!profiles_club_id_fkey(name, logo_path, sport, category, cover_path)")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.status !== "confirmado") return null;

  const club = Array.isArray(profile.clubs) ? profile.clubs[0] : profile.clubs;
  const roles = (profile.roles ?? []) as UserRole[];
  const direction = isDirection(roles);

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

  return {
    identity: await getClubIdentity(supabase, {
      name: club?.name ?? "",
      sport: club?.sport ?? null,
      category: club?.category ?? null,
      coverPath: club?.cover_path ?? null,
      uploadedLogoUrl: clubLogoUrl(supabase, club?.logo_path),
    }),
    fullName: profile.full_name ?? "",
    avatarUrl,
    direction,
    staff: isStaff(roles),
    pendingCount,
  };
});

// Navegación lateral de escritorio (lg+): marca Recov, ítems y perfil; la identidad
// del club va en el encabezado (ClubHeader).
export async function Sidebar() {
  const nav = await getNavData();
  if (!nav) return null;
  return (
    <SidebarNav
      fullName={nav.fullName}
      avatarUrl={nav.avatarUrl}
      direction={nav.direction}
      pendingCount={nav.pendingCount}
    />
  );
}

// Encabezado con la identidad del club (celular y escritorio).
export async function ClubHeaderNav() {
  const nav = await getNavData();
  if (!nav) return null;
  return <ClubHeaderBar identity={nav.identity} fullName={nav.fullName} avatarUrl={nav.avatarUrl} />;
}

// Barra inferior móvil (hasta lg).
export async function MobileNav() {
  const nav = await getNavData();
  if (!nav) return null;
  return (
    <MobileNavBar direction={nav.direction} staff={nav.staff} pendingCount={nav.pendingCount} />
  );
}
