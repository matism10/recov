// Esqueleto de la asistencia completa: selector de período y ranking.
import { BackSkeleton, Block, Line, PageSkeleton, TitleSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="la asistencia" width="medium">
      <BackSkeleton />
      <TitleSkeleton subtitle />
      <Line className="mb-5 h-12 w-56 rounded-xl" />
      <Block className="min-h-96" />
    </PageSkeleton>
  );
}
