// Formato activo (Rugby Sevens, 0045): un club de rugby con Sevens trabaja en '15' o
// en '7' con el mismo plantel. Se guarda en la cookie recov_format y se lee en el
// servidor, como recov_club. Solo decide qué se muestra: la base valida cada escritura.
import { cache } from "react";
import { cookies } from "next/headers";
import { FORMAT_COOKIE } from "@/lib/sevens";
import { getProfile, getSupabase } from "@/lib/session";
import { isDirection, type UserRole } from "@/lib/roles";

import type { Format, SevensMember } from "@/lib/sevens";
export { FORMAT_COOKIE, FORMAT_COOKIE_OPTIONS, FORMAT_LABEL, SEVENS_POSITIONS, sevensPositionLabel } from "@/lib/sevens";
export type { Format, SevensMember } from "@/lib/sevens";

export type FormatContext = {
  // Puede trabajar en Sevens: club de rugby con Sevens, y la cuenta está en el grupo
  // activo o es de la dirección.
  canSevens: boolean;
  format: Format;
  // Grupo Sevens activo del plantel (por user_id), con la posición de Sevens de cada uno.
  group: Map<string, SevensMember>;
};

const NONE: FormatContext = { canSevens: false, format: "15", group: new Map() };

// Una sola vez por request (cache de React, no se comparte entre requests).
export const getFormatContext = cache(async (userId: string): Promise<FormatContext> => {
  const profile = await getProfile(userId);
  const club = profile?.club;
  if (!profile || profile.status !== "confirmado" || !profile.club_id || club?.sport !== "rugby" || !club.has_sevens) {
    return NONE;
  }
  const supabase = await getSupabase();
  const [{ data }, cookieStore] = await Promise.all([
    supabase
      .from("sevens_group")
      .select("member_id, position, secondary_position")
      .eq("club_id", profile.club_id)
      .is("archived_at", null),
    cookies(),
  ]);
  const group = new Map(
    ((data ?? []) as ({ member_id: string } & SevensMember)[]).map((g) => [
      g.member_id,
      { position: g.position, secondary_position: g.secondary_position },
    ]),
  );
  const canSevens = isDirection((profile.roles ?? []) as UserRole[]) || group.has(userId);
  const format: Format = canSevens && cookieStore.get(FORMAT_COOKIE)?.value === "7" ? "7" : "15";
  return { canSevens, format, group };
});

export async function getActiveFormat(userId: string): Promise<Format> {
  return (await getFormatContext(userId)).format;
}

// En '7', las listas de jugadores muestran solo a los del grupo Sevens (por su cuenta).
export function inFormat<T extends { user_id: string | null }>(players: T[], ctx: FormatContext): T[] {
  if (ctx.format !== "7") return players;
  return players.filter((p) => p.user_id !== null && ctx.group.has(p.user_id));
}

// Fichas de jugador (players.id) del grupo Sevens activo del plantel. Para filtrar
// resultados que vienen por jugador (disponibilidad de un evento, nómina).
export const getSevensPlayerIds = cache(async (userId: string): Promise<Set<string>> => {
  const [ctx, profile] = await Promise.all([getFormatContext(userId), getProfile(userId)]);
  if (ctx.group.size === 0 || !profile?.club_id) return new Set();
  const supabase = await getSupabase();
  const { data } = await supabase
    .from("players")
    .select("id")
    .eq("club_id", profile.club_id)
    .in("user_id", [...ctx.group.keys()]);
  return new Set(((data ?? []) as { id: string }[]).map((p) => p.id));
});

// Para filtrar consultas por jugador (.in("player_id", …)) en el formato activo: null en
// Rugby 15 (no se filtra); en Sevens, las fichas del grupo. Sin nadie en el grupo, un id
// que no existe deja la lista vacía.
export async function formatPlayerIds(userId: string): Promise<string[] | null> {
  if ((await getActiveFormat(userId)) !== "7") return null;
  const ids = [...(await getSevensPlayerIds(userId))];
  return ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"];
}
