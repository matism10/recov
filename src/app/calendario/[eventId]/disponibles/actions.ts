"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CallupsState = { ok?: boolean; error?: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Guarda la convocatoria completa de un partido. set_event_callups verifica que
// quien llama pueda armar nóminas, que el evento sea una competencia del club y
// que los jugadores sean confirmados del club. Quitar a alguien lo archiva.
export async function saveCallups(eventId: string, playerIds: string[]): Promise<CallupsState> {
  if (!UUID_RE.test(eventId) || !playerIds.every((id) => UUID_RE.test(id))) {
    return { error: "Datos no válidos." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_event_callups", {
    p_event_id: eventId,
    p_player_ids: [...new Set(playerIds)],
  });
  if (error) {
    return {
      error:
        error.code === "42501"
          ? "No tienes permiso para armar la nómina."
          : error.code === "P0001" && !["not_found"].includes(error.message)
            ? error.message
            : "No se pudo guardar la convocatoria.",
    };
  }
  revalidatePath(`/calendario/${eventId}/disponibles`);
  revalidatePath(`/calendario/${eventId}/participacion`);
  revalidatePath("/metricas");
  return { ok: true };
}
