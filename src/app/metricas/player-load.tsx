"use client";

// "Carga por jugador" (Métricas → Carga): una fila por jugador del formato con la barra
// de la semana por tipo (Cancha, Gimnasio, Partido), el total, la comparación con su
// promedio y el plan de gimnasio (la columna se oculta si nadie tiene plan). Chips para
// filtrar por alerta; primero los jugadores con alguna alerta y luego por carga. 8 filas
// y "Ver los N jugadores". Todo en una TableCard: columnas desde lg y, en el celular,
// filas de al menos 60 px (sin tarjetas por jugador).
// Los datos y umbrales vienen de la base (team_srpe_load, team_load_breakdown,
// wellness_flags, team_return_summary, gym_adherence): aquí solo se presentan.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { LOAD_KINDS, LOAD_KIND_COLOR, LOAD_KIND_LABEL } from "@/lib/gym";
import { formatLoad } from "@/lib/srpe";
import { TooltipTarget } from "@/app/chart-tooltip";
import { ListRow, TableCard } from "@/app/ui-blocks";

export type PlayerLoadItem = {
  id: string;
  name: string;
  load: number;
  parts: { cancha: number; gimnasio: number; partido: number } | null;
  high: boolean;
  pctOver: number | null; // vs el promedio de sus 4 semanas anteriores
  priorWeeks: number;
  wellness: { total: number; reason: string } | null; // solo si está bajo lo habitual
  back: { weeks: number; cause: string } | null; // "lesión", "vacaciones"…
  gym: { done: number; assigned: number } | null;
};

type Filter = "todos" | "alta" | "bienestar" | "paron";

const PREVIEW = 8;

// Clases literales de cada etiqueta (Tailwind solo genera las escritas).
const TAG = {
  alta: "bg-alerta-bg text-alerta-fg",
  bienestar: "bg-lesionado-bg text-lesionado-fg",
  paron: "bg-paron-bg text-paron-fg",
} as const;

const hasAlert = (p: PlayerLoadItem) => p.high || p.wellness !== null || p.back !== null;

