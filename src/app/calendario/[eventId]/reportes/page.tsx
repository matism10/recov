import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDown } from "lucide-react";
import {
  EVENT_COLUMNS,
  EVENT_TYPE_LABEL,
  eventTimeLabel,
  longDayLabel,
  toCalendarEvent,
  type EventRow,
} from "@/lib/events";
import { isStaff } from "@/lib/roles";
import { Avatar } from "@/app/avatar";
import { PageTitle, SectionTitle, cardClass, textButton } from "@/app/ui";
import { getSupabase } from "@/lib/session";
import {
  formatAvg,
  formatLoad,
  wellnessReason,
  type EventRpeSummary,
  type WellnessFlag,
} from "@/lib/srpe";
import { requireMember } from "../../member";

// Reportes de un evento (staff, desde que empieza): cuántos respondieron el esfuerzo,
// promedios, quién falta, quién dijo que no fue y, de esos jugadores, quién tiene el
// bienestar bajo lo habitual. Sin "Recordar" en esta versión.
export default async function EventReportsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await getSupabase();
  const eventPromise = supabase.from("events").select(EVENT_COLUMNS).eq("id", eventId).maybeSingle();
  const summaryPromise = supabase.rpc("event_rpe_summary", { p_event_id: eventId });
  const { roles } = await requireMember();
  if (!isStaff(roles)) redirect("/calendario");

  const { data } = await eventPromise;
  if (!data) redirect("/calendario");
  const row = data as EventRow;
  const event = toCalendarEvent(row);
  const back = `/calendario?fecha=${event.day}&evento=${event.id}`;
  if (event.cancelled) redirect(back);

  const header = (
    <header className="mb-6">
      <Link href={back} className={textButton}>
        ← Volver al calendario
      </Link>
      <p className="mt-2 text-sm text-muted">
        {EVENT_TYPE_LABEL[event.type]}
        {event.type === "competencia" && event.opponent ? ` vs. ${event.opponent}` : ""} ·{" "}
        {longDayLabel(event.day)} · {eventTimeLabel(event)}
      </p>
      <PageTitle className="mt-1">Reportes</PageTitle>
    </header>
  );

  if (!event.past) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        {header}
        <p className={`p-5 text-sm text-muted ${cardClass}`}>
          {event.type === "competencia" ? "El partido" : "El entrenamiento"} todavía no empieza. Los
          reportes se ven desde que comience.
        </p>
      </main>
    );
  }

  const [{ data: summaryData, error }, { data: flagsData }] = await Promise.all([
    summaryPromise,
    supabase.rpc("wellness_flags", { p_format: row.format === "7" ? "7" : "15" }),
  ]);
  if (error || !summaryData) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        {header}
        <p className={`p-5 text-sm text-muted ${cardClass}`}>No se pudieron cargar los reportes.</p>
      </main>
    );
  }
  const s = summaryData as EventRpeSummary;
  // Bienestar bajo lo habitual: solo los jugadores esperados en este evento.
  const roster = new Set([
    ...s.responses.map((r) => r.player_id),
    ...s.missing.map((r) => r.player_id),
    ...s.absent.map((r) => r.player_id),
  ]);
  const lowWellness = ((flagsData ?? []) as WellnessFlag[]).filter((f) => f.low && roster.has(f.player_id));
  const percent = s.expected > 0 ? Math.round((s.responded / s.expected) * 100) : 0;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      {header}

      <div className="space-y-8">
        <section className="space-y-3 rounded-2xl bg-mist p-4 sm:p-5" aria-label="Respuestas">
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-semibold text-ink">Respondieron</span>
            <span className="font-display text-2xl font-extrabold text-ink tabular-nums">
              {s.responded} <span className="text-sm font-semibold text-muted">de {s.expected}</span>
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={s.expected}
            aria-valuenow={s.responded}
            aria-label="Respondieron"
            className="h-2 overflow-hidden rounded-full bg-line"
          >
            <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
          </div>
          <dl className="grid grid-cols-2 gap-2 pt-1">
            <div className="flex flex-col-reverse gap-0.5">
              <dt className="text-xs text-muted">Esfuerzo promedio</dt>
              <dd className="font-display text-lg font-bold text-ink tabular-nums">
                {s.avg_rpe !== null ? `${formatAvg(s.avg_rpe)} / 10` : "—"}
              </dd>
            </div>
            <div className="flex flex-col-reverse gap-0.5">
              <dt className="text-xs text-muted">Carga promedio{s.estimated ? " (estimada)" : ""}</dt>
              <dd className="font-display text-lg font-bold text-ink tabular-nums">
                {s.avg_load !== null ? formatLoad(s.avg_load) : "—"}
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <SectionTitle className="mb-2">Sin responder ({s.missing.length})</SectionTitle>
          {s.missing.length === 0 ? (
            <p className="text-sm text-muted">Todos respondieron.</p>
          ) : (
            <PeopleList people={s.missing} />
          )}
        </section>

        {s.absent.length > 0 && (
          <section>
            <SectionTitle className="mb-2">Dijo que no fue ({s.absent.length})</SectionTitle>
            <PeopleList people={s.absent} />
          </section>
        )}

        <section>
          <SectionTitle className="mb-2">Bienestar bajo lo habitual</SectionTitle>
          {lowWellness.length === 0 ? (
            <p className="text-sm text-muted">Nadie de este {event.type === "competencia" ? "partido" : "entrenamiento"} tiene el bienestar bajo lo habitual en los últimos 7 días.</p>
          ) : (
            <ul className="space-y-2">
              {lowWellness.map((f) => (
                <li key={f.player_id}>
                  <Link
                    href={`/jugadores/${f.player_id}`}
                    className="flex min-h-14 items-center gap-3 rounded-xl bg-alerta-soft px-3 py-2.5 transition hover:bg-alerta-bg"
                  >
                    <ArrowDown aria-hidden="true" className="size-4.5 shrink-0 text-alerta-fg" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">{f.full_name}</span>
                      <span className="block text-xs text-alerta-fg">{wellnessReason(f)}</span>
                    </span>
                    <span className="font-display font-bold text-ink tabular-nums">{f.total} / 25</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function PeopleList({ people }: { people: { player_id: string; full_name: string }[] }) {
  return (
    <ul className="divide-y divide-line">
      {people.map((p) => (
        <li key={p.player_id}>
          <Link href={`/jugadores/${p.player_id}`} className="flex min-h-12 items-center gap-3 py-2 hover:bg-mist">
            <Avatar name={p.full_name} size="sm" />
            <span className="text-ink">{p.full_name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
