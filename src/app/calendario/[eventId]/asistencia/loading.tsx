// Esqueleto de "Pasar lista": contadores, lista del plantel y botón de guardar.
import { BackSkeleton, Line, PageSkeleton, PersonRow, TitleSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="la lista" width="medium">
      <BackSkeleton />
      <TitleSkeleton subtitle />
      <div className="mb-5 grid grid-cols-2 gap-3">
        <Line className="h-20 rounded-xl" />
        <Line className="h-20 rounded-xl" />
      </div>
      <div className="mb-6 space-y-2">
        {Array.from({ length: 8 }, (_, i) => (
          <PersonRow key={i} />
        ))}
      </div>
      <Line className="h-11 w-full rounded-xl" />
    </PageSkeleton>
  );
}
