// Ausencias avisadas (20261110120000). El jugador (o el staff por él) avisa que no va a un
// evento o que estará ausente varios días; la lista de asistencia sigue siendo del staff
// (un aviso no la escribe). La nota la ven solo el staff con lista_pasar y el propio jugador.
import type { createClient } from "@/lib/supabase/server";
import { monthLabelShort } from "@/lib/absence-dates";
import {
  EVENT_COLUMNS,
  compactDayLabel,
  eventTimeLabel,
  eventTitle,
  toCalendarEvent,
  type EventRow,
} from "@/lib/events";

type Client = Awaited<ReturnType<typeof createClient>>;

export const ABSENCE_REASONS = ["vacaciones", "viaje_trabajo", "estudios", "salud", "otro"] as const;
export type AbsenceReason = (typeof ABSENCE_REASONS)[number];

export const ABSENCE_REASON_LABEL: Record<AbsenceReason, string> = {
  vacaciones: "Vacaciones",
  viaje_trabajo: "Viaje o trabajo",
  estudios: "Estudios",
  salud: "Salud",
  otro: "Otro motivo",
};

// En frases ("estará ausente por vacaciones"): minúscula.
export function reasonText(reason: unknown) {
  const label = ABSENCE_REASON_LABEL[reason as AbsenceReason];
  return label ? label.toLowerCase() : "otro motivo";
}

export const NOTE_MAX = 200;

export type AbsenceScope = "evento" | "periodo";

// "22 dic a 12 ene", "desde el 22 dic" (sin fecha de vuelta) o "22 dic" (un solo día).
export function periodText(startsOn: string, endsOn: string | null) {
  const from = monthLabelShort(startsOn);
  if (!endsOn) return `desde el ${from}`;
  if (endsOn === startsOn) return from;
  return `${from} a ${monthLabelShort(endsOn)}`;
}

// ---------------------------------------------------------------------------
// Lecturas (todas por funciones de la base: la nota no se lee directo de la tabla)
// ---------------------------------------------------------------------------
export type MyAbsence = {
  id: string;
  scope: AbsenceScope;
  event_id: string | null;
  event_type: "entrenamiento" | "competencia" | null;
  event_starts_at: string | null;
  event_ends_at: string | null;
  opponent: string | null;
  starts_on: string | null;
  ends_on: string | null;
  reason: AbsenceReason;
  note: string | null;
  is_squad: boolean;
  by_staff: boolean;
  in_progress: boolean;
  created_at: string;
};

// Mis avisos vigentes y los del plantel. Si falla, ninguno.
export async function getMyAbsences(supabase: Client): Promise<MyAbsence[]> {
  const { data, error } = await supabase.rpc("my_absences");
  if (error || !data) return [];
  return data as MyAbsence[];
}

export type ClubAbsence = {
  id: string;
  player_id: string | null;
  player_name: string | null;
  scope: AbsenceScope;
  event_id: string | null;
  event_type: "entrenamiento" | "competencia" | null;
  event_starts_at: string | null;
  event_format: string | null;
  opponent: string | null;
  starts_on: string | null;
  ends_on: string | null;
  reason: AbsenceReason;
  note: string | null;
  state: "vigente" | "pasado" | "quitado";
  in_progress: boolean;
  created_by_name: string | null;
  created_at: string;
  ended_at: string | null;
};

export async function getClubAbsences(supabase: Client, state: "vigente" | "historial") {
  const { data, error } = await supabase.rpc("club_absences", { p_state: state });
  if (error) return { ok: false as const };
  return { ok: true as const, data: (data ?? []) as ClubAbsence[] };
}

export type EventAbsenceKind = "aviso" | "periodo" | "plantel" | "lesionado";

export type EventAbsence = {
  player_id: string;
  full_name: string;
  kind: EventAbsenceKind;
  reason: AbsenceReason | null;
  note: string | null;
};

// Quiénes no van a un evento y por qué. Solo staff; si falla, nadie.
export async function getEventAbsences(supabase: Client, eventId: string): Promise<EventAbsence[]> {
  const { data, error } = await supabase.rpc("event_absences", { p_event_id: eventId });
  if (error || !data) return [];
  return data as EventAbsence[];
}

// Fila de "Asistencia prevista" en el detalle de un evento (solo nombre y etiqueta).
export type ExpectedAbsence = { name: string; tag: string };

// "Avisó: vacaciones", "De vacaciones" (período), "Parón del plantel"; lesionado = informativo.
export function absenceTag(a: { kind: EventAbsenceKind; reason: AbsenceReason | null }) {
  switch (a.kind) {
    case "aviso":
      return `Avisó: ${reasonText(a.reason)}`;
    case "periodo":
      return `Ausente: ${reasonText(a.reason)}`;
    case "plantel":
      return "Parón del plantel";
    case "lesionado":
      return "Lesionado";
  }
}

// ---------------------------------------------------------------------------
// Errores de las funciones de la base, en español
// ---------------------------------------------------------------------------
export function absenceErrorMessage(error: { code?: string; message: string }, fallback: string) {
  if (error.code === "42501") return "No tienes permiso para esta acción.";
  if (error.code === "23514") return "Revisa los datos: alguno no cumple los límites.";
  if (error.code === "P0001" && error.message !== "not_found") return `${error.message}.`;
  if (error.message === "not_found") return "El aviso o el evento ya no existe.";
  return fallback;
}

// ---------------------------------------------------------------------------
// Próximos eventos para elegir en el aviso
// ---------------------------------------------------------------------------
export type UpcomingEventOption = { id: string; title: string; when: string };

// Eventos futuros no cancelados (RLS: los del plantel). `format` filtra por formato
// (el jugador, el suyo); sin formato (staff) vienen todos y los de Sevens se marcan.
export async function getUpcomingEventOptions(
  supabase: Client,
  clubId: string,
  format: "15" | "7" | null,
): Promise<UpcomingEventOption[]> {
  const { data } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("club_id", clubId)
    .is("cancelled_at", null)
    .gt("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(40);
  return ((data ?? []) as EventRow[])
    .filter((r) => !format || (r.format === "7" ? "7" : "15") === format)
    .map((r) => {
      const e = toCalendarEvent(r);
      const sevens = !format && r.format === "7" ? " · Sevens" : "";
      return {
        id: e.id,
        title: eventTitle(e),
        when: `${compactDayLabel(e.day)} · ${eventTimeLabel(e)}${sevens}`,
      };
    });
}
