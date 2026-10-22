// Esqueleto de Nóminas (solo la lista; "sin partido" tiene su propia carga): título,
// botón "Armar nómina" y tarjetas de partidos.
import { Block, Line, PageSkeleton, TitleSkeleton } from "@/app/skeleton";

function MatchCard() {
  return (
    <Block className="space-y-3 p-5">
      <Line className="h-5 w-56 max-w-full" />
      <Line className="h-4 w-44" />
      <Line className="h-4 w-64 max-w-full" />
      <Line className="h-11 w-36 rounded-xl" />
    </Block>
  );
}

export default function Loading() {
  return (
    <PageSkeleton label="las nóminas" width="medium">
      <TitleSkeleton subtitle />
      <Line className="mb-8 h-14 w-full rounded-xl" />
      <Line className="mb-3 h-6 w-36" />
      <div className="space-y-3">
        <MatchCard />
        <MatchCard />
      </div>
    </PageSkeleton>
  );
}
