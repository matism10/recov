import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, ChevronRight } from "lucide-react";
import { requireMember } from "@/app/calendario/member";
import { compactDayLabel } from "@/lib/events";
import { getMyGymToday } from "@/lib/gym";
import { PageTitle, cardClass, linkClass, textButton } from "@/app/ui";
import { MyPlanToday } from "./my-plan-today";

// "Mi plan de hoy" (jugador): la sesión de hoy (o una pendiente de los 2 días anteriores)
// con los kilos calculados desde sus máximos. Sin sesión, muestra la próxima.
export default async function MyPlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const { supabase, roles } = await requireMember();
  if (!roles.includes("jugador")) redirect("/dashboard");
  const data = await getMyGymToday(supabase);
  if (!data) redirect("/dashboard");

  // La sesión elegida, o la primera sin hacer (hoy antes que días anteriores), o la de hoy.
  const key = (s: { plan_session_id: string; date: string }) => `${s.plan_session_id}_${s.date}`;
  const sessions = [...data.sessions].sort((a, b) => b.date.localeCompare(a.date));
  const chosen =
    sessions.find((s) => key(s) === query.sesion) ??
    sessions.find((s) => !s.log_id && s.today) ??
    sessions.find((s) => !s.log_id) ??
    sessions[0] ??
    null;

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
      <Link href="/dashboard" className={textButton}>
        ← Volver al Resumen
      </Link>

      {chosen ? (
        <>
          {sessions.length > 1 && (
            <nav aria-label="Sesiones" className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {sessions.map((s) => {
                const on = key(s) === key(chosen);
                return (
                  <Link
                    key={key(s)}
                    href={`/mi-plan?sesion=${key(s)}`}
                    aria-current={on ? "page" : undefined}
                    className={`flex min-h-10 shrink-0 items-center rounded-xl px-3 text-sm font-medium whitespace-nowrap ${
                      on ? "bg-ink text-white" : "bg-mist text-ink"
                    }`}
                  >
                    {s.today ? "Hoy" : compactDayLabel(s.date)} · {s.label}
                    {s.log_id ? " · hecha" : !s.today ? " · pendiente" : ""}
                  </Link>
                );
              })}
            </nav>
          )}
          <MyPlanToday key={key(chosen)} session={chosen} />
        </>
      ) : (
        <div className="mt-3 space-y-5">
          <PageTitle>Mi plan de hoy</PageTitle>
          {data.next ? (
            <div className={`space-y-1 p-5 ${cardClass}`}>
              <p className="flex items-center gap-2 text-sm text-muted">
                <CalendarClock aria-hidden="true" className="size-4" />
                Hoy no te toca gimnasio. Tu próxima sesión:
              </p>
              <p className="font-display text-xl font-bold text-ink">
                {compactDayLabel(data.next.date)} · {data.next.label}
              </p>
              <p className="text-sm text-muted">
                {data.next.exercise_count} {data.next.exercise_count === 1 ? "ejercicio" : "ejercicios"} · ~
                {data.next.est_minutes} min · {data.next.plan_name}
              </p>
            </div>
          ) : (
            <p className={`p-5 text-sm text-muted ${cardClass}`}>
              No tienes un plan de gimnasio asignado por ahora. Cuando el preparador físico o el head coach publique
              uno, aparece aquí.
            </p>
          )}
        </div>
      )}

      <Link
        href="/mi-plan/propia"
        className="mt-6 flex min-h-14 items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 transition hover:bg-mist"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-ink">¿Fuiste al gimnasio por tu cuenta?</span>
          <span className={`block text-sm ${linkClass} no-underline`}>Regístralo para que sume a tu carga</span>
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted" />
      </Link>
    </main>
  );
}
