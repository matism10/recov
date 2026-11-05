"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AttendanceState = { ok?: boolean; error?: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Guarda la lista: todos los del plantel quedan presentes salvo los ausentes.
// set_event_attendance valida el staff, el club, que sea un entrenamiento no
// cancelado y ya empezado, y que los ausentes sean del plantel. Reguardar actualiza.
export async function saveAttendance(eventId: string, absentIds: string[]): Promise<AttendanceState> {
  if (!UUID_RE.test(eventId) || !absentIds.every((id) => UUID_RE.test(id))) {
    return { error: "Datos no válidos." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_event_attendance", {
    p_event_id: eventId,
    p_absent: absentIds,
  });
  if (error) {
    return {
      error:
        error.code === "42501"
          ? "No tienes permiso para pasar lista."
          : error.code === "P0001" && error.message !== "not_found"
            ? `${error.message}.`
            : "No se pudo guardar la asistencia. Intenta de nuevo.",
    };
  }
  revalidatePath(`/calendario/${eventId}/asistencia`);
  revalidatePath("/calendario");
  revalidatePath("/asistencia");
  revalidatePath("/dashboard");
  return { ok: true };
}
