"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, MapPin, Swords, X } from "lucide-react";
import { addDays } from "@/lib/injuries";
import {
  EVENT_TYPE_LABEL,
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
  type EventAvailabilitySummary,
} from "@/lib/events";
import { ErrorMessage, buttonDanger, buttonPrimary, buttonSecondary, cardClass, textButton } from "@/app/ui";
import { cancelEvent } from "./actions";

type Props = {
  anchor: string;
  today: string;
  days: string[];
  events: CalendarEvent[];
  availability: Record<string, EventAvailabilitySummary>;
  staff: boolean;
  canManage: boolean;
  initialSelectedId: string | null;
};

const navButton =
  "inline-flex size-11 items-center justify-center rounded-xl border border-line bg-white text-ink transition hover:bg-mist";

export function CalendarView({
  anchor,
  today,
  days,
  events,
  availability,
  staff,
  canManage,
  initialSelectedId,
}: Props) {
  const [selectedId, setSelectedId] = useState(
    events.some((e) => e.id === initialSelectedId) ? initialSelectedId : null,
  );
  const selected = events.find((e) => e.id === selectedId) ?? null;

  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);

  const chipProps = {
    availability,
    staff,
    selectedId,
    onSelect: setSelectedId,
  };

  return (
    <div className="lg:flex lg:items-start lg:gap-6">
      <div className="min-w-0 flex-1">
        <MonthGrid anchor={anchor} today={today} days={days} byDay={byDay} {...chipProps} />
        <WeekList anchor={anchor} today={today} byDay={byDay} {...chipProps} />
      </div>
      {selected && (
        <EventPanel
          key={selected.id}
          event={selected}
          summary={availability[selected.id]}
          staff={staff}
          canManage={canManage}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

type ChipProps = {
  availability: Record<string, EventAvailabilitySummary>;
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
  ...chipProps
}: { anchor: string; today: string; days: string[]; byDay: Map<string, CalendarEvent[]> } & ChipProps) {
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
        <h2 className="ml-2 flex-1 text-lg font-semibold text-ink">{monthLabel(anchor)}</h2>
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
              </li>
            );
          })}
        </ol>
      </div>
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
  ...chipProps
}: { anchor: string; today: string; byDay: Map<string, CalendarEvent[]> } & ChipProps) {
  const week = weekDays(anchor);
  const start = weekStart(anchor);
  const inThisWeek = week.includes(today);
  return (
    <section aria-label="Semana" className="lg:hidden">
      <div className="mb-4 flex items-center gap-2">
        <Link href={`/calendario?fecha=${addDays(start, -7)}`} className={navButton}>
          <ChevronLeft aria-hidden="true" className="size-5" />
          <span className="sr-only">Semana anterior</span>
        </Link>
        <Link href={`/calendario?fecha=${addDays(start, 7)}`} className={navButton}>
          <ChevronRight aria-hidden="true" className="size-5" />
          <span className="sr-only">Semana siguiente</span>
        </Link>
        <h2 className="ml-1 flex-1 text-base font-semibold text-ink">
          {shortDayLabel(week[0])} – {shortDayLabel(week[6])}
        </h2>
        {!inThisWeek && (
          <Link href="/calendario" className={`text-sm ${buttonSecondary}`}>
            Hoy
          </Link>
        )}
      </div>

      <ol className="space-y-4">
        {week.map((day) => {
          const dayEvents = byDay.get(day) ?? [];
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
              {dayEvents.length > 0 ? (
                <ul className="space-y-2">
                  {dayEvents.map((e) => (
                    <li key={e.id}>
                      <EventChip event={e} wide {...chipProps} />
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

// ---------------------------------------------------------------------------
// Chip de evento: entrenamiento neutro, competencia con acento de marca
// ---------------------------------------------------------------------------
const CHIP_STYLE = {
  entrenamiento: "border-line bg-white text-ink hover:bg-mist",
  competencia: "border-brand bg-brand-soft text-brand-text hover:border-brand-strong",
};

function EventChip({
  event,
  wide = false,
  availability,
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
          {wide ? `${event.start} – ${event.end}` : event.start}
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
    </button>
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
  onClose,
}: {
  event: CalendarEvent;
  summary: EventAvailabilitySummary | undefined;
  staff: boolean;
  canManage: boolean;
  onClose: () => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Al abrir el detalle (cada evento monta su propio panel), foco en el título.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cancel = () =>
    startTransition(async () => {
      const result = await cancelEvent(event.id);
      if (result.error) setError(result.error);
      setConfirming(false);
    });

  return (
    <div
      className="fixed inset-0 z-40 flex items-end bg-ink/30 lg:sticky lg:top-6 lg:z-auto lg:block lg:w-80 lg:shrink-0 lg:bg-transparent"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside
        aria-labelledby="event-panel-title"
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-white p-5 shadow-lg lg:max-h-[calc(100vh-3rem)] lg:rounded-xl lg:shadow-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  event.type === "competencia"
                    ? "bg-brand-soft text-brand-text"
                    : "border border-line text-ink"
                }`}
              >
                {EVENT_TYPE_LABEL[event.type]}
              </span>
              {event.cancelled && (
                <span className="inline-flex items-center rounded-full border border-muted px-2.5 py-0.5 text-xs font-medium text-muted">
                  Cancelado
                </span>
              )}
            </div>
            <h2
              id="event-panel-title"
              ref={titleRef}
              tabIndex={-1}
              className={`text-xl font-semibold text-ink outline-none ${
                event.cancelled ? "line-through" : ""
              }`}
            >
              {eventTitle(event)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mt-2 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-mist"
          >
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Cerrar detalle</span>
          </button>
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="sr-only">Fecha y hora</dt>
            <dd className="text-ink">
              {longDayLabel(event.day)}
              <br />
              {event.start} – {event.end}
            </dd>
          </div>
          {event.location && (
            <div className="flex items-start gap-2">
              <dt>
                <MapPin aria-hidden="true" className="mt-0.5 size-4 text-muted" />
                <span className="sr-only">Lugar</span>
              </dt>
              <dd className="text-ink">{event.location}</dd>
            </div>
          )}
          {event.opponent && (
            <div className="flex items-start gap-2">
              <dt>
                <Swords aria-hidden="true" className="mt-0.5 size-4 text-muted" />
                <span className="sr-only">Rival</span>
              </dt>
              <dd className="text-ink">{event.opponent}</dd>
            </div>
          )}
          {event.notes && (
            <div className="pt-1">
              <dt className="text-xs font-medium text-muted">Notas</dt>
              <dd className="mt-0.5 whitespace-pre-line text-ink">{event.notes}</dd>
            </div>
          )}
        </dl>

        {staff && !event.cancelled && (
          <SquadSummary eventId={event.id} summary={summary} past={event.past} />
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
                <Link href={`/calendario/${event.id}/editar`} className={`text-sm ${buttonSecondary}`}>
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
      </aside>
    </div>
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
      <ErrorMessage className="mt-6">No se pudo cargar la disponibilidad del plantel.</ErrorMessage>
    );
  }
  // Evento pasado sin registros de disponibilidad anteriores a su inicio.
  if (summary.total === 0) {
    return (
      <section className="mt-6 border-t border-line pt-4">
        <h3 className="text-sm font-medium text-ink">Plantel</h3>
        <p className="mt-1 text-sm text-muted">
          No hay registros de disponibilidad del plantel para esa fecha.
        </p>
      </section>
    );
  }
  return (
    <section className="mt-6 border-t border-line pt-4">
      <h3 className="text-sm font-medium text-ink">Plantel</h3>
      <p className="text-xs text-muted">
        {past ? "Disponibilidad registrada al momento del evento." : "Disponibilidad proyectada para esa fecha."}
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {(
          [
            ["ok", "Disponibles", summary.ok],
            ["duda", "En duda", summary.duda],
            ["no", "No disponibles", summary.no],
          ] as const
        ).map(([key, label, value]) => (
          <div key={key} className={`flex flex-col-reverse rounded-xl px-2 py-2 ${COUNT_STYLE[key]}`}>
            <dt className="text-xs">{label}</dt>
            <dd className="font-display text-xl font-bold">{value}</dd>
          </div>
        ))}
      </dl>

      <NameList title="No disponibles" names={summary.noNames} total={summary.no} />
      <NameList title="En duda" names={summary.dudaNames} total={summary.duda} />

      <Link href={`/calendario/${eventId}/disponibles`} className={`mt-4 w-full text-sm ${buttonPrimary}`}>
        Ver jugadores disponibles para esa fecha
      </Link>
    </section>
  );
}

function NameList({ title, names, total }: { title: string; names: string[]; total: number }) {
  if (total === 0) return null;
  return (
    <div className="mt-4">
      <h4 className="text-xs font-medium text-muted">{title}</h4>
      <ul className="mt-1 space-y-1 text-sm text-ink">
        {names.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
        {total > names.length && <li className="text-muted">y {total - names.length} más</li>}
      </ul>
    </div>
  );
}
