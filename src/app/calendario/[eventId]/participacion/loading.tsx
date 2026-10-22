// Esqueleto de la participación de un partido: lista de convocados con su control.
import { BackSkeleton, Line, PageSkeleton, PersonRow, TitleSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="la participación" width="medium">
      <BackSkeleton />
      <TitleSkeleton subtitle />
      <div className="mb-6 space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <PersonRow key={i} />
        ))}
      </div>
      <Line className="h-11 w-full rounded-xl" />
    </PageSkeleton>
  );
}
