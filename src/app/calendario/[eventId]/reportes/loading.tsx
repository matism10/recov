// Esqueleto de "Reportes": tarjeta de respuestas, listas de jugadores y bienestar.
import { BackSkeleton, Block, Line, PageSkeleton, PersonRow, TitleSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="los reportes" width="medium">
      <BackSkeleton />
      <TitleSkeleton subtitle />
      <Block className="mb-8 h-36" />
      <Line className="mb-3 h-5 w-40" />
      <div className="mb-8 space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <PersonRow key={i} tag={false} />
        ))}
      </div>
      <Line className="mb-3 h-5 w-52" />
      <div className="space-y-2">
        {Array.from({ length: 2 }, (_, i) => (
          <Block key={i} className="h-14" />
        ))}
      </div>
    </PageSkeleton>
  );
}
