import Link from "next/link";
import { redirect } from "next/navigation";
import { ChartColumnBig, ClipboardPen } from "lucide-react";
import { getProfile, getSessionUser, getSupabase } from "@/lib/session";
import type { UserRole } from "@/lib/roles";
import { parseIsoDate, todayInChile } from "@/lib/injuries";
import { TEST_COLUMNS, canReadEvaluations, canWriteEvaluations, type TestDefinition } from "@/lib/evaluations";
import { SectionTitle, cardClass } from "@/app/ui";
import { Card, PageHeader } from "@/app/ui-blocks";
import { RUGBY_BACKS, RUGBY_FORWARDS } from "@/lib/gym";
import { Ranking, type RankingRow } from "../parts";
import { CatalogManager, DatePicker, ResultsForm, SuggestedTestsButton, TestPicker, type LoadGroup, type LoadRow } from "../client-parts";

type Tab = "cargar" | "comparar";

// Evaluaciones del staff: "Cargar resultados" (head coach, kine y preparador físico)
// y "Comparar plantel" (todo el staff menos el manager).
export default async function EvaluacionesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const supabase = await getSupabase();
  const me = await getProfile(user.id);
  if (me?.status === "pendiente") redirect("/pendiente");
  const roles = (me?.roles ?? []) as UserRole[];
  if (!me || me.status !== "confirmado" || !me.club_id) redirect("/dashboard");
  if (!canReadEvaluations(roles)) redirect(roles.includes("jugador") ? "/evaluaciones/mias" : "/dashboard");

  const canWrite = canWriteEvaluations(roles);
  const tab: Tab = canWrite && query.tab !== "comparar" ? "cargar" : "comparar";
  const { data: testRows } = await supabase
    .from("test_definitions")
    .select(TEST_COLUMNS)
    .eq("club_id", me.club_id)
    .is("archived_at", null)
    .order("name");
  const tests = (testRows ?? []) as TestDefinition[];
  const test = tests.find((t) => t.id === query.test) ?? tests[0] ?? null;
  const today = todayInChile();
  const date = typeof query.fecha === "string" && parseIsoDate(query.fecha) !== null && query.fecha <= today ? query.fecha : today;
  const saved = typeof query.guardado === "string" ? Number(query.guardado) || null : null;

  const tabHref = (t: Tab) => `/evaluaciones?tab=${t}${test ? `&test=${test.id}` : ""}`;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:max-w-4xl lg:px-8">
      <PageHeader title="Evaluaciones" description="Tests físicos del plantel: carga los resultados y compara la evolución." />

      <nav aria-label="Secciones de evaluaciones" className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-line bg-mist p-1">
        {canWrite && (
          <TabLink href={tabHref("cargar")} active={tab === "cargar"} Icon={ClipboardPen}>
            Cargar resultados
          </TabLink>
        )}
        <TabLink href={tabHref("comparar")} active={tab === "comparar"} Icon={ChartColumnBig} wide={!canWrite}>
          Comparar plantel
        </TabLink>
      </nav>

      {!test ? (
        <section className={`space-y-4 p-6 ${cardClass}`}>
          <SectionTitle>Aún no hay tests en el plantel</SectionTitle>
          {canWrite ? (
            <>
              <p className="text-sm text-muted">
                Empieza con los tests más usados (sentadilla, press banca, peso muerto, CMJ, sprint 20 m,
                Yo-Yo y Bronco) o crea los tuyos.
              </p>
              <SuggestedTestsButton />
              <CatalogManager tests={[]} />
            </>
          ) : (
            <p className="text-sm text-muted">
              El head coach, el kinesiólogo o el preparador físico deben agregar los tests del plantel.
            </p>
          )}
        </section>
      ) : tab === "cargar" ? (
        <LoadTab clubId={me.club_id} sport={me.club?.sport ?? ""} tests={tests} test={test} date={date} today={today} saved={saved} />
      ) : (
        <CompareTab tests={tests} test={test} />
      )}
    </main>
  );
}

