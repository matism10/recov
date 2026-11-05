import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { requireMember } from "@/app/calendario/member";
import { getMyGymLogSummary } from "@/lib/gym";
import { formatLoad } from "@/lib/srpe";

// Pantalla completa al terminar una sesión de gimnasio: felicitaciones y tres datos
// (ejercicios hechos, sesiones de la semana y semanas seguidas cumpliendo el plan).
// Celeste #38BDF8 con texto #082F49. Tapa la navegación (fija sobre toda la pantalla).
export default async function GymDonePage({ params }: { params: Promise<{ logId: string }> }) {
  const { logId } = await params;
  const { supabase } = await requireMember();
  const s = await getMyGymLogSummary(supabase, logId);
  if (!s) redirect("/mi-plan");

  const stats = [
    s.own
      ? { value: `${s.minutes} min`, label: "por tu cuenta" }
      : { value: `${s.done_exercises}/${s.total_exercises ?? s.done_exercises}`, label: "ejercicios" },
    { value: s.week_assigned > 0 ? `${s.week_done} de ${s.week_assigned}` : "—", label: "sesiones semana" },
    { value: String(s.streak), label: s.streak === 1 ? "semana seguida" : "semanas seguidas" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#38BDF8] px-6 pt-[env(safe-area-inset-top)] pb-[calc(1.75rem+env(safe-area-inset-bottom))] text-[#082F49]">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
          <div className="flex size-28 items-center justify-center rounded-full bg-white">
            <Check role="img" aria-label="Sesión completada" className="size-14 text-[#0284C7]" strokeWidth={2.6} />
          </div>
          <h1 className="font-display text-[38px] leading-tight font-extrabold tracking-tight">
            ¡Felicidades, {s.first_name}!
          </h1>
          <p className="max-w-xs text-lg font-medium">
            {s.own ? "Registraste tu sesión de gimnasio" : "Completaste la sesión de gimnasio"}
          </p>
          <dl className="mt-3 grid w-full grid-cols-3 gap-2">
            {stats.map((x) => (
              <div key={x.label} className="flex flex-col-reverse gap-0.5 rounded-2xl bg-[#E0F2FE] px-1.5 py-3.5">
                <dt className="text-xs">{x.label}</dt>
                <dd className="font-display text-[22px] font-extrabold tabular-nums">{x.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="space-y-2.5">
          {s.rpe === null && s.can_rate ? (
            <>
              <p className="text-center text-sm">Último paso: cuéntanos cómo te fue para sumar tu carga</p>
              <Link
                href={`/mi-plan/esfuerzo/${s.log_id}`}
                className="flex h-14 items-center justify-center rounded-2xl bg-[#082F49] text-base font-semibold text-white"
              >
                ¿Qué tan dura fue la sesión?
              </Link>
            </>
          ) : s.rpe !== null ? (
            <p className="text-center text-sm">
              Esfuerzo {s.rpe} de 10 · carga {formatLoad(s.rpe * s.minutes)}
              {s.can_rate && (
                <>
                  {" · "}
                  <Link href={`/mi-plan/esfuerzo/${s.log_id}`} className="font-semibold underline">
                    Cambiar
                  </Link>
                </>
              )}
            </p>
          ) : null}
          <Link href="/dashboard" className="flex h-12 items-center justify-center text-[15px] font-semibold text-[#082F49]">
            Volver al inicio
          </Link>
        </div>
      </main>
    </div>
  );
}
