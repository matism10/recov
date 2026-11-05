import Link from "next/link";
import { redirect } from "next/navigation";
import {
  EVENT_COLUMNS,
  EVENT_TYPE_LABEL,
  eventTimeLabel,
  longDayLabel,
  toCalendarEvent,
  type EventRow,
} from "@/lib/events";
import { isStaff } from "@/lib/roles";
import { getSevensPlayerIds } from "@/lib/format";
import { PageTitle, cardClass, textButton } from "@/app/ui";
import { getSupabase } from "@/lib/session";
import { requireMember } from "../../member";
import { AttendanceForm, type AttendanceEntry } from "./attendance-form";

// Pasar lista de un entrenamiento ya empezado (cualquier staff). La lista es el
// plantel confirmado y activo (en un entrenamiento Sevens, el grupo Sevens), igual
// que la de set_event_attendance. Si ya hay lista guardada, se precarga.
export default async function AttendancePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  // El evento y lo guardado solo necesitan su id: salen en paralelo con la sesión.
  const supabase = await getSupabase();
  const eventPromise = supabase.from("events").select(EVENT_COLUMNS).eq("id", eventId).maybeSingle();
  const savedPromise = supabase.from("event_attendance").select("player_id, present").eq("event_id", eventId);
  const { roles, clubId, userId } = await requireMember();
  if (!isStaff(roles)) redirect("/calendario");

  const { data } = await eventPromise;
  if (!data) redirect("/calendario");
  const row = data as EventRow;
  const event = toCalendarEvent(row);
  const back = `/calendario?fecha=${event.day}&evento=${event.id}`;
  if (event.type !== "entrenamiento" || event.cancelled) redirect(back);

  const header = (
    <header className="mb-6">
      <Link href={back} className={textButton}>
        ← Volver al calendario
      </Link>
      <PageTitle className="mt-2">Pasar lista</PageTitle>
      <p className="mt-1 text-sm text-muted">
        {EVENT_TYPE_LABEL[event.type]} · {longDayLabel(event.day)} · {eventTimeLabel(event)}
        {event.location && ` · ${event.location}`}
      </p>
    </header>
  );

  if (!event.past) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        {header}
        <p className={`p-5 text-sm text-muted ${cardClass}`}>
          El entrenamiento todavía no empieza. Podrás pasar lista desde que comience.
        </p>
      </main>
    );
  }

  const sevens = row.format === "7";
  const [{ data: players }, { data: saved }, sevensIds] = await Promise.all([
    supabase
      .from("players")
      .select("id, full_name, position, availability")
      .eq("club_id", clubId)
      .eq("active", true)
      .eq("status", "confirmado")
      .order("full_name"),
    savedPromise,
    sevens ? getSevensPlayerIds(userId) : Promise.resolve(null),
  ]);

  const entries: AttendanceEntry[] = (players ?? [])
    .filter((p) => !sevensIds || sevensIds.has(p.id))
    .map((p) => ({
      playerId: p.id,
      name: p.full_name,
      position: p.position,
      injured: p.availability === "lesionado",
    }));
  const savedRows = saved ?? [];
  const initialAbsent = savedRows.filter((r) => !r.present).map((r) => r.player_id);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      {header}
      {entries.length === 0 ? (
        <p className={`p-5 text-sm text-muted ${cardClass}`}>
          {sevens ? "El grupo Sevens no tiene jugadores confirmados." : "El plantel no tiene jugadores confirmados."}
        </p>
      ) : (
        <AttendanceForm
          eventId={event.id}
          entries={entries}
          initialAbsent={initialAbsent}
          saved={savedRows.length > 0}
        />
      )}
    </main>
  );
}
