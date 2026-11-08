"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClubId, getSessionUser } from "@/lib/session";

export type PositionState = { ok?: boolean; error?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cambia la posición principal, la secundaria y (rugby con Sevens, si el jugador está en
// el grupo) la de Sevens. set_player_positions exige el permiso posicion_cambiar y los
// triggers validan que las posiciones existan en el deporte y el formato.
export async function setPlayerPositions(
  _prev: PositionState,
  formData: FormData,
): Promise<PositionState> {
  const playerId = String(formData.get("player_id") ?? "");
  if (!UUID_RE.test(playerId)) return { error: "Jugador no válido." };
  const text = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  const position = text("position");
  if (!position) return { error: "Elige la posición principal." };
  const withSevens = formData.get("with_sevens") === "1";

  const user = await getSessionUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_player_positions", {
    p_player_id: playerId,
    p_position: position,
    p_secondary: text("secondary"),
    p_sevens_position: withSevens ? text("sevens_position") : null,
    p_sevens_secondary: withSevens ? text("sevens_secondary") : null,
    p_club_id: user ? await getActiveClubId(user.id) : null,
  });
  if (error) {
    return { error: error.code === "P0001" ? error.message : "No se pudo guardar la posición." };
  }

  revalidatePath(`/jugadores/${playerId}`);
  revalidatePath("/plantel");
  return { ok: true };
}
