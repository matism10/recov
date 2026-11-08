// "Mi bienestar" del jugador en el Resumen. Lo que antes era el bloque "Pendientes"
// (sRPE y check de bienestar por responder) ahora va en las notificaciones de estado.
import { SectionTitle } from "@/app/ui";
import { dayLabel } from "@/lib/srpe";

// "Mi bienestar" (junto a "Mi carga"): último total sobre 25.
export function MyWellness({ last }: { last: { report_date: string; total: number } | null }) {
  return (
    <section>
      <SectionTitle className="mb-3">Mi bienestar</SectionTitle>
      <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-mist p-5">
        {last ? (
          <>
            <span className="text-sm text-muted">Último: {dayLabel(last.report_date)}</span>
            <span className="font-display text-2xl font-extrabold text-ink tabular-nums">
              {last.total}
              <span className="text-sm font-semibold text-muted"> / 25</span>
            </span>
          </>
        ) : (
          <span className="text-sm text-muted">Aún no respondes el check de bienestar.</span>
        )}
      </div>
    </section>
  );
}
