// Esqueleto de "¿Qué tan duro fue?": volver, título, la escala de 0 a 10 y los botones.
import { BackSkeleton, Line, PageSkeleton, TitleSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="la sesión" width="narrow">
      <BackSkeleton />
      <TitleSkeleton subtitle />
      <div className="mb-6 space-y-1">
        {Array.from({ length: 11 }, (_, i) => (
          <div key={i} className="flex min-h-11 items-center gap-3.5 px-3">
            <Line className="size-8 rounded-lg" />
            <Line className="h-4 w-28" />
          </div>
        ))}
      </div>
      <Line className="mb-3 h-5 w-full" />
      <Line className="h-12 w-full rounded-xl" />
    </PageSkeleton>
  );
}
