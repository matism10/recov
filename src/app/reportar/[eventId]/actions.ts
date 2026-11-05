"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { srpeErrorMessage } from "@/lib/srpe";

export type RpeState = { ok?: boolean; error?: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Guarda el esfuerzo de una sesión (o "no fui"). submit_session_rpe valida que el
// jugador pueda responder: plazo de 48 h, convocatoria, lista de asistencia y Sevens.
// Responder de nuevo dentro del plazo corrige la respuesta.
export async function submitRpe(eventId: string, rpe: number | null, absent: boolean): Promise<RpeState> {
  if (!UUID_RE.test(eventId)) return { error: "Datos no válidos." };
  if (!absent && (rpe === null || !Number.isInteger(rpe) || rpe < 0 || rpe > 10)) {
    return { error: "Elige un valor de 0 a 10." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_session_rpe", {
    p_event_id: eventId,
    p_rpe: absent ? null : rpe,
    p_absent: absent,
  });
  if (error) return { error: srpeErrorMessage(error, "No se pudo guardar tu respuesta. Intenta de nuevo.") };
  revalidatePath("/dashboard");
  revalidatePath(`/reportar/${eventId}`);
  return { ok: true };
}
