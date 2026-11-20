import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { getActiveClubId, getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { isStaff, type UserRole } from "@/lib/roles";
import { canManageNominas, getLineupSize } from "@/lib/match-load";
import { getActiveFormat } from "@/lib/format";
import { chileDateTime, eventTitle, longDayLabel } from "@/lib/events";
import { buttonPrimary, buttonSecondary } from "@/app/ui";
import { CardHeader, EmptyState, ListRow, PageHeader, TableCard } from "@/app/ui-blocks";

type MatchRow = {
  id: string;
  starts_at: string;
  opponent: string | null;
  location: string | null;
};

// Nóminas del club: las convocatorias registradas en cada partido y, para quien
// las arma (head coach, manager y el delegado), el acceso directo a armar la del
// próximo partido. RLS (0048): todo confirmado del club ve las convocatorias. El
// jugador las ve en lectura en /nominas/[eventId] (sin disponibilidad ni minutos).
export default async function NominasPage({
  searchParams,
}: {
  searchParams: Promise<{ jugados?: string }>;
}) {
  const { jugados } = await searchParams;
  const supabase = await getSupabase();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const nowIso = new Date().toISOString();
  // En paralelo: perfil (y con su deporte, titulares y banca), próximo partido, y la
  // convocatoria con sus partidos y participación. RLS: datos del club; sin acceso
  // se redirige antes de mostrar nada.
  // Solo datos del plantel activo (RLS trae los de todos los planteles de la cuenta).
  // Formato activo: solo los partidos de ese formato (Rugby 15 o Sevens).
  const [clubId, format] = await Promise.all([getActiveClubId(user.id), getActiveFormat(user.id)]);
  const [me, { data: next }, { data: callups }] = await Promise.all([
    getProfile(user.id),
    supabase
      .from("events")
      .select("id, starts_at, opponent, location")
      .eq("club_id", clubId)
      .eq("type", "competencia")
      .eq("format", format)
      .is("cancelled_at", null)
      .gt("starts_at", nowIso)
      .order("starts_at")
      .limit(1)
      .maybeSingle(),
    supabase.from("event_callups").select("event_id, slot").eq("club_id", clubId).is("removed_at", null),
  ]);
  if (me?.status === "pendiente") redirect("/pendiente");
  const roles = (me?.roles ?? []) as UserRole[];
  if (!me || me.status !== "confirmado") redirect("/dashboard");
  const staff = isStaff(roles);
  const club = me.club;
  const canNomina = canManageNominas(roles, user.id, club?.nomina_delegate_id);

  const ids = [...new Set((callups ?? []).map((c) => c.event_id as string))];
  const [{ starters, bench }, { data: matches }, { data: loaded }] = await Promise.all([
    getLineupSize(supabase, club?.sport ?? "", format),
    ids.length
      ? supabase
          .from("events")
          .select("id, starts_at, opponent, location")
          .eq("club_id", clubId)
          .in("id", ids)
          .eq("format", format)
          .is("cancelled_at", null)
          .order("starts_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    // Participación cargada: solo para el staff (el jugador ve solo sus propias filas).
    ids.length && staff
      ? supabase.from("event_participations").select("event_id").eq("club_id", clubId).in("event_id", ids)
      : Promise.resolve({ data: [] }),
  ]);

  const byEvent = new Map<string, { total: number; titulares: number; banca: number }>();
  for (const c of callups ?? []) {
    const k = c.event_id as string;
    const n = byEvent.get(k) ?? { total: 0, titulares: 0, banca: 0 };
    n.total++;
    const slot = c.slot as number | null;
    if (slot !== null && slot <= starters) n.titulares++;
    if (slot !== null && slot > starters) n.banca++;
    byEvent.set(k, n);
  }
  const withParticipation = new Set((loaded ?? []).map((p) => p.event_id as string));
  const all = (matches ?? []) as MatchRow[];
  const now = Date.parse(nowIso);
  const upcoming = all.filter((m) => Date.parse(m.starts_at) > now).reverse();
  const played = all.filter((m) => Date.parse(m.starts_at) <= now);

  const armarHref = next ? `/calendario/${next.id}/disponibles` : "/nominas/sin-partido";

  const PLAYED_SHOWN = 5;
  const playedShown = jugados === "todos" ? played : played.slice(0, PLAYED_SHOWN);

  const row = (m: MatchRow, past: boolean) => {
    const { date, time } = chileDateTime(m.starts_at);
    const n = byEvent.get(m.id)!;
    return (
      <ListRow key={m.id} className="flex-wrap justify-between gap-y-2 py-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{eventTitle({ type: "competencia", opponent: m.opponent })}</p>
          <p className="text-13 text-muted">
            {longDayLabel(date)} · {time}
            {m.location && ` · ${m.location}`}
          </p>
          <p className="mt-0.5 text-13 text-ink">
            <span className="font-semibold">{n.total}</span> {n.total === 1 ? "convocado" : "convocados"}
            <span className="text-muted">
              {" "}
              · Titulares {n.titulares}/{starters} · Banca {n.banca}/{bench}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {past && staff && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                withParticipation.has(m.id) ? "bg-disponible-bg text-disponible-fg" : "bg-revision-bg text-revision-fg"
              }`}
            >
              {withParticipation.has(m.id) ? "Participación cargada" : "Falta la participación"}
            </span>
          )}
          <Link
            href={staff ? `/calendario/${m.id}/disponibles` : `/nominas/${m.id}`}
            className={`text-sm ${buttonSecondary}`}
          >
            {canNomina && !past ? "Editar nómina" : "Ver nómina"}
          </Link>
          {past && canNomina && (
            <Link href={`/calendario/${m.id}/participacion`} className={`text-sm ${buttonSecondary}`}>
              Cargar participación
            </Link>
          )}
        </div>
      </ListRow>
    );
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 lg:max-w-[1200px] lg:px-8 lg:py-10">
      <PageHeader
        title="Nóminas"
        description={
          next
            ? `Próximo partido: ${eventTitle({ type: "competencia", opponent: next.opponent })} · ${longDayLabel(chileDateTime(next.starts_at).date)}`
            : "Convocatorias de cada partido: titulares y banca."
        }
        actions={
          canNomina && (
            <Link id="armar-nomina" href={armarHref} className={`gap-2 ${buttonPrimary}`}>
              <ClipboardList aria-hidden="true" className="size-5" />
              Armar nómina
            </Link>
          )
        }
      />

      {all.length === 0 ? (
        <EmptyState title="Todavía no hay nóminas registradas" />
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <TableCard header={<CardHeader title="Próximos partidos" count={upcoming.length} className="mb-0" />}>
              {upcoming.map((m) => row(m, false))}
            </TableCard>
          )}
          {played.length > 0 && (
            <TableCard
              header={<CardHeader title="Partidos jugados" count={played.length} className="mb-0" />}
              footer={
                played.length > PLAYED_SHOWN && (
                  <Link
                    href={jugados === "todos" ? "/nominas" : "/nominas?jugados=todos"}
                    className="inline-flex min-h-11 items-center text-sm font-medium text-brand-text underline"
                  >
                    {jugados === "todos" ? "Ver menos" : `Ver todos (${played.length})`}
                  </Link>
                )
              }
            >
              {playedShown.map((m) => row(m, true))}
            </TableCard>
          )}
        </div>
      )}
    </main>
  );
}
