// Esqueleto del check de bienestar: volver, título y las 5 preguntas con sus chips.
import { BackSkeleton, Line, PageSkeleton, TitleSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="el check de bienestar" width="narrow">
      <BackSkeleton />
      <TitleSkeleton subtitle />
      <div className="mb-6 space-y-6">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Line className="h-4 w-32" />
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 5 }, (_, j) => (
                <Line key={j} className="h-11 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <Line className="h-12 w-full rounded-xl" />
    </PageSkeleton>
  );
}
