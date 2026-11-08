"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChartColumn, ChevronLeft, ChevronRight, ClipboardList, Dumbbell, ListChecks } from "lucide-react";
import { addDays } from "@/lib/injuries";
import {
  WEEKDAY_LABELS,
  availableRatioOk,
  eventTitle,
  longDayLabel,
  monthLabel,
  shiftMonth,
  shortDayLabel,
  weekDays,
  weekStart,
  type CalendarEvent,
  type GymEntry,
  type EventAvailabilitySummary,
  type SummaryPlayer,
  eventTimeLabel,
} from "@/lib/events";
import {
  ErrorMessage,
  SectionTitle,
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  cardClass,
  textButton,
} from "@/app/ui";
import { cancelEvent } from "./actions";
import { EventDetails, EventSheet } from "./event-sheet";

type Props = {
  mobileView: "semana" | "mes";
  anchor: string;
  today: string;
  days: string[];
  events: CalendarEvent[];
  gym: GymEntry[]; // sesiones de gimnasio (solo lectura, todo el día)
  gymHref: string; // /mi-plan (jugador) o /planes (staff)
  availability: Record<string, EventAvailabilitySummary>;
  staff: boolean;
  canManage: boolean;
  canNomina: boolean;
  attendanceSaved: string[]; // entrenamientos empezados con lista guardada (staff)
  initialSelectedId: string | null;
};

const navButton =
  "inline-flex size-11 items-center justify-center rounded-xl border border-line bg-white text-ink transition hover:bg-mist";

