// Esqueleto de Planes de gimnasio: título con botón y la lista de planes.
import { Block, Line, PageSkeleton, TitleSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="los planes de gimnasio" width="medium">
      <TitleSkeleton subtitle action />
      <Line className="mb-2 h-3 w-28" />
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Block key={i} className="px-5 py-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <Line className="h-4 w-48 max-w-[60%]" />
                <Line className="h-3 w-40 max-w-[50%]" />
                <Line className="h-3 w-32 max-w-[40%]" />
              </div>
              <Line className="h-7 w-12" />
            </div>
          </Block>
        ))}
      </div>
    </PageSkeleton>
  );
}
