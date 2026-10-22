import Link from "next/link";
import { redirect } from "next/navigation";
import { EVENT_COLUMNS, eventTitle, longDayLabel, toCalendarEvent, type EventRow } from "@/lib/events";
import { NOMINA_MODE_LABEL, canManageNominas, getLoadScale } from "@/lib/match-load";
import { buttonSecondary, cardClass, textButton } from "@/app/ui";
import { getSupabase } from "@/lib/session";
import { requireMember } from "../../member";
import { ParticipationForm, type ParticipationEntry } from "./participation-form";

// Carga de la participación de los convocados de un partido ya empezado. Solo
// head coach, manager y el delegado de nóminas; el control depende del modo del
// club (minutos, rango del deporte o jugó / no jugó).
export default async function ParticipationPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  // El evento y lo cargado del partido solo necesitan su id: salen en paralelo con la
  // sesión. RLS: datos del club; sin permiso de nóminas se redirige antes de mostrar.
  const supabase = await getSupabase();
  const eventPromise = supabase.from("events").select(EVENT_COLUMNS).eq("id", eventId).maybeSingle();
  // Convocatoria vigente con sus jugadores, y participación ya cargada.
  const callupPlayersPromise = supabase
    .from("event_callups")
    .select("player_id")
    .eq("event_id", eventId)
    .is("removed_at", null)
    .then(async ({ data: callups }) => {
      const ids = (callups ?? []).map((c) => c.player_id as string);
      if (!ids.length) return [];
      const { data: players } = await supabase.from("players").select("id, full_name, position").in("id", ids);
      return players ?? [];
    });
  const loadedPromise = supabase
    .from("event_participations")
    .select("player_id, mode, minutes, range_bucket, played")
    .eq("event_id", eventId);
  const { roles, club, userId } = await requireMember();
  if (!club || !canManageNominas(roles, userId, club.nomina_delegate_id)) redirect("/calendario");

  const { data } = await eventPromise;
  if (!data) redirect("/calendario");
  const event = toCalendarEvent(data as EventRow);
  const back = `/calendario?fecha=${event.day}&evento=${event.id}`;
  if (event.type !== "competencia" || event.cancelled) redirect(back);

  const header = (
    <header className="mb-6">
      <Link href={back} className={textButton}>
        ← Volver al calendario
      </Link>
      <p className="mt-2 text-sm text-muted">Participación · {NOMINA_MODE_LABEL[club.nomina_mode]}</p>
      <h1 className="text-2xl font-semibold text-ink">{eventTitle(event)}</h1>
      <p className="mt-1 text-sm text-muted">
        {longDayLabel(event.day)} · {event.start} – {event.end}
        {event.location && ` · ${event.location}`}
      </p>
    </header>
  );

  if (!event.past) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        {header}
        <p className={`p-5 text-sm text-muted ${cardClass}`}>
          El partido todavía no empieza. La participación se carga desde que comienza.
        </p>
      </main>
    );
  }

  // Convocados, participación ya cargada, escala y tope del deporte.
  const [players, { data: loaded }, scale, { data: sport }] = await Promise.all([
    callupPlayersPromise,
    loadedPromise,
    getLoadScale(supabase, club.sport),
    supabase.from("sports").select("max_minutes").eq("slug", club.sport).maybeSingle(),
  ]);
  const byPlayer = new Map((loaded ?? []).map((p) => [p.player_id as string, p]));

  // Valor inicial: lo ya cargado que sirva para el modo actual (un dato más
  // detallado sirve para uno menos detallado, no al revés).
  const entries: ParticipationEntry[] = (players ?? [])
    .map((p) => {
      const row = byPlayer.get(p.id as string);
      return {
        playerId: p.id as string,
        name: p.full_name as string,
        position: (p.position as string | null) ?? null,
        minutes: row?.mode === "exacto" ? (row.minutes as number) : null,
        bucket: row && row.mode !== "jugo" ? (row.range_bucket as number) : null,
        played: row ? (row.played as boolean) : null,
        loaded: !!row,
        otherMode: !!row && row.mode !== club.nomina_mode,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      {header}
      {entries.length === 0 ? (
        <div className={`space-y-3 p-5 ${cardClass}`}>
          <p className="text-sm text-muted">Este partido no tiene convocados.</p>
          <Link href={`/calendario/${event.id}/disponibles`} className={`text-sm ${buttonSecondary}`}>
            Arma la convocatoria
          </Link>
        </div>
      ) : (
        <ParticipationForm
          eventId={event.id}
          mode={club.nomina_mode}
          maxMinutes={(sport?.max_minutes as number | undefined) ?? 0}
          scale={scale}
          entries={entries}
          callupsHref={`/calendario/${event.id}/disponibles`}
        />
      )}
    </main>
  );
}
