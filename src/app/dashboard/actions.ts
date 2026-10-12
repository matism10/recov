"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MANUAL_AVAILABILITY, type ManualAvailability } from "@/lib/roles";

export type AvailabilityState = { error?: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function setPlayerAvailability(
  _prevState: AvailabilityState,
  formData: FormData,
): Promise<AvailabilityState> {
  const playerId = String(formData.get("player_id") ?? "");
  const availability = String(formData.get("availability") ?? "");

  if (!UUID_RE.test(playerId)) return { error: "Jugador no válido." };
  if (!MANUAL_AVAILABILITY.includes(availability as ManualAvailability)) {
    return { error: "Estado no válido." };
  }

  // set_player_availability verifica que quien llama sea kinesiólogo (o su
  // delegado) o head coach, y que el jugador sea de su club.
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_player_availability", {
    p_player_id: playerId,
    p_availability: availability as ManualAvailability,
  });

  if (error) {
    // P0001: excepción propia de set_player_availability, con mensaje en español.
    return {
      error:
        error.code === "P0001"
          ? error.message
          : "No se pudo cambiar la disponibilidad. Intenta de nuevo.",
    };
  }

  revalidatePath("/dashboard");
  return {};
}
