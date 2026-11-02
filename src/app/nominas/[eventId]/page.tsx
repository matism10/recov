import Link from "next/link";
import { redirect } from "next/navigation";
import { isStaff } from "@/lib/roles";
import { getLineupSize } from "@/lib/match-load";
import { getFormatContext } from "@/lib/format";
import { pitchKind, slotLabel } from "@/lib/pitch";
import { EVENT_COLUMNS, eventTimeLabel, eventTitle, longDayLabel, toCalendarEvent, type EventRow } from "@/lib/events";
import { SectionTitle, cardClass, textButton } from "@/app/ui";
import { getSupabase } from "@/lib/session";
import { requireMember } from "@/app/calendario/member";

type Callup = { player_id: string; slot: number | null };
type Player = { id: string; full_name: string; position: string | null; user_id: string | null };

// Nómina de un partido en solo lectura (0048), para el jugador: quién va, titulares
// y banca con su puesto. Sin disponibilidad, minutos ni nada de salud. El staff
// sigue en /calendario/[id]/disponibles (con la disponibilidad del plantel).
export default async function NominaReadOnlyPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  // RLS: solo eventos y convocatorias del club; un id ajeno no devuelve filas.
  const supabase = await getSupabase();
  const eventPromise = supabase.from("events").select(EVENT_COLUMNS).eq("id", eventId).maybeSingle();
  const callupsPromise = supabase
    .from("event_callups")
    .select("player_id, slot")
    .eq("event_id", eventId)
    .is("removed_at", null);
  const { roles, club, userId, clubId } = await requireMember();
  if (isStaff(roles)) redirect(`/calendario/${eventId}/disponibles`);

  const [{ data }, { data: callupRows }, formatCtx] = await Promise.all([
    eventPromise,
    callupsPromise,
    getFormatContext(userId),
  ]);
  const row = data as EventRow | null;
  if (!row || row.type !== "competencia") redirect("/nominas");
  const event = toCalendarEvent(row);
  // La nómina sigue el formato del evento, no el activo.
  const format = row.format === "7" ? "7" : "15";
  const sevens = format === "7";
  const callups = (callupRows ?? []) as Callup[];

  const ids = callups.map((c) => c.player_id);
  const [{ starters }, { data: playerRows }] = await Promise.all([
    getLineupSize(supabase, club?.sport ?? "", format),
    ids.length
      ? supabase.from("players").select("id, full_name, position, user_id").eq("club_id", clubId).in("id", ids)
      : Promise.resolve({ data: [] }),
  ]);
  const players = new Map(((playerRows ?? []) as Player[]).map((p) => [p.id, p]));
  const kind = pitchKind(club?.sport, format);

  const positionOf = (p: Player | undefined) =>
    sevens ? (p?.user_id ? (formatCtx.group.get(p.user_id)?.position ?? null) : null) : (p?.position ?? null);
  const placeOf = (slot: number | null) =>
    slot === null ? null : kind ? slotLabel(kind, starters, slot) : slot > starters ? `Banca · ${slot}` : `Puesto ${slot}`;

  const bySlot = (a: Callup, b: Callup) => (a.slot ?? 0) - (b.slot ?? 0);
  const titulares = callups.filter((c) => c.slot !== null && c.slot <= starters).sort(bySlot);
  const banca = callups.filter((c) => c.slot !== null && c.slot > starters).sort(bySlot);
  const sinPuesto = callups
    .filter((c) => c.slot === null)
    .sort((a, b) =>
      (players.get(a.player_id)?.full_name ?? "").localeCompare(players.get(b.player_id)?.full_name ?? "", "es"),
    );

  const item = (c: Callup) => {
    const p = players.get(c.player_id);
    const me = p?.user_id === userId;
    // El puesto de la nómina ("Puesto 9 · Medio scrum", "Banca · 18"); sin puesto, la posición del jugador.
    const detail = placeOf(c.slot) ?? positionOf(p);
    return (
      <li
        key={c.player_id}
        className={`flex items-center gap-3 px-4 py-3 ${me ? "bg-brand-soft" : ""}`}
        aria-current={me ? "true" : undefined}
      >
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-white text-sm font-semibold text-ink"
        >
          {c.slot ?? "–"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-ink">
            {p?.full_name ?? "Jugador"}
            {me && <span className="ml-2 text-xs font-semibold text-brand-strong">Tú</span>}
          </span>
          {detail && <span className="block truncate text-sm text-muted">{detail}</span>}
        </span>
      </li>
    );
  };

  const group = (title: string, list: Callup[]) =>
    list.length > 0 && (
      <section>
        <SectionTitle className="mb-3">
          {title} <span className="font-normal text-muted">({list.length})</span>
        </SectionTitle>
        <ul className={`divide-y divide-line overflow-hidden ${cardClass}`}>{list.map(item)}</ul>
      </section>
    );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-6">
        <Link href="/nominas" className={textButton}>
          ← Volver a Nóminas
        </Link>
        <p className="mt-2 text-sm text-muted">
          Nómina{sevens && " · Sevens"}
          {event.cancelled && " · Cancelado"}
        </p>
        <h1 className="text-2xl font-semibold text-ink">{eventTitle(event)}</h1>
        <p className="mt-1 text-sm text-muted">
          {longDayLabel(event.day)} · {eventTimeLabel(event)}
          {event.location && ` · ${event.location}`}
        </p>
        {callups.length > 0 && (
          <p className="mt-3 text-sm text-ink">
            <span className="font-semibold">{callups.length}</span> {callups.length === 1 ? "convocado" : "convocados"}
          </p>
        )}
      </header>

      {callups.length === 0 ? (
        <p className={`p-5 text-sm text-muted ${cardClass}`}>Todavía no hay nómina para este partido.</p>
      ) : (
        <div className="space-y-8">
          {group("Titulares", titulares)}
          {group("Banca", banca)}
          {group(titulares.length || banca.length ? "Convocados sin puesto" : "Convocados", sinPuesto)}
        </div>
      )}
    </main>
  );
}
