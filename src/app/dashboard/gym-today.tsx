// "Hoy toca gimnasio" (Resumen del jugador): tarjeta celeste grande si hoy tiene una
// sesión del plan sin hacer, con el botón "Ver mi plan de hoy". Debajo, siempre, el link
// para registrar una sesión por su cuenta.
import Link from "next/link";
import { BicepsFlexed } from "lucide-react";
import type { GymToday } from "@/lib/gym";

export function GymTodayCard({ data }: { data: GymToday | null }) {
  const pending = data?.sessions.find((s) => s.today && !s.log_id) ?? null;
  return (
    <div className="mb-8 space-y-3">
      {pending && (
        <Link
          href="/mi-plan"
          className="block space-y-3 rounded-3xl bg-[#38BDF8] p-5 text-[#082F49] transition hover:bg-[#2BB2EE] lg:max-w-xl"
        >
          <span className="flex items-start justify-between gap-4">
            <span>
              <span className="block text-sm font-semibold">Plan de gimnasio</span>
              <span className="block font-display text-[28px] leading-tight font-extrabold">Hoy toca gimnasio</span>
            </span>
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/70">
              <BicepsFlexed aria-hidden="true" className="size-6" />
            </span>
          </span>
          <span className="block text-[15px] font-medium">
            {pending.label} · {pending.exercises.length} {pending.exercises.length === 1 ? "ejercicio" : "ejercicios"} · ~
            {pending.est_minutes} min
          </span>
          <span className="flex h-12 items-center justify-center rounded-2xl bg-[#082F49] font-semibold text-white">
            Ver mi plan de hoy
          </span>
        </Link>
      )}
      <Link href="/mi-plan/propia" className="inline-flex min-h-11 items-center text-sm font-medium text-brand-text underline">
        ¿Fuiste al gimnasio por tu cuenta? Regístralo
      </Link>
    </div>
  );
}
