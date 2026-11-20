import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { buttonPrimary } from "@/app/ui";
import { Card, CardHeader, ListRow, PageHeader, TableCard } from "@/app/ui-blocks";
import { requireMember } from "@/app/calendario/member";
import {
  ABSENCE_REASON_LABEL,
  getMyAbsences,
  periodText,
  type MyAbsence,
} from "@/lib/absences";
import { EVENT_TYPE_LABEL, chileDateTime, compactDayLabel, eventTimeLabel, toCalendarEvent } from "@/lib/events";
import { EndAbsenceButton } from "./end-button";

function describe(a: MyAbsence) {
  if (a.scope === "periodo" && a.starts_on) {
    return {
      title: a.is_squad ? "Parón del plantel" : "Varios días",
      when: periodText(a.starts_on, a.ends_on),
    };
  }
  const kind = a.event_type ? EVENT_TYPE_LABEL[a.event_type] : "Evento";
  const title = a.event_type === "competencia" && a.opponent ? `${kind} vs. ${a.opponent}` : kind;
  if (!a.event_starts_at || !a.event_ends_at || !a.event_type) return { title, when: "" };
  const e = toCalendarEvent({
    id: a.event_id!,
    type: a.event_type,
    starts_at: a.event_starts_at,
    ends_at: a.event_ends_at,
    location: null,
    opponent: a.opponent,
    notes: null,
    series_id: null,
    cancelled_at: null,
    format: "15",
  });
  return { title, when: `${compactDayLabel(chileDateTime(a.event_starts_at).date)} · ${eventTimeLabel(e)}` };
}

// "Mis ausencias": mis avisos vigentes (un evento o varios días) y los del plantel.
export default async function MyAbsencesPage() {
  const { supabase, roles } = await requireMember();
  if (!roles.includes("jugador")) redirect("/dashboard");
  const all = await getMyAbsences(supabase);
  const mine = all.filter((a) => !a.is_squad);
  const squad = all.filter((a) => a.is_squad);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 lg:max-w-[1080px] lg:px-8 lg:py-10">
      <PageHeader
        title="Mis ausencias"
        back={{ fallback: "/dashboard", label: "← Volver al Resumen" }}
        actions={
          <Link href="/ausencias/nueva" className={`shrink-0 text-sm ${buttonPrimary}`}>
            <Plus aria-hidden="true" className="size-4" />
            Avisar
          </Link>
        }
      />
      <div className="space-y-6">
      <section>
        {mine.length === 0 ? (
          <Card>
            <CardHeader title="Activas y próximas" />
            <p className="text-sm text-muted">No tienes avisos de ausencia.</p>
          </Card>
        ) : (
          <TableCard header={<CardHeader title="Activas y próximas" count={mine.length} className="mb-0" />}>
            {mine.map((a) => {
              const d = describe(a);
              return (
                <ListRow key={a.id} className="block py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{d.title}</p>
                      <p className="text-sm text-muted">{d.when}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-text">
                      {ABSENCE_REASON_LABEL[a.reason]}
                    </span>
                  </div>
                  {a.note && <p className="mt-2 text-sm text-ink">{a.note}</p>}
                  {a.by_staff && <p className="mt-2 text-13 text-muted">Lo registró tu staff.</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {a.scope === "periodo" && a.in_progress && <EndAbsenceButton id={a.id} returned />}
                    <EndAbsenceButton id={a.id} label="Quitar aviso" />
                  </div>
                </ListRow>
              );
            })}
          </TableCard>
        )}
      </section>

      {squad.length > 0 && (
        <section>
          <TableCard header={<CardHeader title="Del plantel" className="mb-0" />}>
            {squad.map((a) => {
              const d = describe(a);
              return (
                <ListRow key={a.id} className="block py-3">
                  <p className="font-medium text-ink">{d.title}</p>
                  <p className="text-sm text-muted">
                    {ABSENCE_REASON_LABEL[a.reason]} · {d.when}
                  </p>
                </ListRow>
              );
            })}
          </TableCard>
        </section>
      )}
      </div>
    </main>
  );
}
