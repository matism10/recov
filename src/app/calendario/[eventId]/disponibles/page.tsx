import Link from "next/link";
import { redirect } from "next/navigation";
import { isStaff } from "@/lib/roles";
import { canManageNominas } from "@/lib/match-load";
import {
  EVENT_COLUMNS,
  EVENT_TYPE_LABEL,
  availableRatioOk,
  eventTitle,
  longDayLabel,
  summarizeAvailability,
  toCalendarEvent,
  type EventAvailabilityRow,
  type EventRow,
} from "@/lib/events";
import { ErrorMessage, cardClass, textButton } from "@/app/ui";
import { requireMember } from "../../member";
import { AvailablePlayers } from "./available-players";

// Jugadores del plantel según su disponibilidad proyectada para un evento. Solo
// staff: event_availability lo verifica y el jugador vuelve al calendario.
// Muestra solo el estado (ok, duda, no), nunca fechas de alta ni diagnóstico.
// En un partido, quien arma nóminas (head coach, manager o el delegado) elige
// aquí la convocatoria con casillas.
export default async function EventAvailablePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { supabase, roles, club, userId } = await requireMember();
  if (!isStaff(roles)) redirect("/calendario");

  // RLS: solo eventos del club; un id inválido o ajeno no devuelve filas.
  const { data } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("id", eventId)
    .maybeSingle();
  if (!data) redirect("/calendario");
  const event = toCalendarEvent(data as EventRow);

  const [{ data: rows, error }, { data: positions }, { data: secondary }] = await Promise.all([
    supabase.rpc("event_availability", { p_event_id: event.id }),
    // Orden de las posiciones según el deporte del club.
    supabase.from("positions").select("name").eq("sport", club?.sport ?? "").order("sort"),
    // Posición secundaria, para la vista cancha (RLS: jugadores del club).
    supabase.from("players").select("id, secondary_position").not("secondary_position", "is", null),
  ]);
  const players = (rows ?? []) as EventAvailabilityRow[];
  const summary = summarizeAvailability(players);

  // Convocatoria vigente (RLS: el staff ve las del club).
  const nomina =
    event.type === "competencia" &&
    !event.cancelled &&
    canManageNominas(roles, userId, club?.nomina_delegate_id);
  const { data: callups } = nomina
    ? await supabase
        .from("event_callups")
        .select("player_id")
        .eq("event_id", event.id)
        .is("removed_at", null)
    : { data: [] };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-6">
        <Link href={`/calendario?fecha=${event.day}&evento=${event.id}`} className={textButton}>
          ← Volver al calendario
        </Link>
        <p className="mt-2 text-sm text-muted">
          {EVENT_TYPE_LABEL[event.type]}
          {event.cancelled && " · Cancelado"}
        </p>
        <h1 className="text-2xl font-semibold text-ink">
          {nomina && <span className="sr-only">Nómina: </span>}
          {eventTitle(event)}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {longDayLabel(event.day)} · {event.start} – {event.end}
          {event.location && ` · ${event.location}`}
        </p>
        {!error && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink">
            <span
              className={`rounded-full px-2.5 py-0.5 font-medium ${
                event.past
                  ? "bg-mist text-ink"
                  : availableRatioOk(summary)
                    ? "bg-disponible-bg text-disponible-fg"
                    : "bg-revision-bg text-revision-fg"
              }`}
            >
              {summary.ok}/{summary.total} disponibles
            </span>
            <span className="text-muted">
              {event.past
                ? "Disponibilidad registrada al momento del evento."
                : "Disponibilidad proyectada para esa fecha."}
            </span>
          </p>
        )}
      </header>

      {error ? (
        <ErrorMessage>No se pudo cargar la disponibilidad del plantel.</ErrorMessage>
      ) : players.length === 0 ? (
        <p className={`p-5 text-sm text-muted ${cardClass}`}>
          No hay registros de disponibilidad del plantel para esa fecha.
        </p>
      ) : (
        <AvailablePlayers
          players={players}
          positions={(positions ?? []).map((p) => p.name as string)}
          sport={club?.sport ?? null}
          secondaryByPlayer={Object.fromEntries(
            (secondary ?? []).map((p) => [p.id as string, p.secondary_position as string]),
          )}
          nomina={
            nomina
              ? { eventId: event.id, selected: (callups ?? []).map((c) => c.player_id as string) }
              : null
          }
        />
      )}
    </main>
  );
}
