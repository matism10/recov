"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { NOTE_MAX, NOTE_MIN, OCCURRED_DURING_LABEL } from "@/lib/injuries";

export type MarkInjuredState = { error?: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function markPlayerInjured(
  _prevState: MarkInjuredState,
  formData: FormData,
): Promise<MarkInjuredState> {
  const playerId = String(formData.get("player_id") ?? "");
  const occurredDuring = String(formData.get("occurred_during") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  // Mismas reglas que mark_player_injured, para responder con mensajes claros.
  if (!UUID_RE.test(playerId)) return { error: "Jugador no válido." };
  if (!(occurredDuring in OCCURRED_DURING_LABEL)) {
    return { error: "Indica si fue en entrenamiento o competencia." };
  }
  if (note.length < NOTE_MIN || note.length > NOTE_MAX) {
    return { error: `Describe brevemente qué pasó (${NOTE_MIN} a ${NOTE_MAX} caracteres).` };
  }

  // mark_player_injured verifica el permiso (kinesiólogo, delegado o head coach)
  // y que el jugador sea confirmado del mismo club. El jugador queda siempre
  // "en revisión" hasta que review_injury confirme, descarte o dé de alta.
  const supabase = await createClient();
  const { data: injuryId, error } = await supabase.rpc("mark_player_injured", {
    p_player_id: playerId,
    p_occurred_during: occurredDuring,
    p_note: note,
    p_availability: "en_revision",
  });

  if (error) {
    // P0001: excepción propia de mark_player_injured, con mensaje en español.
    return {
      error:
        error.code === "P0001"
          ? error.message
          : "No se pudo registrar. Intenta de nuevo.",
    };
  }

  revalidatePath("/dashboard");
  redirect(`/lesiones/${injuryId as string}`);
}
