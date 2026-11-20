// Esqueleto de la ficha del jugador: encabezado con foto, nombre y badges; pestañas; y la
// pestaña Resumen (franja de números y tres tarjetas, en tres columnas en escritorio).
import { Block, Circle, Line, PageSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="la ficha del jugador">
      <Line className="mb-5 h-4 w-16" />
      <div className="mb-5 flex items-start gap-3">
        <Circle className="size-16" />
        <div className="space-y-3">
          <Line className="h-7 w-52 max-w-[55vw]" />
          <Line className="h-4 w-40" />
          <Line className="h-6 w-28 rounded-full" />
        </div>
      </div>
      <Line className="mb-5 h-11 w-full" />
      <Block className="mb-4 h-28" />
      <div className="space-y-4 lg:grid lg:grid-cols-3 lg:gap-4 lg:space-y-0">
        <Block className="h-44" />
        <Block className="h-44" />
        <Block className="h-44" />
      </div>
    </PageSkeleton>
  );
}
