import { redirect } from "next/navigation";
import { Card, CardHeader, ListRow, PageHeader, TableCard } from "@/app/ui-blocks";
import { requireMember } from "../member";
import { can } from "@/lib/permissions";
import {
  ABSENCE_REASON_LABEL,
  getClubAbsences,
  getUpcomingEventOptions,
  periodText,
  type ClubAbsence,
} from "@/lib/absences";
import { EVENT_TYPE_LABEL, compactDayLabel, chileDateTime } from "@/lib/events";
import { todayInChile } from "@/lib/injuries";
import { EndAbsenceButton } from "@/app/ausencias/end-button";
import { DeclareAbsenceDialog } from "./declare-dialog";

function describe(a: ClubAbsence) {
  if (a.scope === "periodo" && a.starts_on) return periodText(a.starts_on, a.ends_on);
  const kind = a.event_type ? EVENT_TYPE_LABEL[a.event_type] : "Evento";
  const title = a.event_type === "competencia" && a.opponent ? `${kind} vs. ${a.opponent}` : kind;
  const day = a.event_starts_at ? compactDayLabel(chileDateTime(a.event_starts_at).date) : "";
  return `${title}${day ? ` · ${day}` : ""}${a.event_format === "7" ? " · Sevens" : ""}`;
}

function Row({ a, canDeclare, canSquad }: { a: ClubAbsence; canDeclare: boolean; canSquad: boolean }) {
  const squad = a.player_id === null;
  const removable = a.state === "vigente" && (squad ? canSquad : canDeclare);
  return (
    <ListRow className="block py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">{squad ? "Todo el plantel" : (a.player_name ?? "Jugador")}</p>
          <p className="text-sm text-muted">{describe(a)}</p>
        </div>
        <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-text">
          {ABSENCE_REASON_LABEL[a.reason]}
        </span>
      </div>
      {a.note && <p className="mt-2 text-sm text-ink">{a.note}</p>}
      <p className="mt-2 text-13 text-muted">
        {a.created_by_name ? `Registró ${a.created_by_name}` : "Registrado"}
        {a.state === "quitado" ? " · Aviso quitado" : a.state === "pasado" ? " · Ya pasó" : ""}
      </p>
      {removable && (
        <div className="mt-3 flex flex-wrap gap-2">
          {a.in_progress && <EndAbsenceButton id={a.id} returned label="Ya volvió" />}
          <EndAbsenceButton id={a.id} label="Quitar aviso" />
        </div>
      )}
    </ListRow>
  );
}

function Group({
  title,
  rows,
  empty,
  ...rest
}: {
  title: string;
  rows: ClubAbsence[];
  empty: string;
  canDeclare: boolean;
  canSquad: boolean;
}) {
  return (
    <section>
      {rows.length === 0 ? (
        <Card>
          <CardHeader title={title} />
          <p className="text-sm text-muted">{empty}</p>
        </Card>
      ) : (
        <TableCard header={<CardHeader title={title} count={rows.length} className="mb-0" />}>
          {rows.map((a) => (
            <Row key={a.id} a={a} {...rest} />
          ))}
        </TableCard>
      )}
    </section>
  );
}

// Ausencias del plantel (staff con lista_pasar): ahora y próximas, parón del plantel e
// historial. Declarar y quitar según ausencias_declarar; el parón, con paron_declarar.
export default async function AbsencesPage() {
  const { supabase, roles, clubId } = await requireMember();
  if (!can(roles, "lista_pasar")) redirect("/calendario");
  const canDeclare = can(roles, "ausencias_declarar");
  const canSquad = can(roles, "paron_declarar");

  const [current, history, events, playersRes] = await Promise.all([
    getClubAbsences(supabase, "vigente"),
    getClubAbsences(supabase, "historial"),
    canDeclare ? getUpcomingEventOptions(supabase, clubId, null) : Promise.resolve([]),
    canDeclare
      ? supabase
          .from("players")
          .select("id, full_name")
          .eq("club_id", clubId)
          .eq("active", true)
          .eq("status", "confirmado")
          .order("full_name")
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const rows = current.ok ? current.data : [];
  const now = rows.filter((a) => a.player_id !== null && a.scope === "periodo" && a.in_progress);
  const upcoming = rows.filter((a) => a.player_id !== null && !(a.scope === "periodo" && a.in_progress));
  const squad = rows.filter((a) => a.player_id === null);
  const groupProps = { canDeclare, canSquad };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 lg:max-w-[1080px] lg:px-8 lg:py-10">
      <PageHeader
        title="Ausencias"
        description="Avisos de jugadores que no van a un evento o estarán varios días fuera. No cambian la lista de asistencia."
        back={{ fallback: "/calendario", label: "← Volver al calendario" }}
        actions={
          canDeclare && (
            <DeclareAbsenceDialog
              players={(playersRes.data ?? []).map((p) => ({ id: p.id, name: p.full_name }))}
              events={events}
              today={todayInChile()}
              canSquad={canSquad}
            />
          )
        }
      />
      <div className="space-y-6">
      {!current.ok && (
        <Card>
          <p className="text-sm text-danger">No se pudieron cargar las ausencias.</p>
        </Card>
      )}
      <Group title="Ahora" rows={now} empty="Nadie está ausente por varios días ahora." {...groupProps} />
      <Group title="Próximas" rows={upcoming} empty="No hay avisos próximos." {...groupProps} />
      <Group title="Parón del plantel" rows={squad} empty="No hay un parón declarado." {...groupProps} />
      <Group
        title="Historial"
        rows={history.ok ? history.data.slice(0, 50) : []}
        empty="Todavía no hay avisos pasados."
        {...groupProps}
      />
      </div>
    </main>
  );
}
