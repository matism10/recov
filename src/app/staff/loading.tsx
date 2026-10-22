// Esqueleto de Staff: delegaciones y la lista del staff.
import { Block, Line, PageSkeleton, PersonRow, TitleSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="el staff">
      <TitleSkeleton subtitle />
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <Block className="h-32" />
        <Block className="h-32" />
      </div>
      <Line className="mb-3 h-6 w-32" />
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <PersonRow key={i} />
        ))}
      </div>
    </PageSkeleton>
  );
}
