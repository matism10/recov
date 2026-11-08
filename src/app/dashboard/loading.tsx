// Esqueleto del Resumen: título, tarjetas de métricas, próximo partido, Mi semana y listas.
import { Block, Line, PageSkeleton, PersonRow, TitleSkeleton } from "@/app/skeleton";

function StatCard() {
  return (
    <Block className="space-y-4 p-5">
      <Line className="h-4 w-36" />
      <Line className="h-10 w-14" />
      <Line className="h-2 w-full rounded-full" />
      <Line className="h-3 w-40" />
    </Block>
  );
}

export default function Loading() {
  return (
    <PageSkeleton label="el Resumen">
      <TitleSkeleton />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard />
        <StatCard />
        <Block className="hidden h-full min-h-48 lg:block" />
      </div>
      <Block className="mb-8 h-16" />
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
