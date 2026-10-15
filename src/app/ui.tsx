// Piezas visuales del sistema de marca, compartidas por servidor y cliente.
// Solo estética: no contienen lógica de la app.
import type { ReactNode } from "react";
import {
  Bandage,
  Check,
  CircleAlert,
  CircleCheck,
  Search,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { AVAILABILITY_LABEL, type Availability } from "@/lib/roles";
import { INJURY_STATUS_LABEL, type InjuryStatus, type PhaseStatus } from "@/lib/injuries";

// ---------------------------------------------------------------------------
// Clases base (botones de 44 px de alto, radio de 12 px en todo menos píldoras)
// ---------------------------------------------------------------------------
export const fieldClass =
  "min-h-11 w-full rounded-xl border border-line bg-white px-3 py-2 text-ink outline-none focus:border-brand-strong focus:ring-2 focus:ring-brand-soft";
export const inputClass = `mt-1 ${fieldClass}`;
export const labelClass = "block text-sm font-medium text-ink";
export const optionalClass = "font-normal text-muted";

// Botón primario: Sky 400 con texto Ink (blanco sobre Sky 400 no pasa contraste).
export const buttonPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 font-medium text-ink transition hover:bg-brand-hover active:bg-brand-strong disabled:opacity-60";
export const buttonSecondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-2 font-medium text-ink transition hover:bg-mist disabled:opacity-60";
export const buttonDanger =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-danger px-4 py-2 font-medium text-white transition hover:bg-danger-hover disabled:opacity-60";
// Acciones secundarias con forma de texto (Cerrar sesión, Cancelar, Cambiar…).
export const textButton =
  "inline-flex min-h-11 items-center text-sm text-muted underline disabled:opacity-60";
export const linkClass = "font-medium text-brand-text underline";

export const cardClass = "rounded-xl border border-line bg-mist";
// Chips de conteo y etiquetas de marca (no son estados).
export const chipClass =
  "inline-flex items-center rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-text";

// ---------------------------------------------------------------------------
// Disponibilidad: ícono + texto + color, nunca solo color
// ---------------------------------------------------------------------------
export const AVAILABILITY_ICON: Record<Availability, LucideIcon> = {
  disponible: CircleCheck,
  en_revision: Search,
  lesionado: Bandage,
  reintegro: Undo2,
};

export const AVAILABILITY_STYLE: Record<Availability, string> = {
  disponible: "bg-disponible-bg text-disponible-fg",
  en_revision: "bg-revision-bg text-revision-fg",
  lesionado: "bg-lesionado-bg text-lesionado-fg",
  reintegro: "bg-reintegro-bg text-reintegro-fg",
};

export function AvailabilityIcon({
  status,
  className = "size-4",
}: {
  status: Availability;
  className?: string;
}) {
  const Icon = AVAILABILITY_ICON[status];
  return <Icon aria-hidden="true" className={`shrink-0 ${className}`} />;
}

export function AvailabilityBadge({ status }: { status: Availability }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${AVAILABILITY_STYLE[status]}`}
    >
      <AvailabilityIcon status={status} className="size-3.5" />
      {AVAILABILITY_LABEL[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Estado de la lesión. En outline cuando convive con badges de disponibilidad.
// ---------------------------------------------------------------------------
const INJURY_STATUS_FILLED: Record<InjuryStatus, string> = {
  en_evaluacion: "bg-revision-bg text-revision-fg",
  activa: "bg-lesionado-bg text-lesionado-fg",
  cerrada: "bg-disponible-bg text-disponible-fg",
  descartada: "bg-mist text-muted",
};

const INJURY_STATUS_OUTLINE: Record<InjuryStatus, string> = {
  en_evaluacion: "border border-revision text-revision-fg",
  activa: "border border-lesionado text-lesionado-fg",
  cerrada: "border border-disponible text-disponible-fg",
  descartada: "border border-muted text-muted",
};

export function InjuryStatusBadge({
  status,
  outline = false,
}: {
  status: InjuryStatus;
  outline?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        outline ? INJURY_STATUS_OUTLINE[status] : INJURY_STATUS_FILLED[status]
      }`}
    >
      {INJURY_STATUS_LABEL[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Puntos de la línea de tiempo: se distinguen por forma, no solo por color.
// Van sobre una línea vertical (border-l-2) con pl-5 en la lista.
// ---------------------------------------------------------------------------
export function PhaseDot({ status }: { status: PhaseStatus }) {
  const base =
    "absolute top-0.5 -left-[31px] flex size-5 items-center justify-center rounded-full";
  if (status === "completada") {
    return (
      <span aria-hidden="true" className={`${base} bg-brand-strong text-white`}>
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  }
  if (status === "en_curso") {
    return <span aria-hidden="true" className={`${base} border-2 border-ink bg-brand`} />;
  }
  return <span aria-hidden="true" className={`${base} border-2 border-muted bg-white`} />;
}

// ---------------------------------------------------------------------------
// Mensajes: errores con ícono de alerta + texto (nunca con forma de badge)
// ---------------------------------------------------------------------------
export function ErrorMessage({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p role="alert" className={`flex items-start gap-1.5 text-sm text-danger ${className}`}>
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function SuccessMessage({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="flex items-start gap-1.5 text-sm text-disponible-fg">
      <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