// Avisos del jugador: un ícono junto al nombre; el detalle sale al pasar el mouse, al
// enfocarlo con teclado o al tocarlo (otro toque fuera lo cierra). Va sobre el link de
// la fila (z-10), así que tocarlo no abre la ficha.
function Tags({ p }: { p: PlayerLoadItem }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const shown = open || hover;
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!hasAlert(p)) return null;
  const items: { key: keyof typeof TAG; text: string }[] = [];
  if (p.high) items.push({ key: "alta", text: `Carga alta${p.pctOver !== null ? ` · +${p.pctOver} %` : ""}` });
  if (p.back) items.push({ key: "paron", text: `Vuelve tras ${p.back.weeks} sem · ${p.back.cause}` });
  if (p.wellness) items.push({ key: "bienestar", text: `Bienestar ${p.wellness.total}/25 · ${p.wellness.reason}` });
  const tone = p.wellness ? TAG.bienestar : p.high ? TAG.alta : TAG.paron;
  const id = `avisos-${p.id}`;

  return (
    <span
      ref={rootRef}
      className="relative z-10 -mx-2.5 inline-flex shrink-0"
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHover(false)}
    >
      <button
        type="button"
        aria-label={`Avisos de ${p.name}: ${items.map((i) => i.text).join("; ")}`}
        aria-expanded={shown}
        aria-describedby={id}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-brand-strong`}
      >
        <span className={`flex size-6 items-center justify-center rounded-full ${tone}`}>
          <TriangleAlert aria-hidden="true" className="size-3.5" />
        </span>
      </button>
      <span
        id={id}
        role="tooltip"
        hidden={!shown}
        className="absolute top-full left-0 z-30 -mt-1 flex w-max max-w-72 flex-col gap-1.5 rounded-xl border border-line bg-card p-3 shadow-lg"
      >
        {items.map((i) => (
          <span key={i.key} className={`rounded-lg px-2 py-1 text-xs font-semibold ${TAG[i.key]}`}>
            {i.text}
          </span>
        ))}
      </span>
    </span>
  );
}

function Bar({ p, max }: { p: PlayerLoadItem; max: number }) {
  const width = Math.max(p.load > 0 ? 2 : 0, (p.load / max) * 100);
  if (p.load <= 0) return <div className="h-3.5" />;
  const lines = p.parts
    ? LOAD_KINDS.filter((k) => p.parts![k] > 0).map((k) => `${LOAD_KIND_LABEL[k]}: ${formatLoad(p.parts![k])}`)
    : [];
  return (
    <TooltipTarget
      tip={{ title: `${p.name} · ${formatLoad(p.load)}`, lines }}
      className="flex h-3.5 gap-px rounded"
      style={{ width: `${width}%` }}
    >
      {p.parts ? (
        LOAD_KINDS.map((k) =>
          p.parts![k] > 0 ? (
            <div
              key={k}
              className="first:rounded-l last:rounded-r"
              style={{ flexGrow: p.parts![k], background: LOAD_KIND_COLOR[k] }}
            />
          ) : null,
        )
      ) : (
        <div className="flex-1 rounded bg-brand" />
      )}
    </TooltipTarget>
  );
}

function VsAverage({ p }: { p: PlayerLoadItem }) {
  if (p.priorWeeks < 3 || p.pctOver === null) return <span className="text-sm text-muted">—</span>;
  const text = p.pctOver >= 0 ? `+${p.pctOver} %` : `−${Math.abs(p.pctOver)} %`;
  return <span className={`text-sm tabular-nums ${p.high ? "font-semibold text-alerta-fg" : "text-ink"}`}>{text}</span>;
}

function Gym({ g }: { g: PlayerLoadItem["gym"] }) {
  if (!g || g.assigned === 0) return <span className="text-sm text-muted">Sin plan</span>;
  return (
    <span
      className={
        g.done >= g.assigned
          ? "text-sm text-ink"
          : "rounded-full bg-fill-soft px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-body-strong"
      }
    >
      {g.done} de {g.assigned}
    </span>
  );
}

export function PlayerLoadTable({ players, header, id }: { players: PlayerLoadItem[]; header: ReactNode; id: string }) {
  const [filter, setFilter] = useState<Filter>("todos");
  const [expanded, setExpanded] = useState(false);

  const sorted = [...players].sort(
    (a, b) => Number(hasAlert(b)) - Number(hasAlert(a)) || b.load - a.load || a.name.localeCompare(b.name),
  );
  const counts: Record<Filter, number> = {
    todos: players.length,
    alta: players.filter((p) => p.high).length,
    bienestar: players.filter((p) => p.wellness).length,
    paron: players.filter((p) => p.back).length,
  };
  const filtered = sorted.filter((p) =>
    filter === "alta" ? p.high : filter === "bienestar" ? p.wellness : filter === "paron" ? p.back : true,
  );
  const visible = expanded ? filtered : filtered.slice(0, PREVIEW);
  const max = Math.max(1, ...players.map((p) => p.load));
  const showGym = players.some((p) => p.gym && p.gym.assigned > 0);
  // Columnas desde lg (clases literales).
  const cols = showGym
    ? "lg:grid-cols-[minmax(10rem,2fr)_minmax(0,3fr)_5rem_7rem_8rem]"
    : "lg:grid-cols-[minmax(10rem,2fr)_minmax(0,3fr)_5rem_7rem]";

  const chips: { key: Filter; label: ReactNode }[] = [
    { key: "todos", label: "Todos" },
    { key: "alta", label: "Carga alta" },
    { key: "bienestar", label: "Bienestar bajo" },
    {
      key: "paron",
      label: (
        <>
          <span className="sm:hidden">Parón</span>
          <span className="hidden sm:inline">Vuelve tras parón</span>
        </>
      ),
    },
  ];

  if (players.length === 0)
    return (
      <section id={id} className="scroll-mt-20">
        <TableCard header={header}>
          <ListRow>
            <p className="text-sm text-muted">Sin jugadores en el plantel.</p>
          </ListRow>
        </TableCard>
      </section>
    );

  const chipsRow = (
    <div role="group" aria-label="Filtrar jugadores" className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none]">
      {chips.map((c) => {
        const on = filter === c.key;
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={on}
            onClick={() => {
              setFilter(c.key);
              setExpanded(false);
            }}
            className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition ${
              on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:bg-mist"
            }`}
          >
            {c.label}
            <span className={`tabular-nums ${on ? "text-white/80" : "text-muted"}`}>{counts[c.key]}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <section id={id} className="scroll-mt-20">
      <TableCard
        columns={cols}
        header={
          <>
            {header}
            {chipsRow}
          </>
        }
        footer={
          filtered.length > PREVIEW ? (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((e) => !e)}
              className="inline-flex min-h-11 items-center text-sm font-medium text-brand-text underline"
            >
              {expanded ? "Ver menos" : `Ver los ${filtered.length} jugadores`}
            </button>
          ) : undefined
        }
        head={
          <>
            <span>Jugador</span>
            <span>Carga de la semana</span>
            <span>Total</span>
            <span>vs su promedio</span>
            {showGym && <span>Plan de gimnasio</span>}
          </>
        }
      >
        {filtered.length === 0 && (
          <ListRow>
            <p className="text-sm text-muted">Nadie en este grupo esta semana.</p>
          </ListRow>
        )}
        {visible.map((p) => (
          <ListRow key={p.id} columns={cols} className="min-h-15 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="-my-2.5 flex items-center gap-1">
                <Link
                  href={`/jugadores/${p.id}`}
                  className="min-w-0 truncate text-15 font-semibold text-ink after:absolute after:inset-0 after:content-[''] hover:underline"
                >
                  {p.name}
                </Link>
                <Tags p={p} />
              </div>
              {/* Celular: barra y comparación bajo el nombre. */}
              <div className="mt-1.5 lg:hidden">
                <Bar p={p} max={max} />
                <p className="mt-1 flex items-center justify-between gap-3 text-13 text-muted">
                  <span>
                    vs su promedio <VsAverage p={p} />
                  </span>
                  {showGym && (
                    <span>
                      Gimnasio <Gym g={p.gym} />
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="hidden lg:block">
              <Bar p={p} max={max} />
            </div>
            <span className="shrink-0 font-display text-base font-bold text-ink tabular-nums">{formatLoad(p.load)}</span>
            <span className="hidden lg:block">
              <VsAverage p={p} />
            </span>
            {showGym && (
              <span className="hidden lg:block">
                <Gym g={p.gym} />
              </span>
            )}
          </ListRow>
        ))}
      </TableCard>
    </section>
  );
}
