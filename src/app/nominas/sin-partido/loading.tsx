// Esqueleto de "sin partido": aviso y botón.
import { Block, Line, PageSkeleton, TitleSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="las nóminas" width="narrow">
      <TitleSkeleton />
      <Block className="space-y-3 p-5">
        <Line className="h-4 w-full" />
        <Line className="h-4 w-3/4" />
        <Line className="h-11 w-40 rounded-xl" />
      </Block>
    </PageSkeleton>
  );
}
