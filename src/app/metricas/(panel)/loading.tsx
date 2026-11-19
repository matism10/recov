// Esqueleto de Métricas (solo el panel; "carga" tiene su propia carga): título, pestañas,
// la franja de estado y los bloques de gráficos.
import { Block, Line, PageSkeleton, TitleSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="las métricas" width="metrics">
      <TitleSkeleton />
      <Block className="mb-6 h-12 w-full sm:w-80" />
      <Block className="mb-4 space-y-4 p-5">
        <Line className="h-5 w-48" />
        <Line className="h-10 w-full" />
        <Line className="h-3 w-full rounded-full" />
      </Block>
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Block className="h-72 lg:col-span-2" />
        <Block className="h-72" />
      </div>
      <Block className="h-80" />
    </PageSkeleton>
  );
}
