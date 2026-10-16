import Link from "next/link";
import { redirect } from "next/navigation";
import { canManageEvents } from "@/lib/roles";
import { EVENT_COLUMNS, EVENT_TYPE_LABEL, toCalendarEvent, type EventRow } from "@/lib/events";
import { textButton } from "@/app/ui";
import { EventForm } from "../../event-form";
import { requireMember } from "../../member";

// Editar una ocurrencia: solo head coach, manager y entrenador (update_event lo
// verifica). Los eventos cancelados no se editan.
export default async function EditEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { supabase, roles } = await requireMember();
  if (!canManageEvents(roles)) redirect("/calendario");

  // RLS: solo eventos del club; un id inválido o ajeno no devuelve filas.
  const { data } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("id", eventId)
    .maybeSingle();
  if (!data) redirect("/calendario");
  const event = toCalendarEvent(data as EventRow);
  if (event.cancelled) redirect(`/calendario?fecha=${event.day}&evento=${event.id}`);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <header className="mb-6">
        <Link href={`/calendario?fecha=${event.day}&evento=${event.id}`} className={textButton}>
          ← Volver al calendario
        </Link>
        <p className="mt-2 text-sm text-muted">{EVENT_TYPE_LABEL[event.type]}</p>
        <h1 className="text-2xl font-semibold text-ink">Editar evento</h1>
        {event.repeated && (
          <p className="mt-1 text-sm text-muted">
            Los cambios aplican solo a este evento, no a los demás de la repetición.
          </p>
        )}
      </header>
      <EventForm
        eventId={event.id}
        defaults={{
          type: event.type,
          date: event.day,
          start: event.start,
          end: event.end,
          location: event.location ?? "",
          opponent: event.opponent ?? "",
          notes: event.notes ?? "",
        }}
      />
    </main>
  );
}
