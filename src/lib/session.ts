// Sesión y perfil una sola vez por request. React cache() guarda el resultado solo
// mientras dura un render en el servidor (un request): nunca queda en el módulo ni se
// comparte entre requests ni usuarios. Así el layout y la página leen el perfil con
// una sola consulta.
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

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

// Columnas del perfil y del club que piden el layout y las páginas. Desde 0005 hay
// dos relaciones profiles–clubs: hay que nombrar la FK.
const PROFILE_COLUMNS =
  "full_name, roles, status, club_id, avatar_path, " +
  "clubs!profiles_club_id_fkey(name, sport, category, logo_path, cover_path, cover_position_x, cover_position_y, kine_delegate_id, nomina_delegate_id, nomina_mode, dashboard_metrics, dashboard_metrics_mobile)";

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
};

export type MyProfile = {
  full_name: string | null;
  roles: string[] | null;
  status: string;
  club_id: string | null;
  avatar_path: string | null;
  club: MyClub | null;
};

// Perfil propio con su club. RLS: cada usuario lee su propio perfil, aunque esté
// pendiente. Por id, para que el layout (id del JWT) y la página (id de getUser)
// compartan la consulta.
export const getProfile = cache(async (userId: string): Promise<MyProfile | null> => {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  const { clubs, ...rest } = data as unknown as Omit<MyProfile, "club"> & {
    clubs: MyClub | MyClub[] | null;
  };
  return { ...rest, club: Array.isArray(clubs) ? (clubs[0] ?? null) : clubs };
});
