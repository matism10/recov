// Esqueleto de Métricas (solo el panel; "carga" tiene su propia carga): tarjetas de
// cifras, gráficos y la carga del plantel.
import { Block, Line, PageSkeleton, TitleSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="las métricas" width="metrics">
      <TitleSkeleton subtitle />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Block key={i} className="space-y-4 p-5">
            <Line className="h-4 w-32" />
            <Line className="h-10 w-14" />
            <Line className="h-2 w-full rounded-full" />
          </Block>
        ))}
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Block className="h-72" />
        <Block className="h-72" />
      </div>
      <Block className="h-80" />
    </PageSkeleton>
  );
}
