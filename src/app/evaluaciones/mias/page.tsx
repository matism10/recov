import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveClubId, getProfile, getSessionUser, getSupabase } from "@/lib/session";
import type { UserRole } from "@/lib/roles";
import { TEST_COLUMNS, formatValue, type TestDefinition } from "@/lib/evaluations";
import { PageTitle, SectionTitle, cardClass, textButton } from "@/app/ui";
import { TestPicker } from "../client-parts";
import { ChangeBadge, ProgressChart, Ranking, shortDateLabel, type RankingRow } from "../parts";

// Mis evaluaciones (jugador): último resultado, progreso y ranking del plantel con su fila.
export default async function MisEvaluacionesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const supabase = await getSupabase();
  const clubId = await getActiveClubId(user.id);
  const [me, { data: player }, { data: testRows }] = await Promise.all([
    getProfile(user.id),
    supabase.from("players").select("id").eq("user_id", user.id).eq("club_id", clubId).maybeSingle(),
    supabase.from("test_definitions").select(TEST_COLUMNS).eq("club_id", clubId).is("archived_at", null).order("name"),
  ]);
  if (me?.status === "pendiente") redirect("/pendiente");
  const roles = (me?.roles ?? []) as UserRole[];
  if (!me || me.status !== "confirmado" || !roles.includes("jugador") || !player) redirect("/dashboard");

  const tests = (testRows ?? []) as TestDefinition[];
  // Mis resultados de todos los tests (RLS: solo los propios), para elegir uno con datos.
  const { data: mine } = await supabase
    .from("test_results")
    .select("test_id, value, measured_on")
    .eq("player_id", player.id)
    .is("voided_at", null)
    .order("measured_on");
  const withData = new Set((mine ?? []).map((r) => r.test_id as string));
  const test =
    tests.find((t) => t.id === query.test) ?? tests.find((t) => withData.has(t.id)) ?? tests[0] ?? null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-6">
        <Link href="/dashboard" className={textButton}>
          ← Volver al resumen
        </Link>
        <PageTitle>Mis evaluaciones</PageTitle>
        <p className="mt-1 text-sm text-muted">Tus resultados en los tests físicos y cómo vas frente al plantel.</p>
      </header>
      {!test ? (
        <p className={`p-6 text-center text-sm text-muted ${cardClass}`}>
          Tu plantel aún no tiene tests. Cuando el staff cargue evaluaciones, las verás aquí.
        </p>
      ) : (
        <PlayerTest tests={tests} test={test} playerId={player.id as string}
          points={(mine ?? []).filter((r) => r.test_id === test.id).map((r) => ({ measured_on: r.measured_on as string, value: Number(r.value) }))} />
      )}
    </main>
  );
}

async function PlayerTest({
  tests,
  test,
  playerId,
  points,
}: {
  tests: TestDefinition[];
  test: TestDefinition;
  playerId: string;
  points: { measured_on: string; value: number }[];
}) {
  const supabase = await getSupabase();
  const { data } = await supabase.rpc("get_test_ranking", { p_test: test.id });
  const rows = (data ?? []) as RankingRow[];
  const last = points.at(-1);
  const previous = points.length > 1 ? points[points.length - 2].value : null;
  const position = rows.findIndex((r) => r.player_id === playerId);
  return (
    <div className="space-y-6">
      <TestPicker tests={tests} selectedId={test.id} />
      <section className={`p-5 ${cardClass}`}>
        <SectionTitle>Último resultado</SectionTitle>
        {last ? (
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-bold text-ink tabular-nums">{formatValue(last.value, test)}</p>
              <p className="text-sm text-muted">{shortDateLabel(last.measured_on)}</p>
            </div>
            <div className="text-right">
              <ChangeBadge current={last.value} previous={previous} test={test} />
              {position >= 0 && (
                <p className="mt-1 text-sm text-ink">
                  Puesto {position + 1} de {rows.length} en el plantel
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Aún no tienes resultados en {test.name}.</p>
        )}
      </section>
      {points.length > 0 && (
        <section className={`p-5 ${cardClass}`}>
          <SectionTitle className="mb-3">Tu progreso</SectionTitle>
          <ProgressChart points={points} test={test} />
        </section>
      )}
      <section>
        <SectionTitle className="mb-3">Ranking del plantel</SectionTitle>
        <Ranking rows={rows} test={test} highlightPlayerId={playerId} />
      </section>
    </div>
  );
}
