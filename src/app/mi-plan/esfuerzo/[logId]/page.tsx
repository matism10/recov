import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/app/calendario/member";
import { getMyGymLogSummary } from "@/lib/gym";
import { dayLabel } from "@/lib/srpe";
import { todayInChile } from "@/lib/injuries";
import { PageTitle, cardClass, textButton } from "@/app/ui";
import { GymRpeForm } from "./gym-rpe-form";

// "¿Qué tan dura fue la sesión?" de gimnasio: la misma pantalla de /reportar (EffortScreen). Se responde
// el día de la sesión y hasta 2 días después; se puede corregir en ese plazo.
export default async function GymEffortPage({ params }: { params: Promise<{ logId: string }> }) {
  const { logId } = await params;
  const { supabase } = await requireMember();
  const s = await getMyGymLogSummary(supabase, logId);
  if (!s) redirect("/dashboard");
  const when = s.performed_on === todayInChile() ? "Hoy" : dayLabel(s.performed_on);

  const meta = `Gimnasio · ${s.own ? "por tu cuenta" : s.label} · ${when} · ${s.minutes} min`;

  if (s.can_rate) {
    return <GymRpeForm logId={s.log_id} meta={meta} minutes={s.minutes} initialRpe={s.rpe} />;
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <header className="mb-6">
        <Link href="/dashboard" className={textButton}>
          ← Volver al Resumen
        </Link>
        <p className="mt-2 text-sm text-muted">{meta}</p>
        <PageTitle className="mt-1">¿Qué tan dura fue la sesión?</PageTitle>
      </header>
      <p className={`p-5 text-sm text-muted ${cardClass}`}>
        {s.rpe !== null ? `Respondiste ${s.rpe} de 10. ` : ""}Ya pasó el plazo para responder.
      </p>
    </main>
  );
}
