"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  EVENT_TYPES,
  LOCATION_MAX,
  MAX_WEEKS,
  NOTES_MAX,
  OPPONENT_MAX,
  chileToIso,
  eventErrorMessage,
  timeToMinutes,
  type EventType,
} from "@/lib/events";

// Tras un error se devuelven los valores enviados: React reinicia el formulario
// al terminar la acción y así no se pierde lo escrito.
export type EventFormState = { error?: string; values?: Record<string, string> };
export type CancelState = { error?: string };

function submitted(formData: FormData) {
  const values: Record<string, string> = {};
  for (const key of ["date", "start", "end", "location", "opponent", "notes", "weeks"]) {
    values[key] = String(formData.get(key) ?? "");
  }
  return values;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Campos comunes de crear y editar. Mismas reglas que public.events y
// create_event/update_event, para responder con mensajes claros; la base decide.
function readFields(formData: FormData) {
  const date = String(formData.get("date") ?? "");
  const start = String(formData.get("start") ?? "");
  const end = String(formData.get("end") ?? "");
  const location = String(formData.get("location") ?? "").trim();
  const opponent = String(formData.get("opponent") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const startsAt = chileToIso(date, start);
  const endsAt = chileToIso(date, end);
  if (!startsAt || !endsAt) return { error: "Indica la fecha y las horas de inicio y término." };
  if (timeToMinutes(end) <= timeToMinutes(start)) {
    return { error: "La hora de término debe ser posterior a la de inicio." };
  }
  if (location.length > LOCATION_MAX) {
    return { error: `El lugar puede tener hasta ${LOCATION_MAX} caracteres.` };
  }
  if (opponent.length > OPPONENT_MAX) {
    return { error: `El rival puede tener hasta ${OPPONENT_MAX} caracteres.` };
  }
  if (notes.length > NOTES_MAX) {
    return { error: `Las notas pueden tener hasta ${NOTES_MAX} caracteres.` };
  }
  return { date, startsAt, endsAt, location, opponent, notes };
}

export async function createEvent(
  _prevState: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const values = submitted(formData);
  const type = String(formData.get("type") ?? "") as EventType;
  if (!EVENT_TYPES.includes(type)) return { error: "Elige si es entrenamiento o competencia.", values };

  const fields = readFields(formData);
  if ("error" in fields) return { error: fields.error, values };

  // La repetición semanal es solo para entrenamientos.
  const weeks = type === "entrenamiento" ? Number(formData.get("weeks") ?? 1) : 1;
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > MAX_WEEKS) {
    return { error: `La repetición debe ser de 1 a ${MAX_WEEKS} semanas.`, values };
  }

  // create_event verifica el rol (head coach, manager o entrenador) y el club.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_event", {
    p_type: type,
    p_starts_at: fields.startsAt,
    p_ends_at: fields.endsAt,
    p_location: fields.location || null,
    p_opponent: type === "competencia" ? fields.opponent || null : null,
    p_notes: fields.notes || null,
    p_weeks: weeks,
  });
  if (error) {
    return { error: eventErrorMessage(error, "No se pudo crear el evento. Intenta de nuevo."), values };
  }

  const ids = (data ?? []) as string[];
  revalidatePath("/calendario");
  redirect(`/calendario?fecha=${fields.date}${ids[0] ? `&evento=${ids[0]}` : ""}`);
}

// Edita solo esta ocurrencia: el tipo y la repetición no se cambian.
export async function updateEvent(
  _prevState: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const values = submitted(formData);
  const eventId = String(formData.get("event_id") ?? "");
  if (!UUID_RE.test(eventId)) return { error: "Evento no válido.", values };
  const fields = readFields(formData);
  if ("error" in fields) return { error: fields.error, values };

  // update_event verifica el rol y que el evento sea del club y no esté cancelado.
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_event", {
    p_event_id: eventId,
    p_starts_at: fields.startsAt,
    p_ends_at: fields.endsAt,
    p_location: fields.location || null,
    // El CHECK de la base rechaza rival en entrenamientos; el formulario solo lo
    // muestra en competencias.
    p_opponent: fields.opponent || null,
    p_notes: fields.notes || null,
  });
  if (error) {
    return { error: eventErrorMessage(error, "No se pudo guardar el evento. Intenta de nuevo."), values };
  }

  revalidatePath("/calendario");
  redirect(`/calendario?fecha=${fields.date}&evento=${eventId}`);
}

export async function cancelEvent(eventId: string): Promise<CancelState> {
  if (!UUID_RE.test(eventId)) return { error: "Evento no válido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_event", { p_event_id: eventId });
  if (error) return { error: eventErrorMessage(error, "No se pudo cancelar el evento. Intenta de nuevo.") };
  revalidatePath("/calendario");
  return {};
}
