import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { getActiveClubId, getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { isStaff, type UserRole } from "@/lib/roles";
import { canManageNominas } from "@/lib/match-load";
import { chileDateTime, eventTitle, longDayLabel } from "@/lib/events";
import { PageTitle, SectionTitle, buttonPrimary, buttonSecondary, cardClass } from "@/app/ui";

type MatchRow = {
  id: string;
  starts_at: string;
  opponent: string | null;
  location: string | null;
};

// Nóminas del club (staff): las convocatorias registradas en cada partido y, para
// quien las arma (head coach, manager y el delegado), el acceso directo a armar
// la del próximo partido. RLS: el staff ve las convocatorias de su club.
export default async function NominasPage() {
  const supabase = await getSupabase();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const nowIso = new Date().toISOString();
  // En paralelo: perfil (y con su deporte, titulares y banca), próximo partido, y la
  // convocatoria con sus partidos y participación. RLS: datos del club; sin acceso
  // se redirige antes de mostrar nada.
  // Solo datos del plantel activo (RLS trae los de todos los planteles de la cuenta).
  const clubId = await getActiveClubId(user.id);
  const [me, { data: next }, { data: callups }] = await Promise.all([
    getProfile(user.id),
    supabase
      .from("events")
      .select("id, starts_at, opponent, location")
      .eq("club_id", clubId)
      .eq("type", "competencia")
      .is("cancelled_at", null)
      .gt("starts_at", nowIso)
      .order("starts_at")
      .limit(1)
      .maybeSingle(),
    supabase.from("event_callups").select("event_id, slot").eq("club_id", clubId).is("removed_at", null),
  ]);
  if (me?.status === "pendiente") redirect("/pendiente");
  const roles = (me?.roles ?? []) as UserRole[];
  if (!me || me.status !== "confirmado" || !isStaff(roles)) redirect("/dashboard");
  const club = me.club;
  const canNomina = canManageNominas(roles, user.id, club?.nomina_delegate_id);

  const ids = [...new Set((callups ?? []).map((c) => c.event_id as string))];
  const [{ data: sizes }, { data: matches }, { data: loaded }] = await Promise.all([
    supabase.from("sports").select("starters, bench_size").eq("slug", club?.sport ?? "").maybeSingle(),
    ids.length
      ? supabase
          .from("events")
          .select("id, starts_at, opponent, location")
          .eq("club_id", clubId)
          .in("id", ids)
          .is("cancelled_at", null)
          .order("starts_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("event_participations").select("event_id").eq("club_id", clubId).in("event_id", ids)
      : Promise.resolve({ data: [] }),
  ]);

  const starters = (sizes?.starters as number | undefined) ?? 0;
  const bench = (sizes?.bench_size as number | undefined) ?? 0;
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

  const card = (m: MatchRow, past: boolean) => {
    const { date, time } = chileDateTime(m.starts_at);
    const n = byEvent.get(m.id)!;
    return (
      <li key={m.id} className={`space-y-3 p-4 sm:p-5 ${cardClass}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-ink">{eventTitle({ type: "competencia", opponent: m.opponent })}</p>
            <p className="text-sm text-muted">
              {longDayLabel(date)} · {time}
              {m.location && ` · ${m.location}`}
            </p>
          </div>
          {past && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                withParticipation.has(m.id) ? "bg-disponible-bg text-disponible-fg" : "bg-revision-bg text-revision-fg"
              }`}
            >
              {withParticipation.has(m.id) ? "Participación cargada" : "Falta la participación"}
            </span>
          )}
        </div>
        <p className="text-sm text-ink">
          <span className="font-semibold">{n.total}</span> {n.total === 1 ? "convocado" : "convocados"}
          <span className="text-muted">
            {" "}
            · Titulares {n.titulares}/{starters} · Banca {n.banca}/{bench}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/calendario/${m.id}/disponibles`} className={`text-sm ${buttonSecondary}`}>
            {canNomina && !past ? "Editar nómina" : "Ver nómina"}
          </Link>
          {past && canNomina && (
            <Link href={`/calendario/${m.id}/participacion`} className={`text-sm ${buttonSecondary}`}>
              Cargar participación
            </Link>
          )}
        </div>
      </li>
    );
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-6">
        <PageTitle>Nóminas</PageTitle>
        <p className="mt-1 text-sm text-muted">Convocatorias de cada partido: titulares y banca.</p>
      </header>

      {canNomina && (
        <Link href={armarHref} className={`mb-8 flex w-full flex-col py-4 text-base ${buttonPrimary}`}>
          <span className="flex items-center gap-2 text-lg font-semibold">
            <ClipboardList aria-hidden="true" className="size-6" />
            Armar nómina
          </span>
          {next && (
            <span className="text-sm font-normal">
              Próximo partido: {eventTitle({ type: "competencia", opponent: next.opponent })} ·{" "}
              {longDayLabel(chileDateTime(next.starts_at).date)}
            </span>
          )}
        </Link>
      )}

      {all.length === 0 ? (
        <p className={`p-5 text-sm text-muted ${cardClass}`}>Todavía no hay nóminas registradas.</p>
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <section>
              <SectionTitle className="mb-3">Próximos partidos</SectionTitle>
              <ul className="space-y-3">{upcoming.map((m) => card(m, false))}</ul>
            </section>
          )}
          {played.length > 0 && (
            <section>
              <SectionTitle className="mb-3">Partidos jugados</SectionTitle>
              <ul className="space-y-3">{played.map((m) => card(m, true))}</ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
