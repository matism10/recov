// Evaluaciones en la ficha del jugador: un gráfico de progreso por test con resultados.
// RLS decide qué llega: el staff que ve evaluaciones (no el manager) y el propio jugador.
import { getSupabase } from "@/lib/session";
import { TEST_COLUMNS, formatValue, type TestDefinition } from "@/lib/evaluations";
import { SectionTitle, cardClass } from "@/app/ui";
import { ChangeBadge, ProgressChart } from "./parts";

export async function PlayerEvaluations({ playerId, clubId }: { playerId: string; clubId: string }) {
  const supabase = await getSupabase();
  const [{ data: tests }, { data: results }] = await Promise.all([
    supabase.from("test_definitions").select(TEST_COLUMNS).eq("club_id", clubId).order("name"),
    supabase
      .from("test_results")
      .select("test_id, value, measured_on")
      .eq("player_id", playerId)
      .is("voided_at", null)
      .order("measured_on"),
  ]);
  const byTest = new Map<string, { measured_on: string; value: number }[]>();
  for (const r of results ?? []) {
    const list = byTest.get(r.test_id as string) ?? [];
    list.push({ measured_on: r.measured_on as string, value: Number(r.value) });
    byTest.set(r.test_id as string, list);
  }
  const withData = ((tests ?? []) as TestDefinition[]).filter((t) => byTest.has(t.id));
  if (withData.length === 0) return null;
  return (
    <section className="mt-8">
      <SectionTitle className="mb-3">Evaluaciones</SectionTitle>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {withData.map((t) => {
          const points = byTest.get(t.id)!;
          const last = points[points.length - 1];
          const prev = points.length > 1 ? points[points.length - 2].value : null;
          return (
            <div key={t.id} className={`p-5 ${cardClass}`}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium text-ink">{t.name}</h3>
                <span className="flex items-baseline gap-2">
                  <span className="font-semibold text-ink tabular-nums">{formatValue(last.value, t)}</span>
                  <ChangeBadge current={last.value} previous={prev} test={t} />
                </span>
              </div>
              <ProgressChart points={points} test={t} height={150} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
