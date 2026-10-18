import Link from "next/link";
import { Plus } from "lucide-react";
import { canManageEvents, isStaff } from "@/lib/roles";
import { addDays, parseIsoDate, todayInChile } from "@/lib/injuries";
import {
  EVENT_COLUMNS,
  monthGridDays,
  summarizeAvailability,
  toCalendarEvent,
  type EventAvailabilityRow,
  type EventAvailabilitySummary,
  type EventRow,
} from "@/lib/events";
import { PageTitle, buttonPrimary } from "@/app/ui";
import { CalendarView } from "./calendar-view";
import { requireMember } from "./member";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Calendario del club. Todos los confirmados ven los eventos; el staff además ve
// la disponibilidad proyectada de cada uno, y head coach, manager y entrenador
// los crean, editan y cancelan.
//   ?fecha=YYYY-MM-DD  día de referencia: su mes (escritorio) y su semana (celular)
//   ?evento=<id>       evento con el detalle abierto
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { fecha, evento } = await searchParams;
  const today = todayInChile();
  const anchor = typeof fecha === "string" && parseIsoDate(fecha) !== null ? fecha : today;
  const selectedId = typeof evento === "string" && UUID_RE.test(evento) ? evento : null;

  const { supabase, roles } = await requireMember();
  // Solo deciden qué se muestra; las funciones de la base validan el permiso real.
  const staff = isStaff(roles);
  const canManage = canManageEvents(roles);

  // RLS: solo eventos del club. Se pide un día de margen a cada lado (en UTC) y
  // luego se filtra por el día en hora de Chile.
  const days = monthGridDays(anchor);
  const first = days[0];
  const last = days[days.length - 1];
  const { data: rows } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .gte("starts_at", `${addDays(first, -1)}T00:00:00Z`)
    .lt("starts_at", `${addDays(last, 2)}T00:00:00Z`)
    .order("starts_at");
  const now = new Date();
  const events = ((rows ?? []) as EventRow[])
    .map((r) => toCalendarEvent(r, now))
    .filter((e) => e.day >= first && e.day <= last);

  // Staff: disponibilidad proyectada de cada evento visible no cancelado, una
  // llamada por evento. Solo viajan al cliente los conteos y los primeros nombres.
  const availability: Record<string, EventAvailabilitySummary> = {};
  if (staff) {
    await Promise.all(
      events
        .filter((e) => !e.cancelled)
        .map(async (e) => {
          const { data } = await supabase.rpc("event_availability", { p_event_id: e.id });
          if (data) availability[e.id] = summarizeAvailability(data as EventAvailabilityRow[]);
        }),
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:max-w-6xl lg:px-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <PageTitle>Calendario</PageTitle>
        {canManage && (
          <Link href={`/calendario/nuevo?fecha=${anchor}`} className={`text-sm ${buttonPrimary}`}>
            <Plus aria-hidden="true" className="size-4" />
            Nuevo evento
          </Link>
        )}
      </header>

      <CalendarView
        key={`${anchor}-${selectedId ?? ""}`}
        anchor={anchor}
        today={today}
        days={days}
        events={events}
        availability={availability}
        staff={staff}
        canManage={canManage}
        initialSelectedId={selectedId}
      />
    </main>
  );
}
