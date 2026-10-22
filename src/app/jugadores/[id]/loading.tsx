// Esqueleto de la ficha del jugador: foto y nombre; lesión actual y línea de tiempo
// (en dos columnas en escritorio); y la carga de partidos.
import { Block, Circle, Line, PageSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="la ficha del jugador">
      <Line className="mb-5 h-4 w-16" />
      <div className="mb-8 flex items-center gap-4">
        <Circle className="size-16" />
        <div className="space-y-3">
          <Line className="h-8 w-52 max-w-[55vw]" />
          <Line className="h-4 w-40" />
        </div>
      </div>
      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-8 lg:space-y-0">
        <div className="space-y-3">
          <Line className="h-6 w-32" />
          <Block className="space-y-4 p-5">
            <Line className="h-4 w-44" />
            <Line className="h-3 w-56 max-w-full" />
            <Line className="h-2 w-full rounded-full" />
          </Block>
        </div>
        <div className="space-y-3">
          <Line className="h-6 w-36" />
          <div className="space-y-4 border-l-2 border-line pl-5">
            <Line className="h-4 w-48" />
            <Line className="h-4 w-40" />
          </div>
        </div>
      </div>
      <Line className="mt-8 mb-3 h-6 w-20" />
      <Block className="h-64" />
    </PageSkeleton>
  );
}
