// Piezas visuales del sistema de marca, compartidas por servidor y cliente.
// Solo estética: no contienen lógica de la app.
import type { ReactNode } from "react";
import {
  Bandage,
  Check,
  CircleAlert,
  CircleCheck,
  CircleSlash,
  Search,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { AVAILABILITY_LABEL, type Availability } from "@/lib/roles";
import { INJURY_STATUS_LABEL, type InjuryStatus, type PhaseStatus } from "@/lib/injuries";

// ---------------------------------------------------------------------------
// Clases base (Dirección A): controles de 44 px y radio de 6 px; bloques de 8 px,
// sin borde ni sombra (se separan por tono y aire); bordes solo en campos.
// ---------------------------------------------------------------------------
export const fieldClass =
  "min-h-11 w-full rounded-md border border-line bg-white px-3 py-2 text-ink outline-none focus:border-brand-strong focus:ring-2 focus:ring-brand-soft";
export const inputClass = `mt-1 ${fieldClass}`;
export const labelClass = "block text-sm font-medium text-ink";
export const optionalClass = "font-normal text-muted";

// Botón primario: Sky 400 con texto Ink (blanco sobre Sky 400 no pasa contraste).
export const buttonPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 font-semibold text-ink transition hover:bg-brand-hover active:bg-brand-strong disabled:opacity-60";
export const buttonSecondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-surface-2 px-4 py-2 font-semibold text-ink transition hover:bg-line disabled:opacity-60";
export const buttonDanger =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-danger px-4 py-2 font-semibold text-white transition hover:bg-danger-hover disabled:opacity-60";
// Acciones secundarias con forma de texto (Cerrar sesión, Cancelar, Cambiar…).
export const textButton =
  "inline-flex min-h-11 items-center text-sm text-muted underline disabled:opacity-60";
export const linkClass = "font-medium text-brand-text underline";

export const cardClass = "rounded-xl bg-mist";
// Chips de conteo y etiquetas de marca (no son estados).
export const chipClass =
  "inline-flex items-center rounded-sm bg-brand px-1.5 py-0.5 text-xs font-semibold text-ink";

// ---------------------------------------------------------------------------
// Títulos: PageTitle (uno por página) y SectionTitle (secciones de la página)
// ---------------------------------------------------------------------------
// Archivo 700, 30/34 px. El club ya se ve en la sidebar (escritorio) y en el
// encabezado móvil.
export function PageTitle({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <h1 className="font-display text-[30px] leading-[34px] font-bold text-ink">
        {children}
      </h1>
    </div>
  );
}

// Archivo 700, 18 px, en tinta.
export function SectionTitle({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h2 className={`font-sans text-lg font-bold text-ink ${className}`}>{children}</h2>;
}

// ---------------------------------------------------------------------------
// Disponibilidad: ícono + texto + color, nunca solo color
// ---------------------------------------------------------------------------
export const AVAILABILITY_ICON: Record<Availability, LucideIcon> = {
  disponible: CircleCheck,
  en_revision: Search,
  lesionado: Bandage,
  reintegro: Undo2,
};

// Relleno sólido: blanco sobre verde, rojo y teal; tinta sobre ámbar (todos ≥ 5:1).
export const AVAILABILITY_STYLE: Record<Availability, string> = {
  disponible: "bg-disponible text-white",
  en_revision: "bg-revision text-ink",
  lesionado: "bg-lesionado text-white",
  reintegro: "bg-reintegro text-white",
};

// Franja de 4 px a la izquierda de cada fila de jugador, con el color de su estado.
export const AVAILABILITY_STRIPE: Record<Availability, string> = {
  disponible: "bg-disponible",
  en_revision: "bg-revision",
  lesionado: "bg-lesionado",
  reintegro: "bg-reintegro",
};

// Color de estado como texto sobre blanco (cifras): el ámbar usa su tono oscuro.
export const AVAILABILITY_TEXT: Record<Availability, string> = {
  disponible: "text-disponible",
  en_revision: "text-revision-strong",
  lesionado: "text-lesionado",
  reintegro: "text-reintegro",
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

// ---------------------------------------------------------------------------
// Badge de estado: una sola forma (píldora rellena, text-xs, peso 500, sin
// quiebre de línea) para disponibilidad y lesiones; cambia solo el color.
// ---------------------------------------------------------------------------
function StatusBadge({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-1 text-[13px] leading-4 font-semibold whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  );
}

export function AvailabilityBadge({ status }: { status: Availability }) {
  return (
    <StatusBadge className={AVAILABILITY_STYLE[status]}>
      <AvailabilityIcon status={status} className="size-3.5" />
      {AVAILABILITY_LABEL[status]}
    </StatusBadge>
  );
}

// ---------------------------------------------------------------------------
// Estado de la lesión
// ---------------------------------------------------------------------------
const INJURY_STATUS_STYLE: Record<InjuryStatus, string> = {
  en_evaluacion: "bg-revision text-ink",
  activa: "bg-lesionado text-white",
  cerrada: "bg-disponible text-white",
  descartada: "bg-surface-2 text-ink",
};

const INJURY_STATUS_ICON: Record<InjuryStatus, LucideIcon> = {
  en_evaluacion: Search,
  activa: Bandage,
  cerrada: CircleCheck,
  descartada: CircleSlash,
};

export function InjuryStatusBadge({ status }: { status: InjuryStatus }) {
  const Icon = INJURY_STATUS_ICON[status];
  return (
    <StatusBadge className={INJURY_STATUS_STYLE[status]}>
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {INJURY_STATUS_LABEL[status]}
    </StatusBadge>
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
