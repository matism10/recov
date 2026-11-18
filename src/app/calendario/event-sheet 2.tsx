"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { MapPin, Swords, X } from "lucide-react";
import {
  EVENT_TYPE_LABEL,
  eventTimeLabel,
  eventTitle,
  longDayLabel,
  type CalendarEvent,
} from "@/lib/events";

export type EventSheetData = Pick<
  CalendarEvent,
  | "id"
  | "type"
  | "day"
  | "start"
  | "end"
  | "location"
  | "opponent"
  | "notes"
  | "cancelled"
>;

// Detalle de un evento: hoja inferior en celular. Con `inline` (calendario), en escritorio
// queda como panel bajo la grilla; sin él (Mi semana), en escritorio es un cuadro centrado.
// `badges` va junto al tipo; `children`, bajo el título (EventDetails y acciones según rol).
export function EventSheet({
  event,
  inline = false,
  badges,
  children,
  onClose,
}: {
  event: EventSheetData;
  inline?: boolean;
  badges?: ReactNode;
  children?: ReactNode;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Al abrir (cada evento monta su propia hoja): en el panel de escritorio se desplaza
  // hasta él; el foco va al título.
  useEffect(() => {
    if (inline)
      panelRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    titleRef.current?.focus({ preventScroll: true });
  }, [inline]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 z-40 flex items-end bg-ink/30 ${
        inline
          ? "lg:static lg:z-auto lg:mt-6 lg:block lg:bg-transparent"
          : "lg:items-center lg:justify-center lg:p-6"
      }`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside
        ref={panelRef}
        role={inline ? undefined : "dialog"}
        aria-modal={inline ? undefined : true}
        aria-labelledby="event-panel-title"
        className={`max-h-[85vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-white p-5 shadow-lg ${
          inline
            ? "scroll-mt-6 lg:max-h-none lg:overflow-visible lg:rounded-xl lg:p-6 lg:shadow-none"
            : "lg:max-w-lg lg:rounded-2xl lg:p-6"
        }`}
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
              {badges}
            </div>
            <h2
              id="event-panel-title"
              ref={titleRef}
              tabIndex={-1}
              className={`text-xl font-semibold text-ink outline-none ${event.cancelled ? "line-through" : ""}`}
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

        {children}
      </aside>
    </div>
  );
}

// Fecha, horario, lugar, rival y notas. Va dentro de la hoja (`children`), donde cada
// pantalla lo ubica (el calendario, en su grilla de escritorio).
export function EventDetails({ event }: { event: EventSheetData }) {
  return (
    <dl className="mt-4 space-y-2 text-sm lg:mt-0">
      <div>
        <dt className="sr-only">Fecha y hora</dt>
        <dd className="text-ink">
          {longDayLabel(event.day)}
          <br />
          {eventTimeLabel(event)}
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
  );
}
