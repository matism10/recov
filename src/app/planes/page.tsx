import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import { getProfile, getSessionUser, getSupabase } from "@/lib/session";
import type { UserRole } from "@/lib/roles";
import { WEEKDAY_LABELS } from "@/lib/events";
import { PLAN_STATUS_LABEL, canPlanGym, rangeLabel, type PlanStatus, type TargetKind } from "@/lib/gym";
import { PageTitle, SectionTitle, buttonPrimary, cardClass } from "@/app/ui";
import { targetSummary } from "./targets";

type PlanRow = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  status: PlanStatus;
  updated_at: string;
};
type Progress = { plan_id: string; players: number; assigned: number; due: number; done: number };

const STATUS_ORDER: PlanStatus[] = ["publicado", "borrador", "archivado"];
const STATUS_STYLE: Record<PlanStatus, string> = {
  publicado: "bg-disponible-bg text-disponible-fg",
  borrador: "bg-revision-bg text-revision-fg",
  archivado: "bg-mist text-muted border border-line",
};

// Planes de gimnasio del plantel (head coach y preparador físico): borradores,
// publicados y archivados, con vigencia, a quién va y % cumplido.
export default async function PlanesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const supabase = await getSupabase();
  const me = await getProfile(user.id);
  if (me?.status === "pendiente") redirect("/pendiente");
  const roles = (me?.roles ?? []) as UserRole[];
  if (!me || me.status !== "confirmado" || !me.club_id || !canPlanGym(roles)) redirect("/dashboard");
  const clubId = me.club_id;

  // RLS: el staff confirmado lee los planes de su plantel; se filtra por el activo.
  const [{ data: plans }, { data: sessions }, { data: targets }, { data: progress }] = await Promise.all([
    supabase
      .from("gym_plans")
      .select("id, name, starts_on, ends_on, status, updated_at")
      .eq("club_id", clubId)
      .order("starts_on", { ascending: false }),
    supabase
      .from("gym_plan_sessions")
      .select("plan_id, weekday")
      .eq("club_id", clubId)
      .is("archived_at", null),
    supabase
      .from("gym_plan_targets")
      .select("plan_id, kind, positions(name), players(full_name)")
      .eq("club_id", clubId)
      .is("archived_at", null),
    supabase.rpc("gym_plan_progress"),
  ]);

  const rows = (plans ?? []) as PlanRow[];
  const daysByPlan = new Map<string, Set<number>>();
  for (const s of sessions ?? []) {
    const set = daysByPlan.get(s.plan_id) ?? new Set<number>();
    set.add(s.weekday);
    daysByPlan.set(s.plan_id, set);
  }
  type TargetRow = {
    plan_id: string;
    kind: TargetKind;
    positions: { name: string } | { name: string }[] | null;
    players: { full_name: string } | { full_name: string }[] | null;
  };
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? (v[0] ?? null) : v);
  const targetsByPlan = new Map<string, { kind: TargetKind; name: string | null }[]>();
  for (const t of (targets ?? []) as TargetRow[]) {
    const list = targetsByPlan.get(t.plan_id) ?? [];
    list.push({ kind: t.kind, name: one(t.positions)?.name ?? one(t.players)?.full_name ?? null });
    targetsByPlan.set(t.plan_id, list);
  }
  const progressByPlan = new Map(((progress ?? []) as Progress[]).map((p) => [p.plan_id, p]));

  const groups = STATUS_ORDER.map((status) => ({ status, items: rows.filter((p) => p.status === status) })).filter(
    (g) => g.items.length > 0,
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:max-w-5xl lg:px-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <PageTitle>Planes de gimnasio</PageTitle>
          <p className="mt-1 text-sm text-muted">
            Arma sesiones de fuerza con kilos calculados desde los máximos de Evaluaciones.
          </p>
        </div>
        <Link href="/planes/nuevo" className={buttonPrimary}>
          <Plus aria-hidden="true" className="size-4" />
          Nuevo plan
        </Link>
      </header>

      {groups.length === 0 ? (
        <section className={`space-y-3 p-6 ${cardClass}`}>
          <SectionTitle>Aún no hay planes</SectionTitle>
          <p className="text-sm text-muted">
            Crea el primero: elige a quién va, sus días y los ejercicios de cada sesión. Los jugadores lo ven en
            &quot;Mi plan&quot; con sus kilos.
          </p>
          <Link href="/planes/nuevo" className={buttonPrimary}>
            Crear plan
          </Link>
        </section>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.status}>
              <h2 className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
                {PLAN_STATUS_LABEL[g.status]}s ({g.items.length})
              </h2>
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-mist">
                {g.items.map((p) => {
                  const days = [...(daysByPlan.get(p.id) ?? [])].sort().map((d) => WEEKDAY_LABELS[d - 1]);
                  const prog = progressByPlan.get(p.id);
                  const pct = prog && prog.due > 0 ? Math.round((Math.min(prog.done, prog.due) / prog.due) * 100) : null;
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/planes/${p.id}`}
                        className="flex items-center gap-4 px-5 py-4 transition hover:bg-white"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-ink">{p.name}</span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[p.status]}`}
                            >
                              {PLAN_STATUS_LABEL[p.status]}
                            </span>
                          </p>
                          <p className="text-sm text-muted">
                            {rangeLabel(p.starts_on, p.ends_on)}
                            {days.length > 0 && ` · ${days.join(", ")}`}
                          </p>
                          <p className="text-sm text-ink">
                            {targetSummary(targetsByPlan.get(p.id) ?? [])}
                            {prog && ` · lo reciben ${prog.players}`}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          {pct !== null ? (
                            <>
                              <span className="block font-display text-xl font-bold text-ink tabular-nums">{pct} %</span>
                              <span className="block text-xs text-muted">cumplido</span>
                            </>
                          ) : (
                            <span className="block text-xs text-muted">
                              {p.status === "borrador" ? "Sin publicar" : "Sin sesiones aún"}
                            </span>
                          )}
                        </div>
                        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
