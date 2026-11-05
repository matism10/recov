"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Link2, Minus, Plus, Trash2, TriangleAlert, Unlink2, X } from "lucide-react";
import {
  GYM_LIMITS,
  INTENSITY_OPTIONS,
  RUGBY_BACKS,
  RUGBY_FORWARDS,
  blockRuns,
  durationLabel,
  exerciseCodes,
  exerciseDose,
  intensityLabel,
  parseDuration,
  parseRest,
  playerIntensity,
  restLabel,
  roundKg,
  sameSuperset,
  supersetsFromLinks,
  type DraftExercise,
  type DraftPlan,
  type DraftSession,
  type IntensityType,
  type PlanTarget,
} from "@/lib/gym";
import { WEEKDAYS, isoWeekday } from "@/lib/srpe";
import { addDays, formatDate } from "@/lib/injuries";
import { ErrorMessage, SuccessMessage, buttonPrimary, buttonSecondary, fieldClass, labelClass, textButton } from "@/app/ui";
import type { EditorData, EditorPlayer } from "./editor-data";
import { archivePlan, savePlan } from "./actions";

const DAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"];

// Tipo de planificación. Solo cambia cómo se arma el plan en el editor: en la base todo
// plan es una vigencia (desde–hasta) con sesiones por día de la semana.
//   Diaria: un entrenamiento, un día (desde = hasta, una sesión con el nombre del plan).
//   Semanal: 7 días, varias sesiones, cada una en su día.
//   Mensual: varias semanas; las sesiones de la semana se repiten cada semana.
type Mode = "diaria" | "semanal" | "mensual";
const MODES: { id: Mode; label: string; hint: string; placeholder: string }[] = [
  { id: "diaria", label: "Diaria", hint: "Un entrenamiento para un día.", placeholder: "Nombre del entrenamiento (ej.: Fuerza tren inferior)" },
  {
    id: "semanal",
    label: "Semanal",
    hint: "Varias sesiones en una semana, cada una en su día.",
    placeholder: "Nombre del plan (ej.: Fuerza pretemporada · Semana 3)",
  },
  {
    id: "mensual",
    label: "Mensual",
    hint: "Armas una semana tipo y se repite cada semana hasta la fecha de término.",
    placeholder: "Nombre del plan (ej.: Pretemporada · Noviembre)",
  },
];
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
function inferMode(p: DraftPlan): Mode {
  if (!p.id) return "diaria";
  if (p.starts_on === p.ends_on && p.sessions.length <= 1) return "diaria";
  return daysBetween(p.starts_on, p.ends_on) <= 6 ? "semanal" : "mensual";
}
const LETTERS = "ABCDEFGHIJKLMN";
let keySeq = 0;
const newKey = () => `nuevo-${++keySeq}`;

function newExercise(): DraftExercise {
  return {
    key: newKey(),
    name: "",
    sets: 3,
    reps: "8",
    intensity_type: "bw",
    pct: null,
    test_id: null,
    rpe: null,
    kg: null,
    seconds: null,
    rest_seconds: 90,
    note: "",
    block: null,
    superset: null,
  };
}

function newSession(sessions: DraftSession[]): DraftSession {
  const used = new Set(sessions.map((s) => s.weekday));
  const weekday = [1, 3, 5, 2, 4, 6, 7].find((d) => !used.has(d)) ?? 1;
  return {
    key: newKey(),
    label: `Sesión ${LETTERS[sessions.length] ?? sessions.length + 1}`,
    weekday,
    est_minutes: 60,
    exercises: [newExercise()],
  };
}

const chip = (on: boolean) =>
  `inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition disabled:opacity-60 ${
    on ? "border-brand bg-brand-soft text-brand-text" : "border-line bg-white text-ink hover:bg-mist"
  }`;
const smallField = "min-h-10 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none focus:border-brand-strong focus:ring-2 focus:ring-brand-soft";

