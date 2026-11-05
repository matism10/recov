// Esqueleto de "Mi plan de hoy": volver, título, barra de progreso, tarjetas de
// ejercicios y los dos botones.
import { Block, Line, PageSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="tu plan de hoy" width="narrow">
      <Line className="mb-4 h-4 w-28" />
      <Line className="mb-2 h-3 w-48" />
      <Line className="mb-2 h-8 w-56" />
      <Line className="mb-5 h-3 w-40" />
      <Line className="mb-4 h-1.5 w-full" />
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Block key={i} className="flex items-center gap-3 px-3.5 py-3">
            <Line className="size-7 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Line className="h-4 w-40 max-w-[70%]" />
              <Line className="h-3 w-32 max-w-[60%]" />
            </div>
            <Line className="h-6 w-16" />
          </Block>
        ))}
      </div>
      <Line className="mt-5 h-13 w-full rounded-2xl" />
      <Line className="mt-2 h-12 w-full rounded-2xl" />
    </PageSkeleton>
  );
}
