import Link from "next/link";
import { Plus } from "lucide-react";
import { canManageEvents, isStaff } from "@/lib/roles";
import { canManageNominas } from "@/lib/match-load";
import { addDays, parseIsoDate, todayInChile } from "@/lib/injuries";
import {
  EVENT_COLUMNS,
  monthGridDays,
  summarizeAvailability,
  toCalendarEvent,
  type EventAvailabilityRow,
  type EventAvailabilitySummary,
  type EventRow,
  type GymEntry,
} from "@/lib/events";
import { PageTitle, buttonPrimary } from "@/app/ui";
import { CalendarView } from "../calendar-view";
import { requireMember } from "../member";
import { getActiveFormat, getSevensPlayerIds } from "@/lib/format";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Calendario del club. Todos los confirmados ven los eventos; el staff además ve
// la disponibilidad proyectada de cada uno, y head coach, manager y entrenador
// los crean, editan y cancelan.
//   ?fecha=YYYY-MM-DD  día de referencia: su mes (escritorio) y su semana (celular)
//   ?evento=<id>       evento con el detalle abierto
//   ?vista=mes         celular: vista mensual (por defecto, la semana)
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { fecha, evento, vista } = await searchParams;
  const mobileView = vista === "mes" ? "mes" : "semana";
  const today = todayInChile();
  const anchor = typeof fecha === "string" && parseIsoDate(fecha) !== null ? fecha : today;
  const selectedId = typeof evento === "string" && UUID_RE.test(evento) ? evento : null;

  const { supabase, roles, userId, club, clubId } = await requireMember();
  // Solo deciden qué se muestra; las funciones de la base validan el permiso real.
  const staff = isStaff(roles);
  const canManage = canManageEvents(roles);
  const canNomina = canManageNominas(roles, userId, club?.nomina_delegate_id);

  // Eventos del plantel activo. Se pide un día de margen a cada lado (en UTC) y
  // luego se filtra por el día en hora de Chile.
  const days = monthGridDays(anchor);
  const first = days[0];
  const last = days[days.length - 1];
  // Solo los eventos del formato activo (Rugby 15 o Sevens). Los eventos del mes se
  // piden en paralelo con el formato y se filtran aquí, sin esperar uno al otro.
  const [format, { data: rows }, { data: gymRows }] = await Promise.all([
    getActiveFormat(userId),
    supabase
      .from("events")
      .select(EVENT_COLUMNS)
      .eq("club_id", clubId)
      .gte("starts_at", `${addDays(first, -1)}T00:00:00Z`)
      .lt("starts_at", `${addDays(last, 2)}T00:00:00Z`)
      .order("starts_at"),
    // Sesiones de gimnasio (solo lectura). Si falla, el calendario sigue sin ellas.
    supabase.rpc("gym_calendar", { p_from: first, p_to: last, p_format: "15" }),
  ]);
  const gym = ((gymRows ?? []) as GymEntry[]).filter((g) => g.day >= first && g.day <= last);
  const sevensIdsPromise = format === "7" ? getSevensPlayerIds(userId) : Promise.resolve(null);
  const now = new Date();
  const events = ((rows ?? []) as EventRow[])
    .filter((r) => (r.format === "7" ? "7" : "15") === format)
    .map((r) => toCalendarEvent(r, now))
    .filter((e) => e.day >= first && e.day <= last);

  // Staff: disponibilidad proyectada de cada evento visible no cancelado, una
  // llamada por evento. Solo viajan al cliente los conteos y los primeros nombres.
  const availability: Record<string, EventAvailabilitySummary> = {};
  const sevensIds = await sevensIdsPromise;
  // Staff: entrenamientos ya empezados que tienen lista guardada (los demás muestran
  // "Asistencia sin registrar").
  const pastTrainings = staff
    ? events.filter((e) => e.type === "entrenamiento" && e.past && !e.cancelled).map((e) => e.id)
    : [];
  const attendancePromise =
    pastTrainings.length > 0
      ? supabase
          .from("event_attendance")
          .select("event_id")
          .in("event_id", pastTrainings)
          .then(({ data }) => [...new Set((data ?? []).map((r) => r.event_id as string))])
      : Promise.resolve([] as string[]);
  if (staff) {
    await Promise.all(
      events
        .filter((e) => !e.cancelled)
        .map(async (e) => {
          const { data } = await supabase.rpc("event_availability", { p_event_id: e.id });
          if (!data) return;
          // En Sevens cuenta solo el grupo Sevens.
          const rows = (data as EventAvailabilityRow[]).filter((r) => !sevensIds || sevensIds.has(r.player_id));
          availability[e.id] = summarizeAvailability(rows);
        }),
    );
  }
  const attendanceSaved = await attendancePromise;

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
        key={`${anchor}-${selectedId ?? ""}-${mobileView}`}
        mobileView={mobileView}
        anchor={anchor}
        today={today}
        days={days}
        events={events}
        gym={gym}
        gymHref={staff ? "/planes" : "/mi-plan"}
        availability={availability}
        staff={staff}
        canManage={canManage}
        canNomina={canNomina}
        attendanceSaved={attendanceSaved}
        initialSelectedId={selectedId}
      />
    </main>
  );
}
