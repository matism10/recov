// Componentes de pantalla del sistema de diseño: tarjeta, lista de personas, tabla,
// franja de números, encabezado de página y estado vacío. Solo estética: no tienen
// lógica de la app ni piden datos. Se usan desde servidor y cliente.
//
// Reglas: escala tipográfica 12, 13, 14, 15, 16, 18, 24, 30 (48 solo para un número
// protagonista; ver globals.css), mínimo 12 px; todo lo tocable mide al menos 44 px.
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/app/avatar";
import { BackLink } from "@/app/back-link";
import { PageTitle, cardClass, chipClass } from "@/app/ui";

// ---------------------------------------------------------------------------
// Card y CardHeader
// ---------------------------------------------------------------------------
// Tarjeta única: fondo card, borde line. Padding 16 px en celular y 20 px desde lg.
// `flush` quita el padding (listas y tablas que llegan hasta el borde).
export function Card({
  children,
  className = "",
  flush = false,
  as: Tag = "div",
  id,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  flush?: boolean;
  as?: "div" | "section" | "article" | "header";
  id?: string;
  "aria-label"?: string;
}) {
  return <Tag id={id} aria-label={ariaLabel} className={`${cardClass} ${flush ? "overflow-hidden" : "p-4 lg:p-5"} ${className}`}>{children}</Tag>;
}

