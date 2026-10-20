"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { NominaMode } from "@/lib/match-load";

export type ParticipationState = { ok?: boolean; error?: string };

export type ParticipationRow = {
  player_id: string;
  minutes?: number;
  range_bucket?: number;
  played?: boolean;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Guarda la participación de los convocados en un solo lote. Cada fila lleva solo
// el campo del modo del club; set_event_participation valida el permiso, el modo,
// el tope de minutos del deporte y que el partido ya haya empezado (todo o nada).
export async function saveParticipation(
  eventId: string,
  mode: NominaMode,
  rows: ParticipationRow[],
): Promise<ParticipationState> {
  if (!UUID_RE.test(eventId) || rows.length === 0) return { error: "No hay nada que guardar." };
  if (!rows.every((r) => UUID_RE.test(r.player_id))) return { error: "Datos no válidos." };
  const clean = rows.map((r) => {
    if (mode === "exacto") return { player_id: r.player_id, minutes: r.minutes };
    if (mode === "rango") return { player_id: r.player_id, range_bucket: r.range_bucket };
    return { player_id: r.player_id, played: r.played };
  });

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_event_participation", {
    p_event_id: eventId,
    p_rows: clean,
  });
  if (error) {
    return {
      error:
        error.code === "42501"
          ? "No tienes permiso para cargar la participación."
          : error.code === "P0001" && error.message !== "not_found"
            ? error.message
            : "No se pudo guardar la participación.",
    };
  }
  revalidatePath(`/calendario/${eventId}/participacion`);
  revalidatePath("/metricas");
  revalidatePath("/dashboard");
  return { ok: true };
}
