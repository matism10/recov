// Datos del editor de planes (/planes/nuevo y /planes/[id]): plantel con su
// disponibilidad, lesión y fase, posiciones del deporte, grupo Sevens, tests en kilos
// con el último máximo de cada jugador, nombres de ejercicios ya usados y el plan.
// Solo head coach y preparador físico (la página lo valida; la base exige lo mismo al guardar).
import { redirect } from "next/navigation";
import { getProfile, getSessionUser, getSupabase } from "@/lib/session";
import type { UserRole } from "@/lib/roles";
import { todayInChile } from "@/lib/injuries";
import { canPlanGym, type DraftPlan, type IntensityType, type PlanStatus, type TargetKind } from "@/lib/gym";

export type EditorPlayer = {
  id: string;
  name: string;
  position: string | null;
  availability: string;
  sevens: boolean;
  injury: string | null; // "Isquiotibial derecho · Rehabilitación"
};
export type EditorTest = { id: string; name: string };
export type EditorData = {
  plan: DraftPlan;
  status: PlanStatus | null;
  players: EditorPlayer[];
  positions: { id: string; name: string }[];
  tests: EditorTest[];
  // Último máximo (no anulado) por test y jugador: maxes[testId][playerId].
  maxes: Record<string, Record<string, number>>;
  exerciseNames: string[];
  hasSevens: boolean;
  rugby: boolean;
};

const KG_UNITS = ["kg", "kgs", "kilos"];
const OPEN = ["en_evaluacion", "activa"];

export async function loadEditorData(planId: string | null): Promise<EditorData | null> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const supabase = await getSupabase();
  const me = await getProfile(user.id);
  if (me?.status === "pendiente") redirect("/pendiente");
  const roles = (me?.roles ?? []) as UserRole[];
  if (!me || me.status !== "confirmado" || !me.club_id || !canPlanGym(roles)) redirect("/dashboard");
  const clubId = me.club_id;
  const sport = me.club?.sport ?? "";

  const [players, phases, injuries, positions, sevens, tests, names, plan] = await Promise.all([
    supabase
      .from("players")
      .select("id, full_name, position, availability, user_id")
      .eq("club_id", clubId)
      .eq("active", true)
      .eq("status", "confirmado")
      .order("full_name")
      .then(({ data }) => data ?? []),
    supabase.rpc("squad_current_phases").then(({ data }) => (data ?? []) as { player_id: string; phase_name: string }[]),
    supabase
      .from("injuries")
      .select("player_id, type, started_on")
      .eq("club_id", clubId)
      .in("status", OPEN)
      .order("started_on", { ascending: false })
      .then(({ data }) => data ?? []),
    supabase
      .from("positions")
      .select("id, name, sort")
      .eq("sport", sport)
      .eq("format", "15")
      .order("sort")
      .then(({ data }) => (data ?? []) as { id: string; name: string }[]),
    me.club?.has_sevens
      ? supabase
          .from("sevens_group")
          .select("member_id")
          .eq("club_id", clubId)
          .is("archived_at", null)
          .then(({ data }) => new Set((data ?? []).map((g) => g.member_id as string)))
      : new Set<string>(),
    supabase
      .from("test_definitions")
      .select("id, name, unit")
      .eq("club_id", clubId)
      .is("archived_at", null)
      .order("name")
      .then(({ data }) =>
        (data ?? []).filter((t) => KG_UNITS.includes(String(t.unit).trim().toLowerCase())).map((t) => ({ id: t.id as string, name: t.name as string })),
      ),
    supabase
      .from("gym_plan_exercises")
      .select("name")
      .eq("club_id", clubId)
      .limit(1000)
      .then(({ data }) => [...new Set((data ?? []).map((e) => (e.name as string).trim()))].sort((a, b) => a.localeCompare(b, "es"))),
    planId ? loadPlan(supabase, clubId, planId) : null,
  ]);

  if (planId && !plan) return null;

  // Máximos: el resultado más nuevo no anulado de cada jugador en cada test en kilos.
  const maxes: Record<string, Record<string, number>> = {};
  if (tests.length > 0) {
    const { data } = await supabase
      .from("test_results")
      .select("test_id, player_id, value, measured_on")
      .eq("club_id", clubId)
      .in("test_id", tests.map((t) => t.id))
      .is("voided_at", null)
      .order("measured_on", { ascending: false });
    for (const r of data ?? []) {
      const byPlayer = (maxes[r.test_id as string] ??= {});
      if (byPlayer[r.player_id as string] === undefined) byPlayer[r.player_id as string] = Number(r.value);
    }
  }

  const phaseBy = new Map(phases.map((p) => [p.player_id, p.phase_name]));
  const injuryBy = new Map<string, string>();
  for (const i of injuries) if (!injuryBy.has(i.player_id as string)) injuryBy.set(i.player_id as string, i.type as string);

  // Un plan nuevo parte como planificación diaria: un entrenamiento para hoy.
  const today = todayInChile();
  return {
    plan: plan?.plan ?? {
      name: "",
      starts_on: today,
      ends_on: today,
      sessions: [],
      targets: [],
      exclusions: [],
    },
    status: plan?.status ?? null,
    players: players.map((p) => {
      const injury = injuryBy.get(p.id as string);
      const phase = phaseBy.get(p.id as string);
      return {
        id: p.id as string,
        name: p.full_name as string,
        position: (p.position as string | null) ?? null,
        availability: p.availability as string,
        sevens: !!p.user_id && sevens.has(p.user_id as string),
        injury: injury || phase ? [injury, phase].filter(Boolean).join(" · ") : null,
      };
    }),
    positions,
    tests,
    maxes,
    exerciseNames: names,
    hasSevens: !!me.club?.has_sevens,
    rugby: sport === "rugby",
  };
}

