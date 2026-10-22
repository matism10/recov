// Esqueleto del Plantel: título, cambio lista/cancha, buscador y filtros, y filas.
import { Block, Line, PageSkeleton, PersonRow, TitleSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="el plantel">
      <TitleSkeleton subtitle />
      <Line className="mb-4 h-11 w-36 rounded-xl" />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row">
        <Block className="h-11 w-full lg:flex-1" />
        <Block className="h-11 lg:w-56" />
        <Block className="h-11 lg:w-48" />
      </div>
      <div className="mb-5 flex gap-2 overflow-hidden">
        {["w-24", "w-28", "w-28", "w-28", "w-24"].map((w, i) => (
          <Line key={i} className={`h-11 shrink-0 rounded-full ${w}`} />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 7 }, (_, i) => (
          <PersonRow key={i} />
        ))}
      </div>
    </PageSkeleton>
  );
}
