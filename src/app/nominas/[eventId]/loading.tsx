// Esqueleto de la nómina en lectura: título y la lista de convocados.
import { Block, Line, PageSkeleton, TitleSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="la nómina" width="medium">
      <TitleSkeleton subtitle />
      <Line className="mb-3 h-6 w-32" />
      <Block className="space-y-4 p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Line key={i} className="h-9 w-full" />
        ))}
      </Block>
    </PageSkeleton>
  );
}
