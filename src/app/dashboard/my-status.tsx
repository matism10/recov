import { AVAILABILITY_LABEL, type Availability } from "@/lib/roles";
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
    <section
      aria-label="Tu estado"
      className={`flex items-center gap-4 rounded-2xl p-5 sm:p-6 ${AVAILABILITY_STYLE[status]}`}
    >
      <AvailabilityIcon status={status} className="size-10 sm:size-12" />
      <div className="min-w-0">
        <p className="text-sm font-medium opacity-80">Tu estado</p>
        <p className="font-display text-[30px] leading-[34px] font-bold">{AVAILABILITY_LABEL[status]}</p>
        <p className="mt-1 text-sm">
          {phase ? (
            <>
              Fase en curso: <span className="font-semibold">{phase}</span>
            </>
          ) : (
            HINT[status]
          )}
        </p>
      </div>
    </section>
  );
}
