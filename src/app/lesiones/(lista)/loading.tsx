// Esqueleto de Lesiones (solo la lista; el detalle y "marcar" tienen su propia carga):
// título, "Actuales" con barra de avance e "Historial".
import { Line, PageSkeleton, PersonRow, TitleSkeleton } from "@/app/skeleton";

function InjuryRow() {
  return (
    <PersonRow>
      <div className="mt-4 space-y-2">
        <Line className="h-3 w-20" />
        <Line className="h-2 w-full rounded-full" />
      </div>
    </PersonRow>
  );
}

export default function Loading() {
  return (
    <PageSkeleton label="las lesiones">
      <TitleSkeleton subtitle />
      <Line className="mb-4 h-6 w-32" />
      <div className="mb-10 space-y-2">
        <InjuryRow />
        <InjuryRow />
        <InjuryRow />
      </div>
      <Line className="mb-4 h-6 w-28" />
      <div className="space-y-2">
        <PersonRow />
        <PersonRow />
      </div>
    </PageSkeleton>
  );
}
