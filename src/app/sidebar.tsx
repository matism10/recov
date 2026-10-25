import { cache } from "react";
import { getProfile, getSupabase } from "@/lib/session";
import { isDirection, isStaff, type UserRole } from "@/lib/roles";
import { canReadEvaluations } from "@/lib/evaluations";
import { clubLogoUrl } from "@/lib/club-logo";
import { SidebarNav } from "./sidebar-nav";
import { MobileNavBar } from "./mobile-nav";
import { ClubHeader as ClubHeaderBar } from "./club-header";
import { clubIdentity } from "@/lib/club-identity";
import { clubOptions } from "@/lib/club-options";

import { photoUrl } from "@/lib/photos";

// Datos de la navegación (sidebar de escritorio, barra móvil y encabezado del club).
// Solo para usuarios confirmados: sin sesión, pendientes o rechazados no ven
// navegación. Las páginas siguen validando su propio acceso. `cache` evita repetir
// las consultas cuando varias piezas de la navegación las piden en el mismo request.
// Viajes a Supabase: el perfil (con sus planteles, el activo y la ruta de la foto)
// y, solo para la dirección, el conteo de pendientes del plantel activo. La foto propia va por /foto, sin firmar.
const getNavData = cache(async () => {
  const supabase = await getSupabase();
  // getClaims verifica el JWT de la sesión (firmado con ES256) contra las claves
  // públicas del proyecto, sin ir al servidor de Auth. Aquí basta: solo decide qué
  // navegación se muestra, el proxy ya refrescó la sesión y cada dato lo protege RLS.
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return null;

  // El mismo perfil que lee la página en este request (una sola consulta).
  const profile = await getProfile(userId);
  if (profile?.status !== "confirmado") return null;

  const club = profile.club;
  const roles = (profile.roles ?? []) as UserRole[];
  const direction = isDirection(roles);

  const [pendingCount, avatarUrl] = await Promise.all([
    // RLS: solo la dirección ve las membresías pendientes de su plantel. Se cuentan
    // las del plantel activo, no las de otros planteles de la cuenta.
    direction && profile.club_id
      ? supabase
          .from("club_members")
          .select("user_id", { count: "exact", head: true })
          .eq("club_id", profile.club_id)
          .eq("status", "pendiente")
          .then(({ count }) => count ?? 0)
      : 0,
    profile.avatar_path ? photoUrl("avatars", profile.avatar_path) : null,
  ]);

  return {
    identity: clubIdentity({
      name: club?.name ?? "",
      sport: club?.sport ?? null,
      category: club?.category ?? null,
      coverPath: club?.cover_path ?? null,
      coverPosition: { x: club?.cover_position_x ?? 50, y: club?.cover_position_y ?? 50 },
      uploadedLogoUrl: clubLogoUrl(supabase, club?.logo_path),
    }),
    fullName: profile.full_name ?? "",
    avatarUrl,
    clubs: clubOptions(supabase, profile),
    direction,
    staff: isStaff(roles),
    evaluations: canReadEvaluations(roles),
    player: roles.includes("jugador"),
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
      staff={nav.staff}
      evaluations={nav.evaluations}
      pendingCount={nav.pendingCount}
    />
  );
}

// Encabezado con la identidad del club (celular y escritorio).
export async function ClubHeaderNav() {
  const nav = await getNavData();
  if (!nav) return null;
  return (
    <ClubHeaderBar
      identity={nav.identity}
      fullName={nav.fullName}
      avatarUrl={nav.avatarUrl}
      clubs={nav.clubs}
    />
  );
}

// Barra inferior móvil (hasta lg).
export async function MobileNav() {
  const nav = await getNavData();
  if (!nav) return null;
  return (
    <MobileNavBar
      direction={nav.direction}
      staff={nav.staff}
      evaluations={nav.evaluations}
      player={nav.player}
      pendingCount={nav.pendingCount}
    />
  );
}
