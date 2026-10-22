// Esqueleto del Resumen: título, tarjetas de métricas, próximo partido y listas.
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
      <div className="space-y-3">
        <Line className="mb-4 h-6 w-32" />
        <PersonRow />
        <PersonRow />
        <PersonRow />
      </div>
    </PageSkeleton>
  );
}
