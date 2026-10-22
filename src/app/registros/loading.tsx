// Esqueleto de Registros: jugadores y staff pendientes.
import { Line, PageSkeleton, PersonRow, TitleSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="los registros">
      <TitleSkeleton subtitle />
      <Line className="mb-3 h-6 w-28" />
      <div className="mb-8 space-y-2">
        <PersonRow />
        <PersonRow />
      </div>
      <Line className="mb-3 h-6 w-20" />
      <div className="space-y-2">
        <PersonRow />
      </div>
    </PageSkeleton>
  );
}
