// Esqueleto de Evaluaciones (staff): título, pestañas, selector de test y la lista
// del plantel.
import { Block, Line, PageSkeleton, PersonRow, TitleSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="las evaluaciones" width="medium">
      <TitleSkeleton subtitle />
      <Block className="mb-6 h-13" />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1 space-y-2">
          <Line className="h-4 w-12" />
          <Block className="h-11" />
        </div>
        <div className="space-y-2 sm:w-48">
          <Line className="h-4 w-12" />
          <Block className="h-11" />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <PersonRow key={i} />
        ))}
      </div>
    </PageSkeleton>
  );
}
