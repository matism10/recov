// Esqueleto de "Check de bienestar": volver, título, los 7 días y el botón.
import { BackSkeleton, Block, Line, PageSkeleton, TitleSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="los días de bienestar" width="narrow">
      <BackSkeleton />
      <TitleSkeleton subtitle />
      <div className="mb-6 space-y-2">
        {Array.from({ length: 7 }, (_, i) => (
          <Block key={i} className="h-12" />
        ))}
      </div>
      <Line className="h-11 w-full rounded-xl" />
    </PageSkeleton>
  );
}
