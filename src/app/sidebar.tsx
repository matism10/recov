import { cache } from "react";
import { getProfile, getSupabase } from "@/lib/session";
import { isDirection, isStaff, type UserRole } from "@/lib/roles";
import { clubLogoUrl } from "@/lib/club-logo";
import { SidebarNav } from "./sidebar-nav";
import { MobileNavBar } from "./mobile-nav";
import { ClubHeader as ClubHeaderBar } from "./club-header";
import { clubIdentity } from "@/lib/club-identity";

// Igual que las fotos de perfil del resto de la app (src/lib/avatars.ts).
const AVATAR_URL_SECONDS = 60 * 60;

// Datos de la navegación (sidebar de escritorio, barra móvil y encabezado del club).
// Solo para usuarios confirmados: sin sesión, pendientes o rechazados no ven
// navegación. Las páginas siguen validando su propio acceso. `cache` evita repetir
// las consultas cuando varias piezas de la navegación las piden en el mismo request.
// Viajes a Supabase: el perfil (con el club y la ruta de la foto) y, en paralelo, el
// conteo de pendientes (solo dirección) y la firma de la foto propia.
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
    // RLS: solo la dirección ve perfiles pendientes.
    direction
      ? supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("status", "pendiente")
          .then(({ count }) => count ?? 0)
      : 0,
    profile.avatar_path
      ? supabase.storage
          .from("avatars")
          .createSignedUrl(profile.avatar_path as string, AVATAR_URL_SECONDS)
          .then(({ data }) => data?.signedUrl ?? null)
      : null,
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
    direction,
    staff: isStaff(roles),
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
    <MobileNavBar
      direction={nav.direction}
      staff={nav.staff}
      player={nav.player}
      pendingCount={nav.pendingCount}
    />
  );
}