// Título 16/700, contador opcional (chip), acción opcional a la derecha (link de 44 px
// de alto) y subtítulo de 13 px.
export function CardHeader({
  title,
  count,
  action,
  subtitle,
  className = "",
}: {
  title: ReactNode;
  count?: number | string;
  action?: { label: string; href: string };
  subtitle?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-3 flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="font-sans text-base font-bold text-ink">{title}</h2>
          {count !== undefined && <span className={chipClass}>{count}</span>}
        </div>
        {subtitle && <p className="mt-0.5 text-13 text-muted">{subtitle}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="-my-2 inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-brand-text underline"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlayerCard: tarjeta compacta por jugador, para listas de personas
// ---------------------------------------------------------------------------
// Todo el bloque es un link. Avatar de 36 px, nombre 15/600, una sola línea secundaria
// de 13 px, barra de progreso opcional de 4 px y el badge de estado a la derecha.
// Mínimo 72 px de alto. Ponlas dentro de PlayerCardList (gap de 8 px).
export function PlayerCardList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <ul className={`flex flex-col gap-2 ${className}`}>{children}</ul>;
}

export function PlayerCard({
  href,
  name,
  photoUrl,
  secondary,
  progress,
  progressLabel,
  badge,
  showAvatar = true,
}: {
  href: string;
  name: string;
  photoUrl?: string | null;
  secondary?: ReactNode;
  // 0 a 100. Sin valor, no se dibuja la barra.
  progress?: number;
  progressLabel?: string;
  badge?: ReactNode;
  // false: sin avatar (listas del propio jugador, donde la foto sería la suya siempre).
  showAvatar?: boolean;
}) {
  const pct = progress === undefined ? undefined : Math.max(0, Math.min(100, progress));
  return (
    <li>
      <Link
        href={href}
        className={`flex min-h-18 items-center gap-3 px-3 py-3 transition hover:bg-mist focus-visible:outline-2 focus-visible:outline-brand-strong ${cardClass}`}
      >
        {showAvatar && <Avatar name={name} url={photoUrl} size="sm" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-15 font-semibold text-ink">{name}</span>
          {secondary && <span className="block truncate text-13 text-muted">{secondary}</span>}
          {pct !== undefined && (
            <span
              role="progressbar"
              aria-label={progressLabel ?? "Progreso"}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(pct)}
              className="mt-1.5 block h-1 overflow-hidden rounded-full bg-line"
            >
              <span className="block h-full rounded-full bg-brand-strong" style={{ width: `${pct}%` }} />
            </span>
          )}
        </span>
        {badge && <span className="shrink-0">{badge}</span>}
      </Link>
    </li>
  );
}

// ---------------------------------------------------------------------------
// TableCard y ListRow: datos y listas largas
// ---------------------------------------------------------------------------
// Una tarjeta con filas divididas por border-line, cada fila de al menos 56 px. En
// escritorio admite columnas: pasa `columns` (clase literal de Tailwind, por ejemplo
// "lg:grid-cols-[2fr_1fr_1fr]") igual en TableCard y en cada ListRow, y `head` con las
// etiquetas de las columnas (solo se ve desde lg).
export function TableCard({
  children,
  head,
  header,
  footer,
  columns = "",
  className = "",
}: {
  children: ReactNode;
  head?: ReactNode;
  // Encabezado de la tarjeta (CardHeader y avisos) y pie (botones, desplegables), con padding.
  header?: ReactNode;
  footer?: ReactNode;
  columns?: string;
  className?: string;
}) {
  return (
    <div className={`${cardClass} overflow-hidden ${className}`}>
      {header && <div className="border-b border-line p-4 pb-3 lg:p-5 lg:pb-3">{header}</div>}
      {head && (
        <div
          className={`hidden gap-3 border-b border-line bg-mist px-5 py-2 text-13 font-medium text-muted lg:grid ${columns}`}
        >
          {head}
        </div>
      )}
      <ul className="divide-y divide-line">{children}</ul>
      {footer && <div className="border-t border-line p-4 lg:px-5">{footer}</div>}
    </div>
  );
}

export function ListRow({
  children,
  href,
  columns = "",
  className = "",
}: {
  children: ReactNode;
  href?: string;
  columns?: string;
  className?: string;
}) {
  const row = `relative flex min-h-14 items-center gap-3 px-4 py-3 lg:px-5 ${columns ? `lg:grid ${columns}` : ""} ${className}`;
  return (
    <li>
      {href ? (
        <Link href={href} className={`${row} transition hover:bg-mist focus-visible:outline-2 focus-visible:outline-brand-strong`}>
          {children}
        </Link>
      ) : (
        <div className={row}>{children}</div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// StatStrip: franja de números en una tarjeta (2×2 en celular, 4 columnas desde lg)
// ---------------------------------------------------------------------------
// Clases literales: Tailwind solo genera las que aparecen escritas en el código.
const STAT_TONE = {
  default: "text-ink",
  disponible: "text-disponible",
  lesionado: "text-lesionado",
  reintegro: "text-reintegro",
  alerta: "text-alerta-fg",
  brand: "text-brand-text",
} as const;
export type StatTone = keyof typeof STAT_TONE;

export function StatStrip({
  items,
  className = "",
}: {
  items: { label: string; value: ReactNode; context?: ReactNode; tone?: StatTone }[];
  className?: string;
}) {
  // Desde lg, una columna por número (hasta 4) para que no quede una celda vacía.
  const lgCols = ["lg:grid-cols-1", "lg:grid-cols-1", "lg:grid-cols-2", "lg:grid-cols-3", "lg:grid-cols-4"][Math.min(items.length, 4)];
  return (
    <dl className={`${cardClass} grid grid-cols-2 gap-px overflow-hidden bg-line ${lgCols} ${className}`}>
      {items.map((it) => (
        <div
          key={it.label}
          className="bg-card p-4 lg:p-5 [&:last-child:nth-child(odd)]:col-span-2 lg:[&:last-child:nth-child(odd)]:col-span-1"
        >
          <dt className="text-13 text-muted">{it.label}</dt>
          <dd className={`mt-1 text-3xl leading-9 font-bold ${STAT_TONE[it.tone ?? "default"]}`}>{it.value}</dd>
          {it.context && <p className="mt-0.5 text-13 text-muted">{it.context}</p>}
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------------------
// PageHeader: volver opcional, título, descripción opcional y acciones a la derecha
// ---------------------------------------------------------------------------
export function PageHeader({
  title,
  description,
  back,
  actions,
  className = "mb-6",
}: {
  title: ReactNode;
  description?: ReactNode;
  back?: { fallback: string; label?: string };
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={className}>
      {back && <BackLink fallback={back.fallback}>{back.label ?? "← Volver"}</BackLink>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <PageTitle>{title}</PageTitle>
          {description && <p className="mt-1 text-15 text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// EmptyState: título 15/600 y texto de 13 px, centrados dentro de una Card
// ---------------------------------------------------------------------------
export function EmptyState({
  title,
  children,
  action,
  className = "",
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`text-center ${className}`}>
      <div className="mx-auto max-w-md py-4">
        <p className="text-15 font-semibold text-ink">{title}</p>
        {children && <p className="mt-1 text-13 text-muted">{children}</p>}
        {action && <div className="mt-4 flex justify-center">{action}</div>}
      </div>
    </Card>
  );
}
