import Link from "next/link";
import { redirect } from "next/navigation";
import { isStaff } from "@/lib/roles";
import { canManageNominas, getLineupSize } from "@/lib/match-load";
import { getFormatContext } from "@/lib/format";
import { SEVENS_POSITIONS } from "@/lib/sevens";
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
  eventTimeLabel,
} from "@/lib/events";
import { ErrorMessage, cardClass, textButton } from "@/app/ui";
import { getSupabase } from "@/lib/session";
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
  // El evento solo necesita su id: sale en paralelo con la sesión. RLS: solo eventos
  // del club; un id inválido o ajeno no devuelve filas.
  const supabase = await getSupabase();
  const eventPromise = supabase.from("events").select(EVENT_COLUMNS).eq("id", eventId).maybeSingle();
  const { roles, club, userId, clubId } = await requireMember();
  if (!isStaff(roles)) redirect("/calendario");
  // Arma nóminas: head coach, manager y el delegado (solo decide qué se muestra y se pide).
  const canNomina = canManageNominas(roles, userId, club?.nomina_delegate_id);

  // Todo depende solo del id del evento y del club: en paralelo. La convocatoria y el
  // tamaño de la nómina se piden si la persona arma nóminas, y se usan solo en
  // competencias no canceladas, como antes.
  const [
    { data },
    { data: rows, error },
    { data: positions },
    { data: secondary },
    { data: callupRows },
    formatCtx,
  ] = await Promise.all([
    eventPromise,
    supabase.rpc("event_availability", { p_event_id: eventId }),
    // Orden de las posiciones según el deporte del club.
    supabase.from("positions").select("name").eq("sport", club?.sport ?? "").eq("format", "15").order("sort"),
    // Posición secundaria, para la vista cancha (jugadores del plantel activo).
    supabase.from("players").select("id, user_id, secondary_position").eq("club_id", clubId),
    // Convocatoria vigente (RLS: el staff ve las del club).
    canNomina
      ? supabase.from("event_callups").select("player_id, slot").eq("event_id", eventId).is("removed_at", null)
      : Promise.resolve({ data: [] }),
    // Grupo Sevens y su posición de Sevens (para los partidos de Sevens).
    getFormatContext(userId),
  ]);
  if (!data) redirect("/calendario");
  const event = toCalendarEvent(data as EventRow);
  // La nómina sigue el formato del evento, no el activo.
  const format = ((data as EventRow).format === "7" ? "7" : "15") as "15" | "7";
  const sevens = format === "7";
  const userOf = new Map((secondary ?? []).map((p) => [p.id as string, p.user_id as string | null]));
  const sevensOf = (playerId: string) => {
    const u = userOf.get(playerId);
    return u ? formatCtx.group.get(u) : undefined;
  };
  // En Sevens: solo el grupo, con su posición de Sevens.
  const allRows = (rows ?? []) as EventAvailabilityRow[];
  const players = sevens
    ? allRows
        .filter((r) => sevensOf(r.player_id) !== undefined)
        .map((r) => ({ ...r, player_position: sevensOf(r.player_id)?.position ?? null }))
    : allRows;
  const summary = summarizeAvailability(players);
  const secondaryByPlayer: Record<string, string> = {};
  for (const p of secondary ?? []) {
    const second = sevens ? sevensOf(p.id as string)?.secondary_position : (p.secondary_position as string | null);
    if (second) secondaryByPlayer[p.id as string] = second;
  }

  const nomina = event.type === "competencia" && !event.cancelled && canNomina;
  const callups = nomina ? callupRows : [];
  // Titulares y banca del formato del evento (Sevens: 7 + 5).
  const sizes = nomina ? await getLineupSize(supabase, club?.sport ?? "", format) : null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:max-w-6xl lg:px-8">
      <header className="mb-6">
        <Link href={`/calendario?fecha=${event.day}&evento=${event.id}`} className={textButton}>
          ← Volver al calendario
        </Link>
        <p className="mt-2 text-sm text-muted">
          {nomina ? "Nómina" : EVENT_TYPE_LABEL[event.type]}
          {sevens && " · Sevens"}
          {event.cancelled && " · Cancelado"}
        </p>
        <h1 className="text-2xl font-semibold text-ink">
          {eventTitle(event)}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {longDayLabel(event.day)} · {eventTimeLabel(event)}
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
          positions={sevens ? [...SEVENS_POSITIONS] : (positions ?? []).map((p) => p.name as string)}
          sport={club?.sport ?? null}
          format={format}
          secondaryByPlayer={secondaryByPlayer}
          nomina={
            nomina
              ? {
                  eventId: event.id,
                  lineup: (callups ?? []).map((c) => ({
                    player_id: c.player_id as string,
                    slot: (c.slot as number | null) ?? null,
                  })),
                  starters: sizes?.starters ?? 0,
                  bench: sizes?.bench ?? 0,
                }
              : null
          }
        />
      )}
    </main>
  );
}
