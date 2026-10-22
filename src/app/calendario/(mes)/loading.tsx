// Esqueleto del Calendario (solo la vista del mes o la semana; los eventos tienen su
// propia carga). Celular: días de la semana uno bajo otro. Escritorio: grilla del mes.
import { Block, Line, PageSkeleton, TitleSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="el calendario">
      <TitleSkeleton action />
      <Block className="mb-4 h-12 lg:hidden" />
      <div className="mb-6 flex items-center gap-2">
        <Block className="size-11" />
        <Block className="size-11" />
        <Line className="ml-2 h-5 w-44" />
      </div>
      {/* Celular: semana */}
      <div className="space-y-5 lg:hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Line className="h-4 w-52" />
            <Block className="h-12" />
          </div>
        ))}
      </div>
      {/* Escritorio: mes */}
      <Block className="hidden overflow-hidden lg:block">
        <div className="grid grid-cols-7 border-b border-line">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="px-2 py-2">
              <Line className="h-3 w-8" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }, (_, i) => (
            <div key={i} className="h-28 border-r border-b border-line bg-white p-2 [&:nth-child(7n)]:border-r-0">
              <Line className="h-3 w-5" />
            </div>
          ))}
        </div>
      </Block>
    </PageSkeleton>
  );
}
