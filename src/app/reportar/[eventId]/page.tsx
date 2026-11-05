import Link from "next/link";
import { redirect } from "next/navigation";
import { EVENT_TYPE_LABEL } from "@/lib/events";
import { PageTitle, cardClass, textButton } from "@/app/ui";
import { formatLoad, sessionWhen, type SessionReport } from "@/lib/srpe";
import { requireMember } from "@/app/calendario/member";
import { RpeForm } from "./rpe-form";

// "¿Qué tan duro fue?": el jugador responde el esfuerzo de un entrenamiento o partido
// (0–10) hasta 48 h después del término, o avisa que no fue. my_session_report trae
// el evento, sus minutos y la respuesta guardada (solo datos propios).
export default async function ReportPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { supabase } = await requireMember();
  const { data, error } = await supabase.rpc("my_session_report", { p_event_id: eventId });
  if (error || !data) redirect("/dashboard");
  const s = data as SessionReport;

  const match = s.type === "competencia";
  const title = match ? "¿Qué tan duro fue el partido?" : "¿Qué tan duro fue el entrenamiento?";
  const what = match && s.opponent ? `Partido vs. ${s.opponent}` : EVENT_TYPE_LABEL[s.type];

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <header className="mb-6">
        <Link href="/dashboard" className={textButton}>
          ← Volver al Resumen
        </Link>
        <p className="mt-2 text-sm text-muted">
          {what} · {sessionWhen(s.starts_at)} · {s.minutes} min{s.estimated ? " (estimado)" : ""}
        </p>
        <PageTitle className="mt-1">{title}</PageTitle>
      </header>

      {s.can_submit ? (
        <RpeForm
          eventId={s.event_id}
          match={match}
          minutes={s.minutes}
          estimated={s.estimated}
          initialRpe={s.answered && !s.absent ? s.rpe : null}
          answeredAbsent={s.answered && s.absent}
        />
      ) : (
        <div className={`space-y-2 p-5 text-sm ${cardClass}`}>
          {s.answered && (
            <p className="text-ink">
              {s.absent
                ? match
                  ? "Avisaste que no jugaste este partido."
                  : "Avisaste que no fuiste a este entrenamiento."
                : `Respondiste ${s.rpe} de 10 (carga ${formatLoad((s.rpe ?? 0) * s.minutes)}).`}
            </p>
          )}
          <p className="text-muted">{s.reason ? `${s.reason}.` : "Ya no se puede responder esta sesión."}</p>
        </div>
      )}
    </main>
  );
}
