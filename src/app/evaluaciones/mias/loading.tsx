// Esqueleto de Mis evaluaciones (jugador): volver, título, selector de test, último
// resultado, gráfico de progreso y ranking.
import { BackSkeleton, Block, Line, PageSkeleton, TitleSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="tus evaluaciones" width="medium">
      <BackSkeleton />
      <TitleSkeleton subtitle />
      <div className="space-y-6">
        <div className="space-y-2">
          <Line className="h-4 w-12" />
          <Block className="h-11" />
        </div>
        <Block className="h-28" />
        <Block className="h-56" />
        <Block className="h-72" />
      </div>
    </PageSkeleton>
  );
}