type Supabase = Awaited<ReturnType<typeof getSupabase>>;

async function loadPlan(supabase: Supabase, clubId: string, planId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(planId)) return null;
  const [{ data: plan }, { data: sessions }, { data: targets }, { data: exclusions }] = await Promise.all([
    supabase.from("gym_plans").select("id, name, starts_on, ends_on, status").eq("id", planId).eq("club_id", clubId).maybeSingle(),
    supabase
      .from("gym_plan_sessions")
      .select(
        "id, label, weekday, est_minutes, sort, gym_plan_exercises(id, sort, name, sets, reps, intensity_type, pct, test_id, rpe, kg, rest_seconds, note, archived_at)",
      )
      .eq("plan_id", planId)
      .is("archived_at", null)
      .order("sort"),
    supabase.from("gym_plan_targets").select("kind, position_id, player_id").eq("plan_id", planId).is("archived_at", null),
    supabase.from("gym_plan_exclusions").select("player_id").eq("plan_id", planId).is("archived_at", null),
  ]);
  if (!plan) return null;
  type ExRow = {
    id: string;
    sort: number;
    name: string;
    sets: number;
    reps: string;
    intensity_type: IntensityType;
    pct: number | null;
    test_id: string | null;
    rpe: number | null;
    kg: number | null;
    rest_seconds: number | null;
    note: string | null;
    archived_at: string | null;
  };
  const draft: DraftPlan = {
    id: plan.id as string,
    name: plan.name as string,
    starts_on: plan.starts_on as string,
    ends_on: plan.ends_on as string,
    sessions: (sessions ?? []).map((s) => ({
      key: s.id as string,
      id: s.id as string,
      label: s.label as string,
      weekday: s.weekday as number,
      est_minutes: s.est_minutes as number,
      exercises: ((s.gym_plan_exercises ?? []) as ExRow[])
        .filter((e) => !e.archived_at)
        .sort((a, b) => a.sort - b.sort)
        .map((e) => ({
          key: e.id,
          id: e.id,
          name: e.name,
          sets: e.sets,
          reps: e.reps,
          intensity_type: e.intensity_type,
          pct: e.pct,
          test_id: e.test_id,
          rpe: e.rpe,
          kg: e.kg === null ? null : Number(e.kg),
          rest_seconds: e.rest_seconds,
          note: e.note ?? "",
        })),
    })),
    targets: (targets ?? []).map((t) => ({
      kind: t.kind as TargetKind,
      position_id: t.position_id as string | null,
      player_id: t.player_id as string | null,
    })),
    exclusions: (exclusions ?? []).map((x) => x.player_id as string),
  };
  return { plan: draft, status: plan.status as PlanStatus };
}
