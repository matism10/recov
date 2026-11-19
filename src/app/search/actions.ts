"use server";

import { getActiveClubId, getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { isStaff, type Availability, type UserRole } from "@/lib/roles";
import { canReadEvaluations } from "@/lib/evaluations";
import { getSquad } from "@/lib/squad";
import { SPORT_LABEL } from "@/lib/club-identity";
import { FORMAT_LABEL, getFormatContext, inFormat, sevensPositionLabel } from "@/lib/format";

export type SearchPlayer = {
  // players.id: lleva a /jugadores/[id].
  id: string;
  name: string;
  position: string | null;
  availability: Availability;
  avatarUrl: string | null;
};

export type SearchData = {
  // Permisos reales de la persona en el plantel activo (my_permissions), y roles.
  roles: string[];
  permissions: string[];
  staff: boolean;
  evaluations: boolean;
  // Deporte del club y si tiene Sevens activo (para los destinos de Configuración).
  sport: string;
  hasSevens: boolean;
  // Texto del chip: "Rugby 15", "Sevens" o el deporte del club.
  scopeLabel: string;
  // null si no es staff: el jugador no ve resultados de otros jugadores.
  players: SearchPlayer[] | null;
};

// Todo lo que el buscador necesita, en una sola llamada al abrirlo (no en el layout).
// Jugadores solo para staff, del plantel activo y con la misma regla de formato que
// /plantel: en Sevens, solo el grupo. RLS filtra por club.
export async function loadSearchData(): Promise<{ ok: true; data: SearchData } | { ok: false }> {
  const user = await getSessionUser();
  if (!user) return { ok: false };
  const profile = await getProfile(user.id);
  if (profile?.status !== "confirmado") return { ok: false };

  const roles = (profile.roles ?? []) as UserRole[];
  const staff = isStaff(roles);
  const sport = profile.club?.sport ?? "";
  const formatCtx = await getFormatContext(user.id);
  const scopeLabel = sport === "rugby" ? FORMAT_LABEL[formatCtx.format] : (SPORT_LABEL[sport] ?? "Plantel");

  let players: SearchPlayer[] | null = null;
  if (staff) {
    const supabase = await getSupabase();
    const squad = await getActiveClubId(user.id).then((clubId) => getSquad(supabase, clubId));
    const sevens = formatCtx.format === "7";
    players = inFormat(squad.players, formatCtx).map((p) => ({
      id: p.id,
      name: p.full_name,
      position: sevens ? sevensPositionLabel(p.user_id ? formatCtx.group.get(p.user_id) : null) : p.position,
      availability: p.availability as Availability,
      avatarUrl: p.user_id ? (squad.avatarUrls.get(p.user_id) ?? null) : null,
    }));
  }

  return {
    ok: true,
    data: {
      roles: [...roles],
      permissions: profile.permissions,
      staff,
      evaluations: canReadEvaluations(roles),
      sport,
      hasSevens: !!profile.club?.has_sevens,
      scopeLabel,
      players,
    },
  };
}
