// Sesión y perfil una sola vez por request. React cache() guarda el resultado solo
// mientras dura un render en el servidor (un request): nunca queda en el módulo ni se
// comparte entre requests ni usuarios. Así el layout y la página leen el perfil con
// una sola consulta.
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_CLUB_COOKIE, isUuid } from "@/lib/active-club";

// Cliente de Supabase del request (lee las cookies de la sesión).
export const getSupabase = cache(createClient);

// Usuario verificado contra el servidor de Auth. Las páginas lo usan para decidir
// identidad y acceso; el layout, que solo decide qué navegación mostrar, usa getClaims().
export const getSessionUser = cache(async () => {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// Columnas del plantel que piden el layout y las páginas.
const CLUB_COLUMNS =
  "name, sport, category, logo_path, cover_path, cover_position_x, cover_position_y, kine_delegate_id, nomina_delegate_id, nomina_mode, dashboard_metrics, dashboard_metrics_mobile, has_sevens";

// Perfil (nombre y foto, de la cuenta) con todas sus membresías y su plantel.
// Desde 0043 profiles es solo identidad: plantel, roles y estado salen de club_members.
const PROFILE_COLUMNS =
  "full_name, avatar_path, " +
  `club_members!club_members_user_id_fkey(club_id, roles, status, created_at, clubs!club_members_club_id_fkey(${CLUB_COLUMNS}))`;

export type MyClub = {
  name: string;
  sport: string;
  category: string | null;
  logo_path: string | null;
  cover_path: string | null;
  cover_position_x: number | null;
  cover_position_y: number | null;
  kine_delegate_id: string | null;
  nomina_delegate_id: string | null;
  nomina_mode: string;
  dashboard_metrics: string[] | null;
  dashboard_metrics_mobile: string[] | null;
  has_sevens: boolean;
};

// Una membresía de la cuenta (para el selector de plantel).
export type MyMembership = {
  club_id: string;
  roles: string[];
  status: string;
  created_at: string;
  club: MyClub | null;
};

export type MyProfile = {
  full_name: string | null;
  // roles, status, club_id y club son los del plantel activo (club_members), no los
  // de profiles: profiles guarda solo el plantel principal.
  roles: string[] | null;
  status: string;
  club_id: string | null;
  avatar_path: string | null;
  club: MyClub | null;
  // Todas las membresías, de la más antigua a la más nueva.
  memberships: MyMembership[];
};

type ProfileRow = {
  full_name: string | null;
  avatar_path: string | null;
  club_members: (Omit<MyMembership, "club"> & { clubs: MyClub | MyClub[] | null })[] | null;
};

// Plantel activo de este request: la cookie, que el proxy ya validó contra las
// membresías confirmadas. Sin cookie (ninguna membresía confirmada), null.
export const getActiveClubCookie = cache(async () => {
  const value = (await cookies()).get(ACTIVE_CLUB_COOKIE)?.value;
  return isUuid(value) ? value : null;
});

// Perfil propio con el plantel activo. RLS: cada usuario lee su propio perfil y sus
// membresías, aunque esté pendiente. Por id, para que el layout (id del JWT) y la
// página (id de getUser) compartan la consulta.
// Plantel activo: el de la cookie; sin cookie (ninguno confirmado), uno pendiente o la
// membresía más antigua: con un solo plantel, lo mismo que antes.
export const getProfile = cache(async (userId: string): Promise<MyProfile | null> => {
  const supabase = await getSupabase();
  const [{ data }, cookieClub] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle(),
    getActiveClubCookie(),
  ]);
  if (!data) return null;
  const row = data as unknown as ProfileRow;
  const memberships: MyMembership[] = (row.club_members ?? [])
    .map(({ clubs, ...m }) => ({ ...m, club: Array.isArray(clubs) ? (clubs[0] ?? null) : clubs }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  // Sin cookie válida: el confirmado más antiguo (lo mismo que elige el proxy).
  // Sin plantel confirmado: uno pendiente (para mostrar la pantalla de pendiente) o,
  // si no hay, la membresía más antigua.
  const active =
    memberships.find((m) => m.club_id === cookieClub && m.status === "confirmado") ??
    memberships.find((m) => m.status === "confirmado") ??
    memberships.find((m) => m.status === "pendiente") ??
    memberships[0] ??
    null;
  return {
    full_name: row.full_name,
    avatar_path: row.avatar_path,
    roles: active?.roles ?? [],
    status: active?.status ?? "pendiente",
    club_id: active?.club_id ?? null,
    club: active?.club ?? null,
    memberships,
  };
});

// Id del plantel activo para filtrar consultas (.eq("club_id", …)): RLS devuelve
// filas de todos los planteles de la cuenta, así que cada lista filtra por el activo.
// Usa la cookie si existe (sin esperar el perfil); si no, el que elige getProfile.
export const getActiveClubId = cache(async (userId: string): Promise<string> => {
  const cookieClub = await getActiveClubCookie();
  if (cookieClub) return cookieClub;
  const profile = await getProfile(userId);
  // Sin plantel no hay nada que mostrar: un id que no existe deja la lista vacía.
  return profile?.club_id ?? "00000000-0000-0000-0000-000000000000";
});