// Editor del plan (head coach y preparador físico). En escritorio: datos arriba, sesiones
// en pestañas con su tabla de ejercicios y, a la derecha, la vista previa del jugador y
// los lesionados. En el celular: tarjetas por ejercicio y una hoja para editar cada una.
export function PlanEditor({ data, saved }: { data: EditorData; saved: string | null }) {
  const router = useRouter();
  const [plan, setPlan] = useState<DraftPlan>(() =>
    data.plan.sessions.length > 0
      ? data.plan
      : { ...data.plan, sessions: [{ ...newSession([]), weekday: isoWeekday(data.plan.starts_on) }] },
  );
  const [mode, setMode] = useState<Mode>(() => inferMode(data.plan));
  const [active, setActive] = useState(0);
  const [picker, setPicker] = useState<"none" | "positions" | "players">("none");
  const [showDiscard, setShowDiscard] = useState(false);
  const [sheet, setSheet] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [playerQuery, setPlayerQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(saved);
  const [pending, startTransition] = useTransition();

  const readOnly = data.status === "archivado";
  const session = plan.sessions[Math.min(active, plan.sessions.length - 1)];

  // ------------------------------------------------------------------
  // Destinatarios (misma regla que private.gym_plan_players)
  // ------------------------------------------------------------------
  const posName = useMemo(() => new Map(data.positions.map((p) => [p.id, p.name])), [data.positions]);
  const allTarget = plan.targets.some((t) => t.kind === "plantel");
  const sevensTarget = plan.targets.some((t) => t.kind === "sevens");
  const posTargets = new Set(plan.targets.filter((t) => t.kind === "posicion").map((t) => t.position_id!));
  const playerTargets = new Set(plan.targets.filter((t) => t.kind === "jugador").map((t) => t.player_id!));
  const posNames = new Set([...posTargets].map((id) => posName.get(id)));
  const isTargeted = (p: EditorPlayer) =>
    allTarget || playerTargets.has(p.id) || (!!p.position && posNames.has(p.position)) || (sevensTarget && p.sevens);
  const targeted = data.players.filter(isTargeted);
  const excluded = new Set(plan.exclusions);
  const recipients = targeted.filter((p) => !excluded.has(p.id));
  const injured = targeted.filter((p) => p.availability !== "disponible");
  const injuredOut = injured.filter((p) => excluded.has(p.id)).length;

  const groupIds = (names: string[]) => data.positions.filter((p) => names.includes(p.name)).map((p) => p.id);
  const forwards = groupIds(RUGBY_FORWARDS);
  const backs = groupIds(RUGBY_BACKS);
  const groupOn = (ids: string[]) => ids.length > 0 && ids.every((id) => posTargets.has(id));
  const countIn = (names: string[]) => data.players.filter((p) => p.position && names.includes(p.position)).length;

  const setTargets = (fn: (t: PlanTarget[]) => PlanTarget[]) =>
    setPlan((p) => ({ ...p, targets: fn(p.targets.filter((t) => t.kind !== "plantel")) }));
  const toggleAll = () =>
    setPlan((p) => ({ ...p, targets: p.targets.some((t) => t.kind === "plantel") ? [] : [{ kind: "plantel" }] }));
  const togglePositions = (ids: string[], on: boolean) =>
    setTargets((t) => {
      const rest = t.filter((x) => !(x.kind === "posicion" && ids.includes(x.position_id!)));
      return on ? [...rest, ...ids.map((id) => ({ kind: "posicion" as const, position_id: id }))] : rest;
    });
  const togglePlayer = (id: string) =>
    setTargets((t) =>
      t.some((x) => x.kind === "jugador" && x.player_id === id)
        ? t.filter((x) => !(x.kind === "jugador" && x.player_id === id))
        : [...t, { kind: "jugador", player_id: id }],
    );
  const toggleSevens = () =>
    setTargets((t) => (t.some((x) => x.kind === "sevens") ? t.filter((x) => x.kind !== "sevens") : [...t, { kind: "sevens" }]));
  const toggleExcluded = (id: string) =>
    setPlan((p) => ({
      ...p,
      exclusions: p.exclusions.includes(id) ? p.exclusions.filter((x) => x !== id) : [...p.exclusions, id],
    }));
  const discardAll = () => {
    const ids = injured.map((p) => p.id);
    const all = ids.every((id) => excluded.has(id));
    setPlan((p) => ({
      ...p,
      exclusions: all ? p.exclusions.filter((x) => !ids.includes(x)) : [...new Set([...p.exclusions, ...ids])],
    }));
  };

  // ------------------------------------------------------------------
  // Tipo de planificación y fechas
  // ------------------------------------------------------------------
  const changeMode = (next: Mode) => {
    if (next === mode) return;
    if (next === "diaria") {
      const first = plan.sessions[Math.min(active, plan.sessions.length - 1)];
      if (
        plan.sessions.length > 1 &&
        !window.confirm(`La planificación diaria tiene un solo entrenamiento. Se queda «${first.label}» y se quitan las otras sesiones. ¿Seguir?`)
      )
        return;
      setPlan((p) => ({ ...p, ends_on: p.starts_on, sessions: [{ ...first, weekday: isoWeekday(p.starts_on) }] }));
      setActive(0);
    } else {
      setPlan((p) => ({ ...p, ends_on: addDays(p.starts_on, next === "semanal" ? 6 : 27) }));
    }
    setMode(next);
  };
  // Diaria: la fecha fija el día de la única sesión.
  const setDay = (date: string) =>
    setPlan((p) => ({
      ...p,
      starts_on: date,
      ends_on: date,
      sessions: p.sessions.map((s) => ({ ...s, weekday: date ? isoWeekday(date) : s.weekday })),
    }));
  // Semanal: el término es siempre 6 días después del inicio.
  const setWeekStart = (date: string) => setPlan((p) => ({ ...p, starts_on: date, ends_on: date ? addDays(date, 6) : "" }));
  // Lo que se guarda: en la diaria, una sesión con el nombre del plan.
  const toSave = (): DraftPlan =>
    mode === "diaria"
      ? {
          ...plan,
          ends_on: plan.starts_on,
          sessions: plan.sessions.slice(0, 1).map((s) => ({
            ...s,
            label: plan.name.trim().slice(0, GYM_LIMITS.labelMax),
            weekday: plan.starts_on ? isoWeekday(plan.starts_on) : s.weekday,
          })),
        }
      : plan;

  // ------------------------------------------------------------------
  // Sesiones y ejercicios
  // ------------------------------------------------------------------
  const updateSession = (key: string, patch: Partial<DraftSession>) =>
    setPlan((p) => ({ ...p, sessions: p.sessions.map((s) => (s.key === key ? { ...s, ...patch } : s)) }));
  const updateExercise = (sKey: string, eKey: string, patch: Partial<DraftExercise>) =>
    setPlan((p) => ({
      ...p,
      sessions: p.sessions.map((s) =>
        s.key === sKey ? { ...s, exercises: s.exercises.map((e) => (e.key === eKey ? { ...e, ...patch } : e)) } : s,
      ),
    }));
  const updateList = (sKey: string, fn: (list: DraftExercise[]) => DraftExercise[]) =>
    setPlan((p) => ({ ...p, sessions: p.sessions.map((s) => (s.key === sKey ? { ...s, exercises: fn(s.exercises) } : s)) }));
  // Agrega un ejercicio al final (en el último bloque) o al final del bloque que empieza en
  // `start` y tiene `len` ejercicios.
  const addExercise = (sKey: string, at?: { start: number; len: number }) => {
    const ex = newExercise();
    updateList(sKey, (list) => {
      const pos = at ? at.start + at.len : list.length;
      const block = (at ? list[at.start]?.block : list.at(-1)?.block) ?? null;
      return [...list.slice(0, pos), { ...ex, block }, ...list.slice(pos)];
    });
    return ex.key;
  };
  // Bloque nuevo con un ejercicio. Si aún no hay bloques, los ejercicios que ya están
  // pasan a "Bloque 1".
  const addBlock = (sKey: string) => {
    const ex = newExercise();
    updateList(sKey, (list) => {
      const named = list.some((e) => e.block !== null);
      const base = named || list.length === 0 ? list : list.map((e) => ({ ...e, block: "Bloque 1" }));
      const n = blockRuns(base).filter((r) => r.block !== null).length + 1;
      return [...base, { ...ex, block: `Bloque ${n}` }];
    });
    return ex.key;
  };
  const renameBlock = (sKey: string, start: number, len: number, name: string) =>
    updateList(sKey, (list) => list.map((e, i) => (i >= start && i < start + len ? { ...e, block: name } : e)));
  const removeBlock = (sKey: string, start: number, len: number) => {
    const named = session?.exercises.slice(start, start + len).some((e) => e.name.trim()) ?? false;
    if (named && !window.confirm("Se quita el bloque con sus ejercicios. ¿Seguir?")) return;
    updateList(sKey, (list) => list.filter((_, i) => i < start || i >= start + len));
  };
  // Une (o separa) el ejercicio i con el siguiente en una superserie.
  const toggleSuperset = (sKey: string, i: number) =>
    updateList(sKey, (list) => {
      const linked = list.map((e, j) => sameSuperset(e, list[j + 1]));
      linked[i] = !linked[i];
      return supersetsFromLinks(list, linked);
    });
  const removeExercise = (sKey: string, eKey: string) =>
    setPlan((p) => ({
      ...p,
      sessions: p.sessions.map((s) => (s.key === sKey ? { ...s, exercises: s.exercises.filter((e) => e.key !== eKey) } : s)),
    }));
  const addSession = () => {
    setPlan((p) => ({ ...p, sessions: [...p.sessions, newSession(p.sessions)] }));
    setActive(plan.sessions.length);
  };
  const removeSession = (key: string) => {
    setPlan((p) => ({ ...p, sessions: p.sessions.filter((s) => s.key !== key) }));
    setActive(0);
  };
  // Cambiar el tipo de intensidad deja valores por defecto razonables.
  const setIntensity = (sKey: string, e: DraftExercise, type: IntensityType) =>
    updateExercise(sKey, e.key, {
      intensity_type: type,
      pct: type === "pct" ? (e.pct ?? 80) : null,
      test_id: type === "pct" ? (e.test_id ?? data.tests[0]?.id ?? null) : null,
      rpe: type === "rpe" ? (e.rpe ?? 7) : null,
      kg: type === "kg" ? (e.kg ?? 20) : null,
      seconds: type === "tiempo" ? (e.seconds ?? 60) : null,
    });

  // ------------------------------------------------------------------
  // Vista previa y avisos
  // ------------------------------------------------------------------
  const testName = useMemo(() => new Map(data.tests.map((t) => [t.id, t.name])), [data.tests]);
  const allExercises = plan.sessions.flatMap((s) => s.exercises);
  const pctTests = [...new Set(allExercises.filter((e) => e.intensity_type === "pct" && e.test_id).map((e) => e.test_id!))];
  const hasMax = (playerId: string) => pctTests.some((t) => data.maxes[t]?.[playerId] !== undefined);
  const previewPlayer =
    recipients.find((p) => p.id === previewId) ?? recipients.find((p) => hasMax(p.id)) ?? recipients[0] ?? null;
  const preview = (e: DraftExercise) => {
    const max = e.test_id && previewPlayer ? (data.maxes[e.test_id]?.[previewPlayer.id] ?? null) : null;
    return playerIntensity({
      ...e,
      max,
      calc_kg: e.intensity_type === "pct" && max !== null && e.pct !== null ? roundKg(max, e.pct) : null,
    });
  };
  const missing = pctTests
    .map((t) => ({
      test: testName.get(t) ?? "el test",
      pct: allExercises.find((e) => e.test_id === t)?.pct ?? 80,
      n: recipients.filter((p) => data.maxes[t]?.[p.id] === undefined).length,
    }))
    .filter((m) => m.n > 0);

  // ------------------------------------------------------------------
  // Guardar
  // ------------------------------------------------------------------
  const validate = (plan: DraftPlan, publish: boolean) => {
    const name = plan.name.trim();
    if (name.length < GYM_LIMITS.nameMin || name.length > GYM_LIMITS.nameMax)
      return `Ponle un nombre al ${mode === "diaria" ? "entrenamiento" : "plan"} (2 a 80 caracteres).`;
    if (!plan.starts_on) return mode === "diaria" ? "Elige la fecha del entrenamiento." : "Elige desde cuándo va el plan.";
    if (!plan.ends_on || plan.ends_on < plan.starts_on) return "Revisa las fechas: el término va después del inicio.";
    for (const s of plan.sessions) {
      if (!s.label.trim()) return "Cada sesión necesita un nombre.";
      for (const e of s.exercises) {
        if (e.name.trim().length < 2) return `Escribe el nombre de cada ejercicio (${s.label}).`;
        if (e.intensity_type !== "tiempo" && !e.reps.trim()) return `Escribe las repeticiones de ${e.name.trim()}.`;
        if (e.intensity_type === "tiempo" && !e.seconds) return `Escribe el tiempo de ${e.name.trim()}.`;
        if (e.block !== null && !e.block.trim()) return `Ponle nombre a cada bloque (${s.label}).`;
        if (e.intensity_type === "pct" && !e.test_id) return `Elige el test de ${e.name.trim()}.`;
      }
    }
    if (publish && plan.targets.length === 0) return "Elige a quién va el plan antes de publicar.";
    if (publish && allExercises.length === 0) return "Agrega al menos un ejercicio antes de publicar.";
    return null;
  };

  const save = (publish: boolean) => {
    const plan = toSave();
    const invalid = validate(plan, publish);
    setMessage(null);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await savePlan(plan, publish);
      if (res.error) setError(res.error);
      const ok = publish ? "publicado" : data.status === "publicado" ? "guardado" : "borrador";
      if (res.id && !res.error) {
        if (!plan.id) router.replace(`/planes/${res.id}?ok=${ok}`);
        else {
          setMessage(okText(ok));
          router.refresh();
        }
      } else if (res.id && !plan.id) router.replace(`/planes/${res.id}`);
    });
  };

  const archive = () =>
    startTransition(async () => {
      if (!plan.id) return;
      const res = await archivePlan(plan.id);
      if (res.error) setError(res.error);
      else router.push("/planes");
    });

  const sheetExercise = session?.exercises.find((e) => e.key === sheet) ?? null;
  const runs = session ? blockRuns(session.exercises) : [];
  const codes = session ? exerciseCodes(session.exercises) : [];
  const sheetIndex = sheetExercise && session ? session.exercises.indexOf(sheetExercise) : -1;
  const daysUsed = new Set(plan.sessions.map((s) => s.weekday));
  const players = data.players.filter((p) => p.name.toLowerCase().includes(playerQuery.trim().toLowerCase()));

  const actions = readOnly ? null : (
    <>
      {data.status === "publicado" ? (
        <button type="button" onClick={() => save(false)} disabled={pending} className={buttonPrimary}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      ) : (
        <>
          <button type="button" onClick={() => save(false)} disabled={pending} className={buttonSecondary}>
            Guardar borrador
          </button>
          <button type="button" onClick={() => save(true)} disabled={pending} className={buttonPrimary}>
            {pending ? "Guardando…" : "Publicar plan"}
          </button>
        </>
      )}
    </>
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 lg:max-w-7xl lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">
            <Link href="/planes" className="underline">
              Planes de gimnasio
            </Link>{" "}
            / {plan.id ? (readOnly ? "Plan archivado" : data.status === "publicado" ? "Plan publicado" : "Borrador") : "Nuevo plan"}
          </p>
          <label htmlFor="plan-name" className="sr-only">
            Nombre del plan
          </label>
          <input
            id="plan-name"
            value={plan.name}
            onChange={(e) => setPlan((p) => ({ ...p, name: e.target.value }))}
            maxLength={GYM_LIMITS.nameMax}
            placeholder={MODES.find((m) => m.id === mode)!.placeholder}
            disabled={readOnly}
            className="mt-1 w-full rounded-lg border border-transparent bg-transparent px-1 font-display text-2xl font-bold text-ink outline-none placeholder:text-muted/70 hover:border-line focus:border-brand-strong lg:text-[30px]"
          />
        </div>
        <div className="hidden gap-2 lg:flex">{actions}</div>
      </header>

      {readOnly && (
        <p className="mb-4 rounded-xl border border-line bg-mist px-4 py-3 text-sm text-muted">
          Este plan está archivado: ya no aparece a los jugadores y no se puede editar.
        </p>
      )}
      <div className="mb-4 space-y-2" aria-live="polite">
        {error && <ErrorMessage>{error}</ErrorMessage>}
        {message && <SuccessMessage>{message}</SuccessMessage>}
      </div>

      <fieldset disabled={readOnly || pending} className="min-w-0">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="min-w-0 space-y-5">
            {/* Tipo de planificación */}
            <section className="rounded-xl border border-line bg-white p-4 lg:p-5">
              <p id="plan-mode" className={labelClass}>
                ¿Qué vas a planificar?
              </p>
              <div role="radiogroup" aria-labelledby="plan-mode" className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-mist p-1 sm:max-w-md">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={m.id === mode}
                    onClick={() => changeMode(m.id)}
                    className={`min-h-11 rounded-lg px-2 text-sm font-semibold transition ${
                      m.id === mode ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-sm text-muted">{MODES.find((m) => m.id === mode)!.hint}</p>
            </section>

            {/* Asignar a, fechas y días */}
            <section className="space-y-4 rounded-xl border border-line bg-white p-4 lg:p-5">
              <div>
                <p className={labelClass}>Asignar a</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" aria-pressed={allTarget} onClick={toggleAll} className={chip(allTarget)}>
                    Todo el plantel
                  </button>
                  {data.rugby && forwards.length > 0 && (
                    <button
                      type="button"
                      aria-pressed={groupOn(forwards)}
                      onClick={() => togglePositions(forwards, !groupOn(forwards))}
                      className={chip(groupOn(forwards))}
                    >
                      Delanteros ({countIn(RUGBY_FORWARDS)})
                    </button>
                  )}
                  {data.rugby && backs.length > 0 && (
                    <button
                      type="button"
                      aria-pressed={groupOn(backs)}
                      onClick={() => togglePositions(backs, !groupOn(backs))}
                      className={chip(groupOn(backs))}
                    >
                      Backs ({countIn(RUGBY_BACKS)})
                    </button>
                  )}
                  {data.positions.length > 0 && (
                    <button
                      type="button"
                      aria-expanded={picker === "positions"}
                      onClick={() => setPicker(picker === "positions" ? "none" : "positions")}
                      className={chip(posTargets.size > 0)}
                    >
                      Posiciones…{posTargets.size > 0 && ` (${posTargets.size})`}
                    </button>
                  )}
                  <button
                    type="button"
                    aria-expanded={picker === "players"}
                    onClick={() => setPicker(picker === "players" ? "none" : "players")}
                    className={chip(playerTargets.size > 0)}
                  >
                    Jugadores…{playerTargets.size > 0 && ` (${playerTargets.size})`}
                  </button>
                  {data.hasSevens && (
                    <button type="button" aria-pressed={sevensTarget} onClick={toggleSevens} className={chip(sevensTarget)}>
                      Sevens
                    </button>
                  )}
                </div>
                {picker === "positions" && (
                  <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-line bg-mist p-2 sm:grid-cols-3">
                    {data.positions.map((p) => (
                      <CheckRow
                        key={p.id}
                        checked={posTargets.has(p.id)}
                        onToggle={() => togglePositions([p.id], !posTargets.has(p.id))}
                        label={p.name}
                      />
                    ))}
                  </div>
                )}
                {picker === "players" && (
                  <div className="mt-3 space-y-2 rounded-xl border border-line bg-mist p-2">
                    <input
                      value={playerQuery}
                      onChange={(e) => setPlayerQuery(e.target.value)}
                      placeholder="Buscar jugador"
                      aria-label="Buscar jugador"
                      className={smallField}
                    />
                    <div className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
                      {players.map((p) => (
                        <CheckRow
                          key={p.id}
                          checked={playerTargets.has(p.id)}
                          onToggle={() => togglePlayer(p.id)}
                          label={p.name}
                          detail={p.position ?? undefined}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <p className="mt-2 text-sm text-muted">
                  {targeted.length === 0
                    ? "Aún no hay destinatarios."
                    : `Reciben el plan: ${recipients.length} de ${targeted.length}`}
                </p>
              </div>

              {mode === "diaria" ? (
                <label className="block">
                  <span className={labelClass}>Fecha</span>
                  <input
                    type="date"
                    value={plan.starts_on}
                    onChange={(e) => setDay(e.target.value)}
                    className={`${fieldClass} mt-1 w-auto`}
                  />
                  {plan.starts_on && (
                    <span className="mt-1 block text-sm text-muted">{WEEKDAYS[isoWeekday(plan.starts_on) - 1].label}</span>
                  )}
                </label>
              ) : (
                <div className="flex flex-wrap gap-x-10 gap-y-4">
                  <div className="min-w-0">
                    {mode === "semanal" ? (
                      <label className="block">
                        <span className={labelClass}>Empieza el</span>
                        <input
                          type="date"
                          value={plan.starts_on}
                          onChange={(e) => setWeekStart(e.target.value)}
                          className={`${fieldClass} mt-1 w-auto`}
                        />
                      </label>
                    ) : (
                      <>
                        <p className={labelClass}>Desde y hasta</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <input
                            type="date"
                            aria-label="Desde"
                            value={plan.starts_on}
                            onChange={(e) => setPlan((p) => ({ ...p, starts_on: e.target.value }))}
                            className={`${fieldClass} w-auto`}
                          />
                          <span aria-hidden="true" className="text-muted">
                            →
                          </span>
                          <input
                            type="date"
                            aria-label="Hasta"
                            value={plan.ends_on}
                            min={plan.starts_on}
                            onChange={(e) => setPlan((p) => ({ ...p, ends_on: e.target.value }))}
                            className={`${fieldClass} w-auto`}
                          />
                        </div>
                      </>
                    )}
                    {plan.starts_on && plan.ends_on && plan.ends_on >= plan.starts_on && (
                      <p className="mt-1 text-sm text-muted">
                        {mode === "semanal"
                          ? `Hasta el ${formatDate(plan.ends_on)}.`
                          : `${Math.ceil((daysBetween(plan.starts_on, plan.ends_on) + 1) / 7)} semanas: las sesiones se repiten cada semana.`}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className={labelClass}>Días con sesión</p>
                    <ul className="mt-1 flex gap-1" aria-label="Días con sesión">
                      {DAY_LETTERS.map((l, i) => {
                        const on = daysUsed.has(i + 1);
                        return (
                          <li
                            key={l}
                            className={`flex size-10 items-center justify-center rounded-lg text-sm font-semibold ${
                              on ? "bg-brand text-ink" : "border border-line bg-white text-muted"
                            }`}
                          >
                            <span aria-hidden="true">{l}</span>
                            <span className="sr-only">
                              {WEEKDAYS[i].label}: {on ? "con sesión" : "sin sesión"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-1 text-xs text-muted">Se marcan al agregar sesiones abajo.</p>
                  </div>
                </div>
              )}
            </section>

            {/* Sesiones */}
            <section className="rounded-xl border border-line bg-white">
              {mode === "diaria" ? (
                <h2 className="border-b border-line px-4 py-3 font-semibold text-ink lg:px-5">Entrenamiento</h2>
              ) : (
              <div role="tablist" aria-label="Sesiones" className="flex gap-1 overflow-x-auto border-b border-line p-2">
                {plan.sessions.map((s, i) => {
                  const on = s.key === session?.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setActive(i)}
                      className={`min-h-10 shrink-0 rounded-lg px-3 text-sm font-medium whitespace-nowrap ${
                        on ? "bg-ink text-white" : "bg-mist text-ink hover:bg-line/60"
                      }`}
                    >
                      {s.label || "Sesión"} · <span className="lg:hidden">{WEEKDAYS[s.weekday - 1].short}</span>
                      <span className="hidden lg:inline">{WEEKDAYS[s.weekday - 1].label}</span>
                    </button>
                  );
                })}
                {plan.sessions.length < GYM_LIMITS.sessionsMax && (
                  <button
                    type="button"
                    onClick={addSession}
                    className="min-h-10 shrink-0 rounded-lg border border-dashed border-muted/60 px-3 text-sm font-medium text-brand-text"
                  >
                    + Sesión
                  </button>
                )}
              </div>
              )}

              {session ? (
                <div className="space-y-4 p-4 lg:p-5">
                  {mode === "diaria" ? (
                    <label className="block w-44">
                      <span className="text-xs font-medium text-muted">Duración estimada (min)</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={GYM_LIMITS.minutesMin}
                        max={GYM_LIMITS.minutesMax}
                        value={session.est_minutes}
                        onChange={(e) => updateSession(session.key, { est_minutes: Number(e.target.value) || 0 })}
                        className={smallField}
                      />
                    </label>
                  ) : (
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-[minmax(0,1fr)_10rem_9rem_auto] xl:items-end">
                    <label className="col-span-2 block xl:col-span-1">
                      <span className="text-xs font-medium text-muted">Nombre</span>
                      <input
                        value={session.label}
                        maxLength={GYM_LIMITS.labelMax}
                        onChange={(e) => updateSession(session.key, { label: e.target.value })}
                        className={smallField}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-muted">Día</span>
                      <select
                        value={session.weekday}
                        onChange={(e) => updateSession(session.key, { weekday: Number(e.target.value) })}
                        className={smallField}
                      >
                        {WEEKDAYS.map((d) => (
                          <option key={d.iso} value={d.iso}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-muted">Duración estimada (min)</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={GYM_LIMITS.minutesMin}
                        max={GYM_LIMITS.minutesMax}
                        value={session.est_minutes}
                        onChange={(e) => updateSession(session.key, { est_minutes: Number(e.target.value) || 0 })}
                        className={smallField}
                      />
                    </label>
                    {plan.sessions.length > 1 && (
                      <button type="button" onClick={() => removeSession(session.key)} className={`${textButton} justify-self-start`}>
                        Quitar sesión
                      </button>
                    )}
                  </div>
                  )}

                  <datalist id="exercise-names">
                    {data.exerciseNames.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>

                  {/* Escritorio: tabla editable, por bloques */}
                  <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full min-w-[56rem] text-left text-sm">
                      <thead className="text-xs text-muted">
                        <tr>
                          <th className="w-10 py-2 font-medium">#</th>
                          <th className="py-2 font-medium">Ejercicio</th>
                          <th className="w-20 py-2 font-medium">Series</th>
                          <th className="w-24 py-2 font-medium">Reps</th>
                          <th className="w-72 py-2 font-medium">Intensidad</th>
                          <th className="w-24 py-2 font-medium">Descanso</th>
                          <th className="py-2 font-medium">Nota</th>
                          <td className="w-20" />
                        </tr>
                      </thead>
                      {runs.map((run) => (
                        <tbody key={`${run.start}-${run.items[0].key}`} className="divide-y divide-line border-t border-line">
                          {run.block !== null && (
                            <tr>
                              <td colSpan={8} className="bg-mist/60 px-2 py-2">
                                <div className="sticky left-2 max-w-[40rem]">
                                <BlockHeader
                                  name={run.block}
                                  onRename={(v) => renameBlock(session.key, run.start, run.items.length, v)}
                                  onAdd={() => addExercise(session.key, { start: run.start, len: run.items.length })}
                                  onRemove={() => removeBlock(session.key, run.start, run.items.length)}
                                  canAdd={session.exercises.length < GYM_LIMITS.exercisesMax}
                                />
                                </div>
                              </td>
                            </tr>
                          )}
                          {run.items.map((e, k) => {
                            const i = run.start + k;
                            const inSet = sameSuperset(session.exercises[i - 1], e) || sameSuperset(e, session.exercises[i + 1]);
                            const canLink = k < run.items.length - 1;
                            const linked = sameSuperset(e, session.exercises[i + 1]);
                            return (
                              <tr key={e.key} className="align-top">
                                <td className={`py-2 pt-4 pl-2 font-semibold tabular-nums ${inSet ? "text-brand-text shadow-[inset_3px_0_0_#38BDF8]" : "text-muted"}`}>
                                  {codes[i]}
                                </td>
                                <td className="py-2 pr-2">
                                  <input
                                    aria-label={`Ejercicio ${codes[i]}`}
                                    list="exercise-names"
                                    value={e.name}
                                    maxLength={GYM_LIMITS.exerciseMax}
                                    placeholder="Ej.: Sentadilla trasera"
                                    onChange={(ev) => updateExercise(session.key, e.key, { name: ev.target.value })}
                                    className={smallField}
                                  />
                                </td>
                                <td className="py-2 pr-2">
                                  <input
                                    aria-label="Series"
                                    type="number"
                                    min={GYM_LIMITS.setsMin}
                                    max={GYM_LIMITS.setsMax}
                                    value={e.sets}
                                    onChange={(ev) => updateExercise(session.key, e.key, { sets: Number(ev.target.value) || 1 })}
                                    className={smallField}
                                  />
                                </td>
                                <td className="py-2 pr-2">
                                  {e.intensity_type === "tiempo" ? (
                                    <p className="pt-2.5 text-xs text-muted">Por tiempo</p>
                                  ) : (
                                    <input
                                      aria-label="Repeticiones"
                                      value={e.reps}
                                      maxLength={GYM_LIMITS.repsMax}
                                      placeholder="5, máx"
                                      onChange={(ev) => updateExercise(session.key, e.key, { reps: ev.target.value })}
                                      className={smallField}
                                    />
                                  )}
                                </td>
                                <td className="py-2 pr-2">
                                  <IntensityFields
                                    exercise={e}
                                    tests={data.tests}
                                    onType={(t) => setIntensity(session.key, e, t)}
                                    onChange={(patch) => updateExercise(session.key, e.key, patch)}
                                  />
                                </td>
                                <td className="py-2 pr-2">
                                  <TimeInput
                                    label="Descanso (m:ss)"
                                    placeholder="1:30"
                                    value={e.rest_seconds}
                                    parse={parseRest}
                                    onChange={(v) => updateExercise(session.key, e.key, { rest_seconds: v })}
                                  />
                                </td>
                                <td className="py-2 pr-2">
                                  <input
                                    aria-label="Nota"
                                    value={e.note}
                                    maxLength={GYM_LIMITS.noteMax}
                                    onChange={(ev) => updateExercise(session.key, e.key, { note: ev.target.value })}
                                    className={smallField}
                                  />
                                </td>
                                <td className="py-2">
                                  <div className="flex">
                                    {canLink && (
                                      <button
                                        type="button"
                                        aria-pressed={linked}
                                        title={linked ? "Separar de la superserie" : "Hacer superserie con el siguiente"}
                                        aria-label={linked ? `Separar ${codes[i]} y ${codes[i + 1]}` : `Superserie de ${codes[i]} con el siguiente`}
                                        onClick={() => toggleSuperset(session.key, i)}
                                        className={`flex size-10 items-center justify-center rounded-lg hover:bg-mist ${linked ? "text-brand-text" : "text-muted"}`}
                                      >
                                        {linked ? <Unlink2 aria-hidden="true" className="size-4" /> : <Link2 aria-hidden="true" className="size-4" />}
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      aria-label={`Quitar ${e.name || `ejercicio ${codes[i]}`}`}
                                      onClick={() => removeExercise(session.key, e.key)}
                                      className="ml-auto flex size-10 items-center justify-center rounded-lg text-muted hover:bg-mist hover:text-danger"
                                    >
                                      <Trash2 aria-hidden="true" className="size-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      ))}
                    </table>
                  </div>

                  {/* Celular: tarjetas por ejercicio, por bloques */}
                  <div className="space-y-4 lg:hidden">
                    {runs.map((run) => (
                      <div key={`${run.start}-${run.items[0].key}`} className="space-y-2">
                        {run.block !== null && (
                          <BlockHeader
                            name={run.block}
                            onRename={(v) => renameBlock(session.key, run.start, run.items.length, v)}
                            onAdd={() => setSheet(addExercise(session.key, { start: run.start, len: run.items.length }))}
                            onRemove={() => removeBlock(session.key, run.start, run.items.length)}
                            canAdd={session.exercises.length < GYM_LIMITS.exercisesMax}
                          />
                        )}
                        <ul className="space-y-2">
                          {run.items.map((e, k) => {
                            const i = run.start + k;
                            const withPrev = sameSuperset(session.exercises[i - 1], e);
                            const withNext = sameSuperset(e, session.exercises[i + 1]);
                            return (
                              <li key={e.key} className={withPrev ? "-mt-2" : undefined}>
                                <button
                                  type="button"
                                  onClick={() => setSheet(e.key)}
                                  className={`flex w-full items-center gap-3 border px-3.5 py-3 text-left ${
                                    withPrev || withNext ? "border-[#BAE6FD] bg-[#F0F9FF]" : "border-line"
                                  } ${withPrev ? "rounded-b-2xl border-t-0" : "rounded-t-2xl"} ${withNext ? "" : "rounded-b-2xl"}`}
                                >
                                  <span
                                    className={`flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg px-1 text-xs font-semibold ${
                                      withPrev || withNext ? "bg-brand text-[#082F49]" : "bg-mist text-ink"
                                    }`}
                                  >
                                    {codes[i]}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block font-semibold text-ink">{e.name.trim() || "Ejercicio sin nombre"}</span>
                                    <span className="block text-sm text-muted">
                                      {exerciseDose(e)} · {intensityLabel(e, e.test_id ? testName.get(e.test_id) : null)}
                                      {e.rest_seconds !== null && ` · ${restLabel(e.rest_seconds)}`}
                                    </span>
                                  </span>
                                  <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted" />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>

                  {session.exercises.length < GYM_LIMITS.exercisesMax && (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => {
                          const key = addExercise(session.key);
                          if (window.matchMedia("(max-width: 1023px)").matches) setSheet(key);
                        }}
                        className="flex min-h-11 w-full items-center justify-center rounded-xl border border-dashed border-muted/60 text-sm font-semibold text-brand-text sm:w-auto sm:px-4"
                      >
                        + Agregar ejercicio
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const key = addBlock(session.key);
                          if (window.matchMedia("(max-width: 1023px)").matches) setSheet(key);
                        }}
                        className="flex min-h-11 w-full items-center justify-center rounded-xl border border-dashed border-muted/60 text-sm font-semibold text-brand-text sm:w-auto sm:px-4"
                      >
                        + Bloque
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-muted">
                    Bloques: agrupan ejercicios (ej.: Calentamiento, Principal). Superserie: con{" "}
                    <Link2 aria-label="el ícono de cadena" className="inline size-3.5 align-[-2px]" /> unes un ejercicio con el
                    siguiente para hacerlos seguidos (A1, A2).
                  </p>
                </div>
              ) : (
                <p className="p-5 text-sm text-muted">Agrega una sesión para empezar.</p>
              )}
            </section>
          </div>

          {/* Panel derecho: vista previa, lesionados y avisos */}
          <aside className="space-y-4">
            <section className="hidden space-y-3 rounded-xl border border-line bg-white p-4 lg:block">
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">Vista previa</p>
                {previewPlayer ? (
                  <label className="mt-1 flex items-center gap-2 text-sm text-ink">
                    Así lo ve
                    <select
                      value={previewPlayer.id}
                      onChange={(e) => setPreviewId(e.target.value)}
                      className="min-h-9 flex-1 rounded-lg border border-line bg-white px-2 text-sm font-semibold"
                    >
                      {recipients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="mt-1 text-sm text-muted">Elige a quién va el plan para ver cómo lo ve un jugador.</p>
                )}
              </div>
              {previewPlayer && session && (
                <ul className="divide-y divide-line">
                  {session.exercises.map((e, i) => {
                    const v = preview(e);
                    return (
                      <li key={e.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="min-w-0 text-ink">
                          <span className="mr-1.5 text-xs font-semibold text-muted">{codes[i]}</span>
                          {e.name.trim() || "Ejercicio"} {exerciseDose(e)}
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block font-display font-bold text-ink">{v.main}</span>
                          {v.sub && <span className="block text-[11px] text-muted">{v.sub}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="text-xs text-muted">Kilos calculados con sus máximos de Evaluaciones, redondeados a 2,5 kg.</p>
            </section>

            <section className="space-y-3 rounded-xl border border-line bg-white p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold text-ink">Lesionados ({injured.length})</p>
                <p className="text-sm text-muted">
                  Reciben el plan: {recipients.length} de {targeted.length}
                </p>
              </div>
              <p className="text-sm text-muted">
                {injured.length === 0
                  ? "Ningún destinatario está lesionado."
                  : injuredOut === 0
                    ? "Por defecto, los lesionados también reciben el plan."
                    : injuredOut === injured.length
                      ? "Ningún lesionado verá este plan."
                      : `${injuredOut} ${injuredOut === 1 ? "lesionado no verá" : "lesionados no verán"} este plan; el resto sí.`}
              </p>
              {injured.length > 0 && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      aria-pressed={injuredOut === injured.length}
                      onClick={discardAll}
                      className={chip(injuredOut === injured.length)}
                    >
                      Descartar a todos
                    </button>
                    <button
                      type="button"
                      aria-expanded={showDiscard}
                      onClick={() => setShowDiscard((v) => !v)}
                      className={chip(showDiscard)}
                    >
                      Descartar a…
                    </button>
                  </div>
                  {showDiscard && (
                    <div className="space-y-1 rounded-xl bg-mist p-2">
                      {injured.map((p) => (
                        <CheckRow
                          key={p.id}
                          checked={excluded.has(p.id)}
                          onToggle={() => toggleExcluded(p.id)}
                          label={p.name}
                          detail={p.injury ?? "Lesionado"}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>

            {missing.map((m) => (
              <p
                key={m.test}
                className="flex items-start gap-2 rounded-xl border border-alerta/40 bg-alerta-soft px-4 py-3 text-sm text-alerta-fg"
              >
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>
                  {m.n} sin test de {m.test}: verán &quot;{m.pct} % de tu máximo&quot; sin kilos.
                </span>
              </p>
            ))}

            {plan.id && data.status !== "archivado" && (
              <button type="button" onClick={archive} disabled={pending} className={`${textButton} hidden lg:inline-flex`}>
                Archivar plan
              </button>
            )}
          </aside>
        </div>
      </fieldset>

      {/* Celular: acciones abajo */}
      {!readOnly && (
        <div className="mt-6 space-y-2 lg:hidden">
          {actions && <div className="grid gap-2 [&>*]:w-full">{actions}</div>}
          {plan.id && (
            <button type="button" onClick={archive} disabled={pending} className={`w-full justify-center ${textButton}`}>
              Archivar plan
            </button>
          )}
        </div>
      )}

      {sheetExercise && session && (
        <ExerciseSheet
          exercise={sheetExercise}
          tests={data.tests}
          example={(() => {
            const t = sheetExercise.test_id;
            const p = t ? recipients.find((r) => data.maxes[t]?.[r.id] !== undefined) : null;
            return p && t ? { name: p.name, max: data.maxes[t][p.id] } : null;
          })()}
          onClose={() => setSheet(null)}
          onChange={(patch) => updateExercise(session.key, sheetExercise.key, patch)}
          onType={(t) => setIntensity(session.key, sheetExercise, t)}
          code={codes[sheetIndex]}
          superset={
            sheetIndex >= 0 &&
            sheetIndex < session.exercises.length - 1 &&
            (sheetExercise.block ?? "") === (session.exercises[sheetIndex + 1].block ?? "")
              ? { linked: sameSuperset(sheetExercise, session.exercises[sheetIndex + 1]), toggle: () => toggleSuperset(session.key, sheetIndex) }
              : null
          }
          onRemove={() => {
            removeExercise(session.key, sheetExercise.key);
            setSheet(null);
          }}
        />
      )}
    </main>
  );
}

function okText(ok: string) {
  return ok === "publicado" ? "Plan publicado: los jugadores ya lo ven." : ok === "guardado" ? "Cambios guardados." : "Borrador guardado.";
}

// Encabezado de un bloque: nombre editable, agregar ejercicio al bloque y quitarlo.
function BlockHeader({
  name,
  onRename,
  onAdd,
  onRemove,
  canAdd,
}: {
  name: string;
  onRename: (v: string) => void;
  onAdd: () => void;
  onRemove: () => void;
  canAdd: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        aria-label="Nombre del bloque"
        value={name}
        maxLength={GYM_LIMITS.blockMax}
        placeholder="Nombre del bloque"
        onChange={(ev) => onRename(ev.target.value)}
        className="min-h-10 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 text-sm font-bold tracking-wide text-ink uppercase outline-none hover:border-line focus:border-brand-strong focus:bg-white"
      />
      {canAdd && (
        <button type="button" onClick={onAdd} className="min-h-10 shrink-0 rounded-lg px-2 text-sm font-semibold text-brand-text hover:bg-white">
          + Ejercicio
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Quitar bloque ${name}`}
        className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-white hover:text-danger"
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

function CheckRow({
  checked,
  onToggle,
  label,
  detail,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  detail?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2 text-left hover:bg-white"
    >
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded-md border-2 ${
          checked ? "border-brand bg-brand text-ink" : "border-line bg-white text-transparent"
        }`}
      >
        <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {detail && <span className="block text-xs text-muted">{detail}</span>}
      </span>
    </button>
  );
}

// Tiempo en "m:ss" (o segundos): descanso o tiempo por serie. Se interpreta al salir del campo.
function TimeInput({
  value,
  onChange,
  parse,
  label,
  placeholder,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  parse: (v: string) => number | null | undefined;
  label: string;
  placeholder: string;
}) {
  const [text, setText] = useState(restLabel(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setText(restLabel(value));
  }
  return (
    <input
      aria-label={label}
      value={text}
      placeholder={placeholder}
      inputMode="numeric"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const v = parse(text);
        if (v === undefined) setText(restLabel(value));
        else onChange(v);
      }}
      className={smallField}
    />
  );
}

function IntensityFields({
  exercise: e,
  tests,
  onType,
  onChange,
}: {
  exercise: DraftExercise;
  tests: EditorData["tests"];
  onType: (t: IntensityType) => void;
  onChange: (patch: Partial<DraftExercise>) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <select
        aria-label="Tipo de intensidad"
        value={e.intensity_type}
        onChange={(ev) => onType(ev.target.value as IntensityType)}
        className={`${smallField} w-28`}
      >
        {INTENSITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value} disabled={o.value === "pct" && tests.length === 0}>
            {o.label}
          </option>
        ))}
      </select>
      {e.intensity_type === "pct" && (
        <>
          <input
            aria-label="Porcentaje del máximo"
            type="number"
            min={GYM_LIMITS.pctMin}
            max={GYM_LIMITS.pctMax}
            step={GYM_LIMITS.pctStep}
            value={e.pct ?? ""}
            onChange={(ev) => onChange({ pct: Number(ev.target.value) || null })}
            className={`${smallField} w-16`}
          />
          <select
            aria-label="Test de Evaluaciones"
            value={e.test_id ?? ""}
            onChange={(ev) => onChange({ test_id: ev.target.value || null })}
            className={`${smallField} w-36 flex-1`}
          >
            {tests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </>
      )}
      {e.intensity_type === "rpe" && (
        <input
          aria-label="Esfuerzo objetivo de 1 a 10"
          type="number"
          min={GYM_LIMITS.rpeMin}
          max={GYM_LIMITS.rpeMax}
          value={e.rpe ?? ""}
          onChange={(ev) => onChange({ rpe: Number(ev.target.value) || null })}
          className={`${smallField} w-16`}
        />
      )}
      {e.intensity_type === "tiempo" && (
        <div className="w-24">
          <TimeInput
            label="Tiempo por serie (m:ss)"
            placeholder="1:00"
            value={e.seconds}
            parse={parseDuration}
            onChange={(v) => onChange({ seconds: v })}
          />
        </div>
      )}
      {e.intensity_type === "kg" && (
        <input
          aria-label="Kilos"
          type="number"
          min={0.5}
          step={0.5}
          value={e.kg ?? ""}
          onChange={(ev) => onChange({ kg: Number(ev.target.value) || null })}
          className={`${smallField} w-20`}
        />
      )}
    </div>
  );
}

// Hoja del celular para editar un ejercicio: series y reps (o tiempo) con +/−, intensidad
// en 5 opciones y, con % del máximo, el porcentaje de a 5 y el test, con un cálculo de
// ejemplo. Abajo, unir con el siguiente en superserie.
function ExerciseSheet({
  exercise: e,
  tests,
  example,
  onClose,
  onChange,
  onType,
  onRemove,
  code,
  superset,
}: {
  exercise: DraftExercise;
  tests: EditorData["tests"];
  example: { name: string; max: number } | null;
  onClose: () => void;
  onChange: (patch: Partial<DraftExercise>) => void;
  onType: (t: IntensityType) => void;
  onRemove: () => void;
  code: string | undefined;
  superset: { linked: boolean; toggle: () => void } | null;
}) {
  const repsNum = /^\d+$/.test(e.reps.trim()) ? Number(e.reps) : null;
  const time = e.intensity_type === "tiempo";
  const secs = e.seconds ?? 60;
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-ink/50 lg:hidden" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Editar ejercicio"
        onClick={(ev) => ev.stopPropagation()}
        className="max-h-[92vh] w-full space-y-4 overflow-y-auto rounded-t-3xl bg-white px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <div aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-line" />
        <div className="flex items-center justify-between gap-3">
          {code && (
            <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg bg-mist px-1.5 text-sm font-semibold text-ink">
              {code}
            </span>
          )}
          <input
            aria-label="Nombre del ejercicio"
            list="exercise-names"
            value={e.name}
            maxLength={GYM_LIMITS.exerciseMax}
            placeholder="Nombre del ejercicio"
            onChange={(ev) => onChange({ name: ev.target.value })}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-transparent px-1 font-display text-xl font-extrabold text-ink outline-none focus:border-brand-strong"
          />
          <button type="button" onClick={onClose} className="min-h-11 px-2 font-semibold text-brand-text">
            Listo
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stepper
            label="Series"
            value={String(e.sets)}
            onMinus={() => onChange({ sets: Math.max(GYM_LIMITS.setsMin, e.sets - 1) })}
            onPlus={() => onChange({ sets: Math.min(GYM_LIMITS.setsMax, e.sets + 1) })}
          />
          {time ? (
            <Stepper
              label="Tiempo por serie"
              value={durationLabel(secs)}
              onMinus={() => onChange({ seconds: Math.max(GYM_LIMITS.secondsMin, secs - (secs > 60 ? 15 : 5)) })}
              onPlus={() => onChange({ seconds: Math.min(GYM_LIMITS.secondsMax, secs + (secs >= 60 ? 15 : 5)) })}
            />
          ) : (
            <Stepper
              label="Repeticiones"
              value={e.reps || "?"}
              onMinus={() => onChange({ reps: String(Math.max(1, (repsNum ?? 2) - 1)) })}
              onPlus={() => onChange({ reps: String(Math.min(99, (repsNum ?? 0) + 1)) })}
            />
          )}
        </div>
        {!time && (
          <label className="block">
            <span className="text-xs font-semibold text-muted">Repeticiones en texto (ej.: máx)</span>
            <input
              value={e.reps}
              maxLength={GYM_LIMITS.repsMax}
              onChange={(ev) => onChange({ reps: ev.target.value })}
              className={smallField}
            />
          </label>
        )}

        <div>
          <p className="text-xs font-semibold text-muted">Intensidad</p>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {INTENSITY_OPTIONS.map((o) => {
              const on = e.intensity_type === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={on}
                  disabled={o.value === "pct" && tests.length === 0}
                  onClick={() => onType(o.value)}
                  className={`min-h-11 rounded-lg border text-[13px] font-semibold disabled:opacity-50 ${
                    on ? "border-brand bg-brand text-[#082F49]" : "border-line bg-white text-ink"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          {tests.length === 0 && (
            <p className="mt-1 text-xs text-muted">Para usar % del máximo, agrega un test en kilos en Evaluaciones.</p>
          )}
        </div>

        {e.intensity_type === "pct" && (
          <div className="space-y-3 rounded-2xl bg-[#F0F9FF] p-3.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ink">Porcentaje</span>
              <div className="flex items-center gap-2">
                <RoundButton
                  label="Bajar porcentaje"
                  onClick={() => onChange({ pct: Math.max(GYM_LIMITS.pctMin, (e.pct ?? 80) - GYM_LIMITS.pctStep) })}
                >
                  <Minus aria-hidden="true" className="size-4" />
                </RoundButton>
                <span className="min-w-14 text-center font-display text-xl font-extrabold text-ink tabular-nums">{e.pct} %</span>
                <RoundButton
                  label="Subir porcentaje"
                  onClick={() => onChange({ pct: Math.min(GYM_LIMITS.pctMax, (e.pct ?? 80) + GYM_LIMITS.pctStep) })}
                >
                  <Plus aria-hidden="true" className="size-4" />
                </RoundButton>
              </div>
            </div>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ink">del test</span>
              <select
                value={e.test_id ?? ""}
                onChange={(ev) => onChange({ test_id: ev.target.value || null })}
                className="min-h-11 max-w-[60%] rounded-lg border border-[#BAE6FD] bg-white px-2 text-sm text-brand-text"
              >
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[13px] text-brand-text">
              {example && e.pct !== null
                ? `${example.name} (${example.max} kg): ${roundKg(example.max, e.pct).toLocaleString("es-CL")} kg · cada uno con su máximo`
                : "Cada jugador ve los kilos según su máximo de Evaluaciones."}
            </p>
          </div>
        )}
        {e.intensity_type === "rpe" && (
          <Stepper
            label="Esfuerzo objetivo (1 a 10)"
            value={`${e.rpe ?? 7} de 10`}
            onMinus={() => onChange({ rpe: Math.max(GYM_LIMITS.rpeMin, (e.rpe ?? 7) - 1) })}
            onPlus={() => onChange({ rpe: Math.min(GYM_LIMITS.rpeMax, (e.rpe ?? 7) + 1) })}
          />
        )}
        {e.intensity_type === "kg" && (
          <label className="block">
            <span className="text-xs font-semibold text-muted">Mismo peso para todos (kg)</span>
            <input
              type="number"
              inputMode="decimal"
              min={0.5}
              step={0.5}
              value={e.kg ?? ""}
              onChange={(ev) => onChange({ kg: Number(ev.target.value) || null })}
              className={smallField}
            />
          </label>
        )}
        {e.intensity_type === "bw" && <p className="rounded-2xl bg-[#F0F9FF] p-3.5 text-sm text-ink">Peso corporal, sin kilos.</p>}
        {time && (
          <p className="rounded-2xl bg-[#F0F9FF] p-3.5 text-sm text-ink">
            {e.sets} {e.sets === 1 ? "serie" : "series"} de {durationLabel(secs)} (ej.: plancha). Sin repeticiones.
          </p>
        )}

        {superset && (
          <button
            type="button"
            aria-pressed={superset.linked}
            onClick={superset.toggle}
            className={`flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 text-left text-sm font-semibold ${
              superset.linked ? "border-brand bg-brand-soft text-brand-text" : "border-line text-ink"
            }`}
          >
            {superset.linked ? <Unlink2 aria-hidden="true" className="size-4" /> : <Link2 aria-hidden="true" className="size-4" />}
            {superset.linked ? "En superserie con el siguiente · Separar" : "Hacer superserie con el siguiente"}
          </button>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold text-muted">Descanso (m:ss)</span>
            <TimeInput
              label="Descanso (m:ss)"
              placeholder="1:30"
              value={e.rest_seconds}
              parse={parseRest}
              onChange={(v) => onChange({ rest_seconds: v })}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-muted">Nota</span>
            <input
              value={e.note}
              maxLength={GYM_LIMITS.noteMax}
              onChange={(ev) => onChange({ note: ev.target.value })}
              className={smallField}
            />
          </label>
        </div>

        <button type="button" onClick={onRemove} className="flex min-h-11 w-full items-center justify-center gap-2 text-sm font-semibold text-danger">
          <X aria-hidden="true" className="size-4" />
          Quitar ejercicio
        </button>
      </div>
    </div>
  );
}

function Stepper({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted">{label}</p>
      <div className="mt-1.5 flex items-center justify-between rounded-xl border border-line p-1">
        <RoundButton label={`Menos: ${label.toLowerCase()}`} onClick={onMinus}>
          <Minus aria-hidden="true" className="size-4" />
        </RoundButton>
        <span className="font-display text-lg font-bold text-ink tabular-nums" aria-live="polite">
          {value}
        </span>
        <RoundButton label={`Más: ${label.toLowerCase()}`} onClick={onPlus}>
          <Plus aria-hidden="true" className="size-4" />
        </RoundButton>
      </div>
    </div>
  );
}

function RoundButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-10 w-11 items-center justify-center rounded-lg bg-mist text-ink hover:bg-line/70"
    >
      {children}
    </button>
  );
}