function TabLink({
  href,
  active,
  Icon,
  wide = false,
  children,
}: {
  href: string;
  active: boolean;
  Icon: typeof ClipboardPen;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      replace
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-ink transition ${
        wide ? "col-span-2" : ""
      } ${active ? "bg-white font-semibold shadow-sm" : "hover:bg-white/60"}`}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {children}
    </Link>
  );
}

async function LoadTab({
  clubId,
  sport,
  tests,
  test,
  date,
  today,
  saved,
}: {
  clubId: string;
  sport: string;
  tests: TestDefinition[];
  test: TestDefinition;
  date: string;
  today: string;
  saved: number | null;
}) {
  const supabase = await getSupabase();
  const [{ data: players }, { data: results }, { data: positionRows }] = await Promise.all([
    supabase
      .from("players")
      .select("id, full_name, position")
      .eq("club_id", clubId)
      .eq("status", "confirmado")
      .eq("active", true)
      .order("full_name"),
    // Resultados vigentes hasta esa fecha: el de ese día y el anterior de cada jugador.
    supabase
      .from("test_results")
      .select("id, player_id, value, measured_on")
      .eq("club_id", clubId)
      .eq("test_id", test.id)
      .is("voided_at", null)
      .lte("measured_on", date)
      .order("measured_on", { ascending: false }),
    supabase.from("positions").select("name, sort").eq("sport", sport).eq("format", "15").order("sort"),
  ]);
  // Grupos de posición para filtrar: en rugby, Delanteros y Backs (igual que el editor de
  // planes); en el resto, una posición por grupo.
  const groups: LoadGroup[] =
    sport === "rugby"
      ? [
          { label: "Delanteros", names: RUGBY_FORWARDS },
          { label: "Backs", names: RUGBY_BACKS },
        ]
      : (positionRows ?? []).map((p) => ({ label: p.name as string, names: [p.name as string] }));
  const byPlayer = new Map<string, { id: string; value: number; measured_on: string }[]>();
  for (const r of results ?? []) {
    const list = byPlayer.get(r.player_id as string) ?? [];
    list.push({ id: r.id as string, value: Number(r.value), measured_on: r.measured_on as string });
    byPlayer.set(r.player_id as string, list);
  }
  const rows: LoadRow[] = (players ?? []).map((p) => {
    const list = byPlayer.get(p.id as string) ?? [];
    const sameDay = list.find((r) => r.measured_on === date) ?? null;
    const previous = list.find((r) => r.measured_on < date) ?? null;
    return {
      playerId: p.id as string,
      name: p.full_name as string,
      position: (p.position as string | null) ?? null,
      sameDay: sameDay ? { id: sameDay.id, value: sameDay.value } : null,
      previous: previous ? { value: previous.value, measured_on: previous.measured_on } : null,
    };
  });

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <TestPicker tests={tests} selectedId={test.id} />
          <DatePicker value={date} max={today} />
        </div>
        {test.display_format === "mmss" && (
          <p className="mt-3 text-13 text-muted">Anota los tiempos como minutos y segundos, por ejemplo 4:35.</p>
        )}
      </Card>
      {rows.length === 0 ? (
        <p className={`p-6 text-center text-sm text-muted ${cardClass}`}>Aún no hay jugadores confirmados en el plantel.</p>
      ) : (
        <ResultsForm key={`${test.id}-${date}`} test={test} date={date} rows={rows} groups={groups} savedCount={saved} />
      )}
      <details className={`p-5 ${cardClass}`}>
        <summary className="flex min-h-11 cursor-pointer items-center font-medium text-ink">Administrar tests</summary>
        <div className="mt-3">
          <CatalogManager tests={tests} />
        </div>
      </details>
    </div>
  );
}

async function CompareTab({ tests, test }: { tests: TestDefinition[]; test: TestDefinition }) {
  const supabase = await getSupabase();
  const { data } = await supabase.rpc("get_test_ranking", { p_test: test.id });
  const rows = (data ?? []) as RankingRow[];
  return (
    <div className="space-y-4">
      <Card>
        <TestPicker tests={tests} selectedId={test.id} />
        <p className="mt-3 text-13 text-muted">
          Último resultado de cada jugador{test.higher_is_better ? "" : " (menos es mejor)"} y el cambio desde su evaluación anterior.
        </p>
      </Card>
      <Ranking rows={rows} test={test} />
    </div>
  );
}
