"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ABSENCE_REASONS, NOTE_MAX, absenceErrorMessage, type AbsenceScope } from "@/lib/absences";

export type AbsenceState = { ok?: boolean; error?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function refresh() {
  revalidatePath("/dashboard");
  revalidatePath("/ausencias");
  revalidatePath("/calendario");
  revalidatePath("/calendario/ausencias");
}

export type DeclareInput = {
  // Solo staff: jugador por quien se declara; null = todo el plantel (solo "Varios días").
  // El jugador no lo manda: la base usa siempre su propia ficha.
  playerId: string | null;
  scope: AbsenceScope;
  eventId: string | null;
  startsOn: string | null;
  endsOn: string | null;
  reason: string;
  note: string;
};

// declare_absence valida quién puede avisar por quién (el jugador solo por sí mismo; el
// staff con ausencias_declarar por un jugador; el plantel entero solo con paron_declarar),
// el evento (futuro, no cancelado, del formato del jugador) y las fechas.
export async function declareAbsence(input: DeclareInput): Promise<AbsenceState> {
  if (input.scope !== "evento" && input.scope !== "periodo") return { error: "Elige un evento o varios días." };
  if (!(ABSENCE_REASONS as readonly string[]).includes(input.reason)) return { error: "Elige un motivo." };
  if (input.note.length > NOTE_MAX) return { error: `La nota admite hasta ${NOTE_MAX} caracteres.` };
  if (input.playerId && !UUID_RE.test(input.playerId)) return { error: "Datos no válidos." };
  if (input.scope === "evento") {
    if (!input.eventId || !UUID_RE.test(input.eventId)) return { error: "Elige el evento." };
  } else {
    if (!input.startsOn || !DATE_RE.test(input.startsOn)) return { error: "Indica desde cuándo." };
    if (input.endsOn && !DATE_RE.test(input.endsOn)) return { error: "Fecha de vuelta no válida." };
    if (input.endsOn && input.endsOn < input.startsOn) return { error: "La vuelta no puede ser antes del inicio." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("declare_absence", {
    p_player: input.playerId,
    p_scope: input.scope,
    p_event: input.scope === "evento" ? input.eventId : null,
    p_starts_on: input.scope === "periodo" ? input.startsOn : null,
    p_ends_on: input.scope === "periodo" ? input.endsOn : null,
    p_reason: input.reason,
    p_note: input.note.trim() || null,
  });
  if (error) return { error: absenceErrorMessage(error, "No se pudo guardar el aviso. Intenta de nuevo.") };
  refresh();
  return { ok: true };
}

// Quitar un aviso, o "Ya volví" (returned): el período queda hasta hoy.
export async function endAbsence(id: string, returned = false): Promise<AbsenceState> {
  if (!UUID_RE.test(id)) return { error: "Datos no válidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("end_absence", { p_id: id, p_returned: returned });
  if (error) return { error: absenceErrorMessage(error, "No se pudo actualizar el aviso. Intenta de nuevo.") };
  refresh();
  return { ok: true };
}
