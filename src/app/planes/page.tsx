import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import { getProfile, getSessionUser, getSupabase } from "@/lib/session";
import type { UserRole } from "@/lib/roles";
import { WEEKDAY_LABELS } from "@/lib/events";
import { PLAN_STATUS_LABEL, canPlanGym, rangeLabel, type PlanStatus, type TargetKind } from "@/lib/gym";
import { buttonPrimary, cardClass } from "@/app/ui";
import { CardHeader, EmptyState, PageHeader } from "@/app/ui-blocks";
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

const EMPTY_TITLE: Record<PlanStatus, string> = {
  publicado: "Ningún plan publicado",
  borrador: "No hay borradores",
  archivado: "No hay planes archivados",
};
const EMPTY_TEXT: Record<PlanStatus, string> = {
  publicado: "Publica un borrador para que los jugadores lo vean en \"Mi plan\".",
  borrador: "Un plan queda como borrador hasta que lo publicas.",
  archivado: "Un plan archivado deja de verse para los jugadores.",
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

  const groups = STATUS_ORDER.map((status) => ({ status, items: rows.filter((p) => p.status === status) }));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 lg:max-w-[1200px] lg:px-8 lg:py-10">
      <PageHeader
        title="Planes de gimnasio"
        description="Arma sesiones de fuerza con kilos calculados desde los máximos de Evaluaciones."
        actions={
          <Link href="/planes/nuevo" className={buttonPrimary}>
            <Plus aria-hidden="true" className="size-4" />
            Nuevo plan
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Aún no hay planes"
          action={
            <Link href="/planes/nuevo" className={buttonPrimary}>
              Crear plan
            </Link>
          }
        >
          Crea el primero: elige a quién va, sus días y los ejercicios de cada sesión. Los jugadores lo ven en
          &quot;Mi plan&quot; con sus kilos.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.status} aria-label={`${PLAN_STATUS_LABEL[g.status]}s`}>
              <CardHeader title={`${PLAN_STATUS_LABEL[g.status]}s`} count={g.items.length} />
              {g.items.length === 0 ? (
                <EmptyState title={EMPTY_TITLE[g.status]}>{EMPTY_TEXT[g.status]}</EmptyState>
              ) : (
                <ul className="flex flex-col gap-2">
                  {g.items.map((p) => {
                    const days = [...(daysByPlan.get(p.id) ?? [])].sort().map((d) => WEEKDAY_LABELS[d - 1]);
                    const prog = progressByPlan.get(p.id);
                    const pct = prog && prog.due > 0 ? Math.round((Math.min(prog.done, prog.due) / prog.due) * 100) : null;
                    return (
                      <li key={p.id}>
                        <Link
                          href={`/planes/${p.id}`}
                          className={`flex min-h-14 items-center gap-4 px-4 py-4 transition hover:bg-mist focus-visible:outline-2 focus-visible:outline-brand-strong lg:px-5 ${cardClass}`}
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-ink">{p.name}</span>
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[p.status]}`}>
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
                                <span className="block font-display text-lg font-bold text-ink tabular-nums">{pct} %</span>
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
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
