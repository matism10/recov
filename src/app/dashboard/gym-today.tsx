// "Hoy toca gimnasio" (Resumen del jugador): tarjeta celeste grande si hoy tiene una
// sesión del plan sin hacer, con el botón "Ver mi plan de hoy". Debajo, siempre, la fila
// "¿Entrenaste por tu cuenta?" para registrar una sesión propia.
import Link from "next/link";
import { BicepsFlexed, ChevronRight, Dumbbell } from "lucide-react";
import type { GymToday } from "@/lib/gym";

export function GymTodayCard({ data }: { data: GymToday | null }) {
  const pending = data?.sessions.find((s) => s.today && !s.log_id) ?? null;
  return (
    <div className="space-y-3">
      {pending && (
        <Link
          href="/mi-plan"
          className="flex min-h-14 items-center gap-3 rounded-xl bg-brand p-4 text-brand-night transition hover:bg-brand-press"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/70">
            <BicepsFlexed aria-hidden="true" className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg leading-6 font-extrabold">Hoy toca gimnasio</span>
            <span className="block text-sm font-medium">
              {pending.label} · {pending.exercises.length} {pending.exercises.length === 1 ? "ejercicio" : "ejercicios"} · ~
              {pending.est_minutes} min
            </span>
          </span>
          <span className="shrink-0 rounded-lg bg-brand-night px-3 py-2 text-sm font-semibold text-white">Ver mi plan</span>
        </Link>
      )}
      <Link
        href="/mi-plan/propia"
        className="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-card px-4 py-2 transition hover:bg-mist"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft">
          <Dumbbell aria-hidden="true" className="size-5 text-brand-text" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">¿Entrenaste por tu cuenta?</span>
          <span className="block text-13 text-muted">Registra tu esfuerzo</span>
        </span>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
      </Link>
    </div>
  );
}
