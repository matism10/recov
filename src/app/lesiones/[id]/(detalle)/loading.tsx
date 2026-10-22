// Esqueleto del detalle de una lesión: encabezado con jugador y lesión, avance hacia
// el alta y datos; a la derecha en escritorio, fases y documentos.
import { BackSkeleton, Block, Circle, Line, PageSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="la lesión" width="detail">
      <BackSkeleton />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-10">
        <div className="space-y-6">
          <Block className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <Circle />
              <Line className="h-4 w-40" />
            </div>
            <Line className="h-8 w-64 max-w-full" />
            <Line className="h-6 w-32 rounded-full" />
          </Block>
          <div className="space-y-3">
            <Line className="h-12 w-56" />
            <Line className="h-2 w-full rounded-full" />
          </div>
          <Block className="h-44" />
        </div>
        <div className="space-y-6">
          <div className="space-y-3">
            <Line className="h-6 w-48" />
            <Block className="h-40" />
          </div>
          <div className="space-y-3">
            <Line className="h-6 w-32" />
            <Block className="h-20" />
          </div>
        </div>
      </div>
    </PageSkeleton>
  );
}
