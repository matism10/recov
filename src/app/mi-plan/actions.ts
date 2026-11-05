"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { gymErrorMessage } from "@/lib/gym";

export type GymLogState = { logId?: string; error?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function refresh() {
  revalidatePath("/dashboard");
  revalidatePath("/mi-plan");
}

// Marca una sesión del plan como hecha (o corrige lo marcado en el plazo).
// all = "Hice la sesión completa": la base marca todos los ejercicios.
export async function completeSession(planSessionId: string, exerciseIds: string[], all: boolean): Promise<GymLogState> {
  if (!UUID_RE.test(planSessionId) || !exerciseIds.every((id) => UUID_RE.test(id))) return { error: "Datos no válidos." };
  if (!all && exerciseIds.length === 0) return { error: "Marca al menos un ejercicio." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_gym_session", {
    p_plan_session_id: planSessionId,
    p_exercise_ids: all ? null : exerciseIds,
    p_all: all,
  });
  if (error || !data) return { error: gymErrorMessage(error ?? { message: "" }, "No se pudo guardar la sesión. Intenta de nuevo.") };
  refresh();
  return { logId: data as string };
}

// Sesión de gimnasio por su cuenta: hoy o hasta 2 días atrás.
export async function logOwnSession(input: {
  date: string;
  minutes: number;
  rpe: number | null;
  note: string;
}): Promise<GymLogState> {
  if (!ISO_RE.test(input.date)) return { error: "Elige la fecha." };
  if (!Number.isInteger(input.minutes) || input.minutes < 10 || input.minutes > 240) {
    return { error: "La duración va de 10 a 240 minutos." };
  }
  if (input.rpe !== null && (!Number.isInteger(input.rpe) || input.rpe < 0 || input.rpe > 10)) {
    return { error: "Elige un valor de 0 a 10." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("log_own_gym_session", {
    p_date: input.date,
    p_minutes: input.minutes,
    p_rpe: input.rpe,
    p_note: input.note.trim() || null,
  });
  if (error || !data) return { error: gymErrorMessage(error ?? { message: "" }, "No se pudo guardar la sesión. Intenta de nuevo.") };
  refresh();
  return { logId: data as string };
}

// Esfuerzo de una sesión de gimnasio (0–10), en el plazo; se puede corregir.
export async function submitGymRpe(logId: string, rpe: number): Promise<GymLogState> {
  if (!UUID_RE.test(logId)) return { error: "Datos no válidos." };
  if (!Number.isInteger(rpe) || rpe < 0 || rpe > 10) return { error: "Elige un valor de 0 a 10." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_gym_rpe", { p_log_id: logId, p_rpe: rpe });
  if (error) return { error: gymErrorMessage(error, "No se pudo guardar tu respuesta. Intenta de nuevo.") };
  refresh();
  revalidatePath(`/mi-plan/listo/${logId}`);
  return { logId };
}
