import Link from "next/link";
import { CalendarOff, ChevronRight } from "lucide-react";
import { EndAbsenceButton } from "@/app/ausencias/end-button";
import { ABSENCE_REASON_LABEL, type MyAbsence } from "@/lib/absences";
import { compactDayLabel } from "@/lib/events";

// Jugador: "Avisar una ausencia" y, con un período en curso (propio o parón del plantel),
// el estado "Ausente: motivo, hasta X" con "Ya volví". Sin pendientes de sRPE ni
// bienestar mientras dura (lo resuelve la base).
export function MyAbsenceBlock({ absences }: { absences: MyAbsence[] }) {
  const active = absences.filter((a) => a.scope === "periodo" && a.in_progress);
  // El propio primero; si no, el parón del plantel.
  const current = active.find((a) => !a.is_squad) ?? active[0];

  return (
    <div className="space-y-3">
      {current && (
        <section aria-label="Tu ausencia" className="rounded-xl border border-line bg-brand-soft p-4">
          <div className="flex items-start gap-3">
            <CalendarOff aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-strong" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">
                {current.is_squad
                  ? `Parón del plantel: ${ABSENCE_REASON_LABEL[current.reason].toLowerCase()}`
                  : `Ausente: ${ABSENCE_REASON_LABEL[current.reason].toLowerCase()}`}
                {current.ends_on ? `, hasta ${compactDayLabel(current.ends_on).toLowerCase()}` : ", sin fecha de vuelta"}
              </p>
              <p className="text-sm text-muted">No tienes reportes pendientes mientras dure.</p>
            </div>
          </div>
          {!current.is_squad && <EndAbsenceButton id={current.id} returned className="mt-3" />}
        </section>
      )}
      <Link
        href="/ausencias/nueva"
        className="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 transition hover:bg-mist"
      >
        <CalendarOff aria-hidden="true" className="size-5 shrink-0 text-brand-strong" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-ink">Avisar una ausencia</span>
          <span className="block text-13 text-muted">Si no vas a un evento o estarás varios días fuera.</span>
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted" />
      </Link>
    </div>
  );
}
