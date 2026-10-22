// Esqueletos de carga (loading.tsx): bloques con la forma de cada pantalla mientras
// llega la respuesta del servidor. Bloques en mist (#F7F8FA) con borde suave y
// líneas de texto en line (#E3E7EE) para que se distingan del fondo blanco. El pulso
// solo corre si el sistema no pide reducir el movimiento. Sin spinners.
import type { ReactNode } from "react";

const pulse = "motion-safe:animate-pulse";

// Bloque: tarjeta, fila o campo.
export function Block({ className = "", children }: { className?: string; children?: ReactNode }) {
  return (
    <div aria-hidden="true" className={`rounded-xl border border-line bg-mist ${pulse} ${className}`}>
      {children}
    </div>
  );
}

// Línea de texto (título, nombre, dato).
export function Line({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded-md bg-line ${pulse} ${className}`} />;
}

// Círculo (avatar).
export function Circle({ className = "size-10" }: { className?: string }) {
  return <div aria-hidden="true" className={`shrink-0 rounded-full bg-line ${pulse} ${className}`} />;
}

// Fila de persona: avatar, nombre y una línea secundaria; a la derecha, una etiqueta.
export function PersonRow({ tag = true, children }: { tag?: boolean; children?: ReactNode }) {
  return (
    <Block className="px-4 py-3">
      <div className="flex items-center gap-3">
        <Circle />
        <div className="min-w-0 flex-1 space-y-2">
          <Line className="h-4 w-40 max-w-[60%]" />
          <Line className="h-3 w-28 max-w-[45%]" />
        </div>
        {tag && <Line className="h-7 w-24 shrink-0 rounded-full" />}
      </div>
      {children}
    </Block>
  );
}

// Anchos de página, los mismos que usan las pantallas.
const WIDTHS = {
  wide: "max-w-3xl py-10 lg:max-w-6xl lg:px-8",
  medium: "max-w-3xl py-10",
  narrow: "max-w-lg py-10",
  metrics: "max-w-6xl py-10 lg:px-8",
  detail: "max-w-3xl py-8 lg:max-w-6xl lg:px-12 lg:py-12",
};

// Contenedor de la pantalla: el mismo ancho y márgenes que las páginas, y un aviso
// para lectores de pantalla.
export function PageSkeleton({
  label,
  width = "wide",
  children,
}: {
  label: string;
  width?: keyof typeof WIDTHS;
  children: ReactNode;
}) {
  return (
    <main aria-busy="true" className={`mx-auto w-full flex-1 px-4 ${WIDTHS[width]}`}>
      <p role="status" className="sr-only">
        Cargando {label}…
      </p>
      {children}
    </main>
  );
}

// Título de la pantalla (y subtítulo opcional).
export function TitleSkeleton({ subtitle = false, action = false }: { subtitle?: boolean; action?: boolean }) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div className="space-y-3">
        <Line className="h-8 w-56 max-w-[70vw]" />
        {subtitle && <Line className="h-4 w-36" />}
      </div>
      {action && <Line className="h-11 w-36 shrink-0 rounded-xl" />}
    </div>
  );
}

// Enlace "← Volver" sobre el título.
export function BackSkeleton() {
  return <Line className="mb-5 h-4 w-20" />;
}

// Campo de formulario: etiqueta y casilla.
export function FieldSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div className="space-y-2">
      <Line className="h-4 w-28" />
      <Block className={tall ? "h-24" : "h-11"} />
    </div>
  );
}

// Formulario simple: volver, título, campos y el botón principal.
export function FormSkeleton({
  label,
  fields,
  tallField = false,
}: {
  label: string;
  fields: number;
  tallField?: boolean;
}) {
  return (
    <PageSkeleton label={label} width="narrow">
      <BackSkeleton />
      <TitleSkeleton subtitle />
      <div className="space-y-5">
        {Array.from({ length: fields }, (_, i) => (
          <FieldSkeleton key={i} />
        ))}
        {tallField && <FieldSkeleton tall />}
        <Line className="h-11 w-full rounded-xl" />
      </div>
    </PageSkeleton>
  );
}
