"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CallupsState = { ok?: boolean; error?: string };

export type LineupEntry = { player_id: string; slot: number | null };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Guarda la nómina completa de un partido: convocados con su puesto (titular o
// banca) o sin puesto. set_event_lineup verifica que quien llama pueda armar
// nóminas, que el evento sea una competencia del club, los jugadores, los
// puestos (sin repetir, dentro de titulares + banca del deporte) y el máximo.
export async function saveLineup(eventId: string, lineup: LineupEntry[]): Promise<CallupsState> {
  if (
    !UUID_RE.test(eventId) ||
    !lineup.every(
      (e) => UUID_RE.test(e.player_id) && (e.slot === null || (Number.isInteger(e.slot) && e.slot > 0)),
    )
  ) {
    return { error: "Datos no válidos." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_event_lineup", {
    p_event_id: eventId,
    p_lineup: lineup,
  });
  if (error) {
    return {
      error:
        error.code === "42501"
          ? "No tienes permiso para armar la nómina."
          : error.code === "P0001" && error.message !== "not_found"
            ? error.message
            : "No se pudo guardar la nómina.",
    };
  }
  revalidatePath(`/calendario/${eventId}/disponibles`);
  revalidatePath(`/calendario/${eventId}/participacion`);
  revalidatePath("/nominas");
  revalidatePath("/metricas");
  return { ok: true };
}
