// Sesión y perfil una sola vez por request. React cache() guarda el resultado solo
// mientras dura un render en el servidor (un request): nunca queda en el módulo ni se
// comparte entre requests ni usuarios. Así el layout y la página leen el perfil con
// una sola consulta.
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_CLUB_COOKIE, isUuid } from "@/lib/active-club";
import { withPermissions } from "@/lib/permissions";

// Cliente de Supabase del request (lee las cookies de la sesión).
export const getSupabase = cache(createClient);

// Usuario de la sesión. getClaims verifica la firma del JWT (ES256) con las claves
// públicas del proyecto, sin ir al servidor de Auth en cada pantalla (getUser sumaba
// un viaje a cada navegación). Los datos los sigue protegiendo RLS, que valida el
// mismo JWT. Las acciones que escriben siguen usando getUser.
export type SessionUser = { id: string; email: string | null };

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
});

// Columnas del plantel que piden el layout y las páginas.
const CLUB_COLUMNS =
  "name, sport, category, logo_path, cover_path, cover_position_x, cover_position_y, kine_delegate_id, nomina_delegate_id, nomina_mode, dashboard_metrics, dashboard_metrics_mobile, has_sevens, guardian_declared_at";

// Perfil (nombre y foto, de la cuenta) con todas sus membresías y su plantel.
// Desde 0043 profiles es solo identidad: plantel, roles y estado salen de club_members.
const PROFILE_COLUMNS =
  "full_name, avatar_path, terms_accepted_at, terms_version, " +
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
  // Declaración de autorización de apoderados (20261109120000); null = pendiente.
  guardian_declared_at: string | null;
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
  // Aceptación de términos (20261109120000).
  terms_accepted_at: string | null;
  terms_version: string | null;
  club: MyClub | null;
  // Todas las membresías, de la más antigua a la más nueva.
  memberships: MyMembership[];
  // Permisos efectivos en el plantel activo (my_permissions: rol + delegaciones + ajustes).
  // También van pegados a `roles` para los helpers de roles.ts (ver permissions.ts).
  permissions: string[];
};

type ProfileRow = {
  full_name: string | null;
  avatar_path: string | null;
  terms_accepted_at: string | null;
  terms_version: string | null;
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
  const [{ data }, cookieClub, { data: perms }] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle(),
    getActiveClubCookie(),
    // Plantel activo por el header x-club-id (la misma cookie); sin plantel confirmado, [].
    supabase.rpc("my_permissions"),
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
    terms_accepted_at: row.terms_accepted_at,
    terms_version: row.terms_version,
    roles: withPermissions([...(active?.roles ?? [])], active?.status === "confirmado" ? ((perms as string[] | null) ?? []) : []),
    status: active?.status ?? "pendiente",
    club_id: active?.club_id ?? null,
    club: active?.club ?? null,
    memberships,
    permissions: active?.status === "confirmado" ? ((perms as string[] | null) ?? []) : [],
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
