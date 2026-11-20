import { AVAILABILITY_LABEL, type Availability } from "@/lib/roles";
import { Card } from "@/app/ui-blocks";
import { AVAILABILITY_STYLE, AvailabilityIcon } from "@/app/ui";

// Frase corta bajo el estado. Solo datos propios del jugador.
const HINT: Record<Availability, string> = {
  disponible: "Estás disponible para entrenar y jugar.",
  en_revision: "Tu lesión está en revisión.",
  lesionado: "Estás en recuperación.",
  reintegro: "Estás volviendo a la cancha.",
};

// Resumen del jugador: su estado en grande y, si tiene una lesión abierta, la fase en curso.
export function MyStatusCard({ status, phase }: { status: Availability; phase?: string }) {
  return (
    <Card as="section" aria-label="Tu estado" className="flex items-center gap-4">
      <span className={`flex size-14 shrink-0 items-center justify-center rounded-xl ${AVAILABILITY_STYLE[status]}`}>
        <AvailabilityIcon status={status} className="size-8" />
      </span>
      <div className="min-w-0">
        <p className="text-13 text-muted">Tu estado</p>
        <p className="font-display text-[30px] leading-[34px] font-bold text-ink">{AVAILABILITY_LABEL[status]}</p>
        <p className="mt-0.5 text-sm text-muted">
          {phase ? (
            <>
              Fase en curso: <span className="font-semibold text-ink">{phase}</span>
            </>
          ) : (
            HINT[status]
          )}
        </p>
      </div>
    </Card>
  );
}
