// Esqueleto de los disponibles de un evento: título, resumen, cambio lista/cancha y
// la lista de jugadores.
import { BackSkeleton, Line, PageSkeleton, PersonRow, TitleSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="los disponibles del evento">
      <BackSkeleton />
      <TitleSkeleton subtitle />
      <div className="mb-5 flex flex-wrap gap-2">
        <Line className="h-8 w-24 rounded-full" />
        <Line className="h-8 w-24 rounded-full" />
        <Line className="h-8 w-24 rounded-full" />
      </div>
      <Line className="mb-4 h-11 w-36 rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <PersonRow key={i} />
        ))}
      </div>
    </PageSkeleton>
  );
}