export function CalendarView({
  mobileView,
  anchor,
  today,
  days,
  events,
  gym,
  gymHref,
  availability,
  staff,
  canManage,
  canNomina,
  attendanceSaved,
  initialSelectedId,
}: Props) {
  const [selectedId, setSelectedId] = useState(
    events.some((e) => e.id === initialSelectedId) ? initialSelectedId : null,
  );
  const selected = events.find((e) => e.id === selectedId) ?? null;

  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);

  const gymByDay = new Map<string, GymEntry[]>();
  for (const g of gym) gymByDay.set(g.day, [...(gymByDay.get(g.day) ?? []), g]);
  const gymProps = { gymByDay, gymHref };

  const savedLists = new Set(attendanceSaved);
  const chipProps = {
    availability,
    savedLists,
    staff,
    selectedId,
    onSelect: setSelectedId,
  };

  // Celular: la vista (semana o mes) y la semana mostrada cambian en el cliente
  // mientras caigan dentro de la grilla del mes que ya trajo el servidor (sin otro
  // viaje). La URL se actualiza con replaceState para que recargar o compartir
  // muestre lo mismo. Fuera de la grilla, se navega y el servidor trae el otro mes.
  const router = useRouter();
  const [view, setView] = useState(mobileView);
  const [weekAnchor, setWeekAnchor] = useState(anchor);
  const loaded = (week: string[]) => week[0] >= days[0] && week[6] <= days[days.length - 1];
  const syncUrl = (fecha: string, v: "semana" | "mes") =>
    window.history.replaceState(null, "", `/calendario?fecha=${fecha}${v === "mes" ? "&vista=mes" : ""}`);

  const showWeek = (date: string) => {
    if (!loaded(weekDays(date))) return router.push(`/calendario?fecha=${date}`);
    setWeekAnchor(date);
    setView("semana");
    syncUrl(date, "semana");
  };
  const showMonth = () => {
    // El mes de la grilla cargada, si la semana actual toca ese mes.
    const month = anchor.slice(0, 7);
    if (!weekDays(weekAnchor).some((d) => d.slice(0, 7) === month)) {
      return router.push(`/calendario?fecha=${weekAnchor}&vista=mes`);
    }
    setView("mes");
    syncUrl(weekAnchor, "mes");
  };

  return (
    <div>
      <MonthGrid anchor={anchor} today={today} days={days} byDay={byDay} {...gymProps} {...chipProps} />
      {/* Celular: semana (por defecto) o mes. */}
      <ViewToggle view={view} onWeek={() => showWeek(weekAnchor)} onMonth={showMonth} />
      {view === "mes" ? (
        <MobileMonth
          anchor={anchor}
          today={today}
          days={days}
          byDay={byDay}
          initialDay={selected?.day ?? (weekAnchor.slice(0, 7) === anchor.slice(0, 7) ? weekAnchor : null)}
          onPickDay={setWeekAnchor}
          {...gymProps}
          {...chipProps}
        />
      ) : (
        <WeekList
          anchor={weekAnchor}
          today={today}
          byDay={byDay}
          loaded={loaded}
          onShowWeek={showWeek}
          {...gymProps}
          {...chipProps}
        />
      )}
      {selected && (
        <EventPanel
          key={selected.id}
          event={selected}
          summary={availability[selected.id]}
          staff={staff}
          canManage={canManage}
          canNomina={canNomina}
          listSaved={savedLists.has(selected.id)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

type GymProps = {
  gymByDay: Map<string, GymEntry[]>;
  gymHref: string;
};

type ChipProps = {
  availability: Record<string, EventAvailabilitySummary>;
  savedLists: Set<string>;
  staff: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

// ---------------------------------------------------------------------------
// Escritorio: grilla mensual de lunes a domingo
// ---------------------------------------------------------------------------
function MonthGrid({
  anchor,
  today,
  days,
  byDay,
  gymByDay,
  gymHref,
  ...chipProps
}: {
  anchor: string;
  today: string;
  days: string[];
  byDay: Map<string, CalendarEvent[]>;
} & GymProps & ChipProps) {
  const month = anchor.slice(0, 7);
  return (
    <section aria-label="Mes" className="hidden lg:block">
      <div className="mb-4 flex items-center gap-2">
        <Link href={`/calendario?fecha=${shiftMonth(anchor, -1)}`} className={navButton}>
          <ChevronLeft aria-hidden="true" className="size-5" />
          <span className="sr-only">Mes anterior</span>
        </Link>
        <Link href={`/calendario?fecha=${shiftMonth(anchor, 1)}`} className={navButton}>
          <ChevronRight aria-hidden="true" className="size-5" />
          <span className="sr-only">Mes siguiente</span>
        </Link>
        <SectionTitle className="ml-2 flex-1">{monthLabel(anchor)}</SectionTitle>
        {month !== today.slice(0, 7) && (
          <Link href="/calendario" className={`text-sm ${buttonSecondary}`}>
            Hoy
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-line">
        <div className="grid grid-cols-7 border-b border-line bg-mist text-xs font-medium text-muted">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="px-2 py-2">
              {d}
            </div>
          ))}
        </div>
        <ol className="grid grid-cols-7">
          {days.map((day, i) => {
            const inMonth = day.slice(0, 7) === month;
            const isToday = day === today;
            const dayEvents = byDay.get(day) ?? [];
            return (
              <li
                key={day}
                aria-label={`${longDayLabel(day)}${isToday ? " (hoy)" : ""}`}
                className={`min-h-28 space-y-1 p-1.5 ${i % 7 !== 6 ? "border-r" : ""} ${
                  i < days.length - 7 ? "border-b" : ""
                } border-line ${inMonth ? "bg-white" : "bg-mist"}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex size-7 items-center justify-center rounded-full text-sm ${
                    isToday
                      ? "bg-brand font-semibold text-ink"
                      : inMonth
                        ? "text-ink"
                        : "text-muted"
                  }`}
                >
                  {Number(day.slice(8))}
                </span>
                {dayEvents.map((e) => (
                  <EventChip key={e.id} event={e} {...chipProps} />
                ))}
                {(gymByDay.get(day) ?? []).map((g) => (
                  <GymChip key={g.session_id} entry={g} href={gymHref} />
                ))}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Celular: selector de vista (semana o mes); conserva el día de referencia
// ---------------------------------------------------------------------------
function ViewToggle({
  view,
  onWeek,
  onMonth,
}: {
  view: "semana" | "mes";
  onWeek: () => void;
  onMonth: () => void;
}) {
  const options = [
    { value: "semana", label: "Semana", onClick: onWeek },
    { value: "mes", label: "Mes", onClick: onMonth },
  ] as const;
  return (
    <div
      role="group"
      aria-label="Vista del calendario"
      className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-line bg-mist p-1 lg:hidden"
    >
      {options.map((o) => {
        const active = view === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={active ? undefined : o.onClick}
            aria-pressed={active}
            className={`flex min-h-11 items-center justify-center rounded-lg text-sm font-medium transition ${
              active ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Celular: el mes en una grilla compacta; al tocar un día, sus eventos debajo
// ---------------------------------------------------------------------------
const DOT_STYLE = {
  entrenamiento: "bg-ink/40",
  competencia: "bg-brand-strong",
};

function MobileMonth({
  anchor,
  today,
  days,
  byDay,
  initialDay,
  onPickDay,
  gymByDay,
  gymHref,
  ...chipProps
}: {
  anchor: string;
  today: string;
  days: string[];
  byDay: Map<string, CalendarEvent[]>;
  initialDay: string | null;
  // El día elegido pasa a ser la semana que se ve al volver a "Semana".
  onPickDay: (day: string) => void;
} & GymProps & ChipProps) {
  const month = anchor.slice(0, 7);
  const inMonth = (d: string) => d.slice(0, 7) === month;
  // Día elegido: el del evento abierto, hoy si es de este mes, el primero con
  // eventos o el primero del mes.
  const [day, setDay] = useState(
    () =>
      initialDay ??
      (inMonth(today) ? today : null) ??
      days.find((d) => inMonth(d) && byDay.has(d)) ??
      `${month}-01`,
  );
  const dayEvents = byDay.get(day) ?? [];
  const dayGym = gymByDay.get(day) ?? [];

  return (
    <section aria-label="Mes" className="lg:hidden">
      <div className="mb-4 flex items-center gap-2">
        <Link href={`/calendario?fecha=${shiftMonth(anchor, -1)}&vista=mes`} className={navButton}>
          <ChevronLeft aria-hidden="true" className="size-5" />
          <span className="sr-only">Mes anterior</span>
        </Link>
        <Link href={`/calendario?fecha=${shiftMonth(anchor, 1)}&vista=mes`} className={navButton}>
          <ChevronRight aria-hidden="true" className="size-5" />
          <span className="sr-only">Mes siguiente</span>
        </Link>
        <h2 className="ml-1 flex-1 text-base font-semibold text-ink">{monthLabel(anchor)}</h2>
        {month !== today.slice(0, 7) && (
          <Link href="/calendario?vista=mes" className={`text-sm ${buttonSecondary}`}>
            Hoy
          </Link>
        )}
      </div>

      <div className="grid grid-cols-7 text-center text-xs font-medium text-muted">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-y-1">
        {days.map((d) => {
          const events = byDay.get(d) ?? [];
          const gymCount = (gymByDay.get(d) ?? []).length;
          const isToday = d === today;
          const chosen = d === day;
          return (
            <li key={d} className="min-w-0">
              <button
                type="button"
                onClick={() => {
                  setDay(d);
                  onPickDay(d);
                }}
                aria-pressed={chosen}
                aria-label={`${longDayLabel(d)}${isToday ? " (hoy)" : ""}${
                  events.length > 0
                    ? `, ${events.length} ${events.length === 1 ? "evento" : "eventos"}`
                    : ""
                }${gymCount > 0 ? ", gimnasio" : ""}`}
                className={`flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-lg transition ${
                  chosen ? "bg-brand-soft" : "hover:bg-mist"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex size-7 items-center justify-center rounded-full text-sm ${
                    isToday
                      ? "bg-brand font-semibold text-ink"
                      : inMonth(d)
                        ? "text-ink"
                        : "text-muted"
                  }`}
                >
                  {Number(d.slice(8))}
                </span>
                <span aria-hidden="true" className="flex h-1.5 gap-0.5">
                  {gymCount > 0 && <span className="size-1.5 rounded-full bg-emerald-500" />}
                  {events.slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      className={`size-1.5 rounded-full ${
                        e.cancelled ? "bg-line" : DOT_STYLE[e.type]
                      }`}
                    />
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <h3 className="mt-6 mb-2 text-sm font-medium text-muted">{longDayLabel(day)}</h3>
      {dayEvents.length > 0 || dayGym.length > 0 ? (
        <ul className="space-y-2">
          {dayEvents.map((e) => (
            <li key={e.id}>
              <EventChip event={e} wide {...chipProps} />
            </li>
          ))}
          {dayGym.map((g) => (
            <li key={g.session_id}>
              <GymChip entry={g} href={gymHref} wide />
            </li>
          ))}
        </ul>
      ) : (
        <p className={`px-4 py-3 text-sm text-muted ${cardClass}`}>Sin eventos</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Celular: la semana en lista, un bloque por día
// ---------------------------------------------------------------------------
function WeekList({
  anchor,
  today,
  byDay,
  loaded,
  onShowWeek,
  gymByDay,
  gymHref,
  ...chipProps
}: {
  anchor: string;
  today: string;
  byDay: Map<string, CalendarEvent[]>;
  loaded: (week: string[]) => boolean;
  onShowWeek: (date: string) => void;
} & GymProps & ChipProps) {
  const week = weekDays(anchor);
  const start = weekStart(anchor);
  const inThisWeek = week.includes(today);
  const prev = addDays(start, -7);
  const next = addDays(start, 7);
  return (
    <section aria-label="Semana" className="lg:hidden">
      <div className="mb-4 flex items-center gap-2">
        <WeekStep date={prev} href={`/calendario?fecha=${prev}`} loaded={loaded} onShowWeek={onShowWeek} className={navButton}>
          <ChevronLeft aria-hidden="true" className="size-5" />
          <span className="sr-only">Semana anterior</span>
        </WeekStep>
        <WeekStep date={next} href={`/calendario?fecha=${next}`} loaded={loaded} onShowWeek={onShowWeek} className={navButton}>
          <ChevronRight aria-hidden="true" className="size-5" />
          <span className="sr-only">Semana siguiente</span>
        </WeekStep>
        <h2 className="ml-1 flex-1 text-base font-semibold text-ink">
          {shortDayLabel(week[0])} – {shortDayLabel(week[6])}
        </h2>
        {!inThisWeek && (
          <WeekStep date={today} href="/calendario" loaded={loaded} onShowWeek={onShowWeek} className={`text-sm ${buttonSecondary}`}>
            Hoy
          </WeekStep>
        )}
      </div>

      <ol className="space-y-4">
        {week.map((day) => {
          const dayEvents = byDay.get(day) ?? [];
          const dayGym = gymByDay.get(day) ?? [];
          const isToday = day === today;
          return (
            <li key={day}>
              <h3
                className={`mb-2 flex items-center gap-2 text-sm font-medium ${
                  isToday ? "text-brand-text" : "text-muted"
                }`}
              >
                {longDayLabel(day)}
                {isToday && (
                  <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-ink">
                    Hoy
                  </span>
                )}
              </h3>
              {dayEvents.length > 0 || dayGym.length > 0 ? (
                <ul className="space-y-2">
                  {dayEvents.map((e) => (
                    <li key={e.id}>
                      <EventChip event={e} wide {...chipProps} />
                    </li>
                  ))}
                  {dayGym.map((g) => (
                    <li key={g.session_id}>
                      <GymChip entry={g} href={gymHref} wide />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={`px-4 py-3 text-sm text-muted ${cardClass}`}>Sin eventos</p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// Paso de semana: un botón si la semana ya está cargada (cambio inmediato en el
// cliente); si no, un link que trae el otro mes del servidor.
function WeekStep({
  date,
  href,
  loaded,
  onShowWeek,
  className,
  children,
}: {
  date: string;
  href: string;
  loaded: (week: string[]) => boolean;
  onShowWeek: (date: string) => void;
  className: string;
  children: React.ReactNode;
}) {
  if (!loaded(weekDays(date))) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => onShowWeek(date)} className={className}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Chip de evento: entrenamiento neutro, competencia con acento de marca
// ---------------------------------------------------------------------------
const CHIP_STYLE = {
  entrenamiento: "border-line bg-white text-ink hover:bg-mist",
  competencia: "border-brand bg-brand-soft text-brand-text hover:border-brand-strong",
};

// Sesión de gimnasio: solo lectura, todo el día (sin hora). Lleva a /mi-plan o /planes.
function GymChip({ entry, href, wide = false }: { entry: GymEntry; href: string; wide?: boolean }) {
  return (
    <Link
      href={href}
      title={entry.title}
      className={`block w-full rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 transition hover:border-emerald-400 ${
        wide ? "min-h-11 px-4 py-3" : "px-1.5 py-1 text-xs"
      }`}
    >
      <span className="flex items-center gap-1.5">
        <Dumbbell aria-hidden="true" className={wide ? "size-4" : "size-3"} />
        <span className={wide ? "text-sm font-medium" : "font-medium"}>Gimnasio</span>
        {wide && <span className="text-sm text-emerald-800/80">· Todo el día</span>}
      </span>
      {wide && <span className="mt-0.5 block truncate text-sm">{entry.title}</span>}
    </Link>
  );
}

function EventChip({
  event,
  wide = false,
  availability,
  savedLists,
  staff,
  selectedId,
  onSelect,
}: { event: CalendarEvent; wide?: boolean } & ChipProps) {
  const summary = availability[event.id];
  const selected = selectedId === event.id;
  return (
    <button
      type="button"
      onClick={() => onSelect(event.id)}
      aria-pressed={selected}
      className={`block w-full rounded-lg border text-left transition ${CHIP_STYLE[event.type]} ${
        selected ? "ring-2 ring-brand-strong" : ""
      } ${event.cancelled ? "opacity-60" : ""} ${wide ? "min-h-11 px-4 py-3" : "px-1.5 py-1 text-xs"}`}
    >
      <span className="flex items-center justify-between gap-1">
        <span className={wide ? "text-sm text-muted" : "font-medium"}>
          {wide ? eventTimeLabel(event) : event.start}
        </span>
        {staff && !event.cancelled && summary && (
          <AvailabilityCount summary={summary} past={event.past} />
        )}
      </span>
      <span
        className={`block truncate ${wide ? "mt-0.5 font-medium" : ""} ${
          event.cancelled ? "line-through" : ""
        }`}
      >
        {event.cancelled && <span className="sr-only">Cancelado: </span>}
        {eventTitle(event)}
      </span>
      {wide && event.location && (
        <span className="mt-0.5 block truncate text-sm text-muted">{event.location}</span>
      )}
      {wide && staff && listMissing(event, savedLists) && (
        <span className="mt-1 block">
          <AttendanceMissing />
        </span>
      )}
    </button>
  );
}

// Entrenamiento ya empezado, no cancelado y sin lista guardada (solo staff).
function listMissing(event: CalendarEvent, savedLists: Set<string>) {
  return event.type === "entrenamiento" && event.past && !event.cancelled && !savedLists.has(event.id);
}

function AttendanceMissing() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-revision-bg px-2 py-0.5 text-xs font-medium text-revision-fg">
      <ListChecks aria-hidden="true" className="size-3.5" />
      Asistencia sin registrar
    </span>
  );
}

// "disponibles/total" en eventos futuros; "Histórico" en los pasados.
function AvailabilityCount({
  summary,
  past,
}: {
  summary: EventAvailabilitySummary;
  past: boolean;
}) {
  if (past) {
    return <span className="text-[11px] font-normal text-muted no-underline">Histórico</span>;
  }
  const good = availableRatioOk(summary);
  return (
    <span
      className={`shrink-0 rounded-full px-1.5 text-[11px] font-medium ${
        good ? "bg-disponible-bg text-disponible-fg" : "bg-revision-bg text-revision-fg"
      }`}
    >
      <span aria-hidden="true">
        {summary.ok}/{summary.total}
      </span>
      <span className="sr-only">
        {summary.ok} de {summary.total} disponibles
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Detalle del evento: panel lateral en escritorio, hoja inferior en celular
// ---------------------------------------------------------------------------
function EventPanel({
  event,
  summary,
  staff,
  canManage,
  canNomina,
  listSaved,
  onClose,
}: {
  event: CalendarEvent;
  summary: EventAvailabilitySummary | undefined;
  staff: boolean;
  canManage: boolean;
  canNomina: boolean;
  listSaved: boolean;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Al abrir el detalle (cada evento monta su propio panel): en escritorio queda
  // bajo la grilla, así que se desplaza hasta él; el foco va al título.
  const cancel = () =>
    startTransition(async () => {
      const result = await cancelEvent(event.id);
      if (result.error) setError(result.error);
      setConfirming(false);
    });

  return (
    <EventSheet
      event={event}
      inline
      onClose={onClose}
      badges={
        staff && event.type === "entrenamiento" && event.past && !event.cancelled && !listSaved && <AttendanceMissing />
      }
    >
    {/* Escritorio: datos y acciones a la izquierda, plantel a la derecha. */}
    <div className="lg:mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-8">
      <div>
        <EventDetails event={event} />

        {/* Nómina: antes del partido se arma la convocatoria; una vez empezado,
            se carga la participación. Solo head coach, manager y el delegado. */}
        {canNomina && event.type === "competencia" && !event.cancelled && (
          <div className="mt-6 border-t border-line pt-4">
            {event.past ? (
              <Link
                href={`/calendario/${event.id}/participacion`}
                className={`w-full text-sm lg:w-auto ${buttonPrimary}`}
              >
                <ClipboardList aria-hidden="true" className="size-4" />
                Cargar participación
              </Link>
            ) : (
              <Link
                href={`/calendario/${event.id}/disponibles`}
                className={`w-full text-sm lg:w-auto ${buttonPrimary}`}
              >
                <ClipboardList aria-hidden="true" className="size-4" />
                Armar nómina
              </Link>
            )}
          </div>
        )}

        {/* Asistencia: cualquier staff pasa lista desde que el entrenamiento empieza. */}
        {staff && event.type === "entrenamiento" && !event.cancelled && (
          <div className="mt-6 space-y-2 border-t border-line pt-4">
            {event.past ? (
              <Link
                href={`/calendario/${event.id}/asistencia`}
                className={`w-full text-sm lg:w-auto ${buttonPrimary}`}
              >
                <ListChecks aria-hidden="true" className="size-4" />
                Pasar lista
              </Link>
            ) : (
              <>
                <button type="button" disabled className={`w-full text-sm lg:w-auto ${buttonPrimary}`}>
                  <ListChecks aria-hidden="true" className="size-4" />
                  Pasar lista
                </button>
                <p className="text-xs text-muted">Se habilita cuando empiece el entrenamiento.</p>
              </>
            )}
            {event.past && listSaved && (
              <p className="text-xs text-muted">Lista guardada. Puedes corregirla.</p>
            )}
          </div>
        )}

        {/* Reportes de esfuerzo y bienestar: todo el staff, desde que el evento empieza. */}
        {staff && !event.cancelled && (
          <div className="mt-6 space-y-2 border-t border-line pt-4">
            {event.past ? (
              <Link
                href={`/calendario/${event.id}/reportes`}
                className={`w-full text-sm lg:w-auto ${buttonSecondary}`}
              >
                <ChartColumn aria-hidden="true" className="size-4" />
                Reportes
              </Link>
            ) : (
              <>
                <button type="button" disabled className={`w-full text-sm lg:w-auto ${buttonSecondary}`}>
                  <ChartColumn aria-hidden="true" className="size-4" />
                  Reportes
                </button>
                <p className="text-xs text-muted">
                  Se habilita cuando empiece {event.type === "competencia" ? "el partido" : "el entrenamiento"}.
                </p>
              </>
            )}
          </div>
        )}

        {canManage && !event.cancelled && (
          <div className="mt-6 space-y-3 border-t border-line pt-4">
            {confirming ? (
              <div className="space-y-3">
                <p className="text-sm text-ink">
                  ¿Cancelar este evento? Seguirá en el calendario marcado como cancelado.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={cancel}
                    disabled={pending}
                    className={`text-sm ${buttonDanger}`}
                  >
                    {pending ? "Cancelando…" : "Sí, cancelar evento"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    disabled={pending}
                    className={textButton}
                  >
                    No, volver
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/calendario/${event.id}/editar`}
                  className={`text-sm ${buttonSecondary}`}
                >
                  Editar
                </Link>
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className={`text-sm ${buttonSecondary}`}
                >
                  Cancelar evento
                </button>
              </div>
            )}
            {error && <ErrorMessage>{error}</ErrorMessage>}
          </div>
        )}
      </div>

      {staff && !event.cancelled && (
        <SquadSummary eventId={event.id} summary={summary} past={event.past} />
      )}
    </div>
    </EventSheet>
  );
}

const COUNT_STYLE = {
  ok: "bg-disponible-bg text-disponible-fg",
  duda: "bg-revision-bg text-revision-fg",
  no: "bg-lesionado-bg text-lesionado-fg",
};

// Panel de plantel (solo staff): tres contadores y los primeros no disponibles y en duda.
function SquadSummary({
  eventId,
  summary,
  past,
}: {
  eventId: string;
  summary: EventAvailabilitySummary | undefined;
  past: boolean;
}) {
  if (!summary) {
    return (
      <ErrorMessage className="mt-6 lg:mt-0">
        No se pudo cargar la disponibilidad del plantel.
      </ErrorMessage>
    );
  }
  // Evento pasado sin registros de disponibilidad anteriores a su inicio.
  if (summary.total === 0) {
    return (
      <section className="mt-6 border-t border-line pt-4 lg:mt-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
        <h3 className="text-sm font-medium text-ink">Plantel</h3>
        <p className="mt-1 text-sm text-muted">
          No hay registros de disponibilidad del plantel para esa fecha.
        </p>
      </section>
    );
  }
  return (
    <section className="mt-6 border-t border-line pt-4 lg:mt-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
      <h3 className="text-sm font-medium text-ink">Plantel</h3>
      <p className="text-xs text-muted">
        {past
          ? "Disponibilidad registrada al momento del evento."
          : "Disponibilidad proyectada para esa fecha."}
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {(
          [
            ["ok", "Disponibles", summary.ok],
            ["duda", "En duda", summary.duda],
            ["no", "No disponibles", summary.no],
          ] as const
        ).map(([key, label, value]) => (
          <div
            key={key}
            className={`flex flex-col-reverse rounded-xl px-2 py-2 ${COUNT_STYLE[key]}`}
          >
            <dt className="text-xs">{label}</dt>
            <dd className="font-display text-xl font-bold">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="sm:grid sm:grid-cols-2 sm:gap-6">
        <NameList title="No disponibles" players={summary.no_players} total={summary.no} />
        <NameList title="En duda" players={summary.duda_players} total={summary.duda} />
      </div>

      <Link
        href={`/calendario/${eventId}/disponibles`}
        className={`mt-4 w-full text-sm lg:w-auto ${buttonPrimary}`}
      >
        Ver jugadores disponibles para esa fecha
      </Link>
    </section>
  );
}

function NameList({
  title,
  players,
  total,
}: {
  title: string;
  players: SummaryPlayer[];
  total: number;
}) {
  if (total === 0) return null;
  return (
    <div className="mt-4">
      <h4 className="text-xs font-medium text-muted">{title}</h4>
      <ul className="mt-1 space-y-1 text-sm text-ink">
        {players.map((p, i) => (
          <li key={i}>
            {p.name}
            {p.position && <span className="text-muted"> · {p.position}</span>}
          </li>
        ))}
        {total > players.length && <li className="text-muted">y {total - players.length} más</li>}
      </ul>
    </div>
  );
}
