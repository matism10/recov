// Esqueleto del Resumen: título, tarjetas de métricas, próximo partido, Mi semana y listas.
import { Block, Line, PageSkeleton, PersonRow, TitleSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="el Resumen">
      <TitleSkeleton />
      <Block className="mb-5 h-[188px] lg:mb-6 lg:h-[104px]" />
      <Block className="mb-5 h-16 lg:mb-6" />
      {/* Mi semana: fila de 7 días */}
      <Line className="mb-3 h-6 w-28" />
      <Block className="mb-8 p-3">
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }, (_, i) => (
            <Line key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </Block>
      <div className="space-y-3">
        <Line className="mb-4 h-6 w-32" />
        <PersonRow />
        <PersonRow />
        <PersonRow />
      </div>
    </PageSkeleton>
  );
}
