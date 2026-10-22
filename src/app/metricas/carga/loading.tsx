// Esqueleto del ranking de carga: filas con barras y total.
import { BackSkeleton, Block, Line, PageSkeleton, TitleSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="el ranking de carga" width="medium">
      <BackSkeleton />
      <TitleSkeleton subtitle />
      <Block className="divide-y divide-line px-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <Line className="h-4 w-5" />
            <Line className="h-4 flex-1" />
            <Line className="h-6 w-28" />
            <Line className="h-4 w-14" />
          </div>
        ))}
      </Block>
    </PageSkeleton>
  );
}
