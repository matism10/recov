"use client";

// "Carga por jugador" (Métricas → Carga): una fila por jugador del formato con la barra
// de la semana por tipo (Cancha, Gimnasio, Partido), el total, la comparación con su
// promedio y el plan de gimnasio (la columna se oculta si nadie tiene plan). Chips para
// filtrar por alerta; primero los jugadores con alguna alerta y luego por carga. 8 filas
// y "Ver los N jugadores". En el celular (<640 px) cada jugador es una tarjeta.
// Los datos y umbrales vienen de la base (team_srpe_load, team_load_breakdown,
// wellness_flags, team_return_summary, gym_adherence): aquí solo se presentan.
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { LOAD_KINDS, LOAD_KIND_COLOR, LOAD_KIND_LABEL } from "@/lib/gym";
import { formatLoad } from "@/lib/srpe";
import { TooltipTarget } from "@/app/chart-tooltip";

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

function Tags({ p }: { p: PlayerLoadItem }) {
  if (!hasAlert(p)) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1.5">
      {p.high && (
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${TAG.alta}`}>
          Carga alta{p.pctOver !== null ? ` · +${p.pctOver} %` : ""}
        </span>
      )}
      {p.back && (
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${TAG.paron}`}>
          Vuelve tras {p.back.weeks} sem · {p.back.cause}
        </span>
      )}
      {p.wellness && (
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TAG.bienestar}`}>
          Bienestar {p.wellness.total}/25 · {p.wellness.reason}
        </span>
      )}
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

export function PlayerLoadTable({ players }: { players: PlayerLoadItem[] }) {
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

  if (players.length === 0) return <p className="text-sm text-muted">Sin jugadores en el plantel.</p>;

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Filtrar jugadores" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
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
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition ${
                on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:bg-mist"
              }`}
            >
              {c.label}
              <span className={`tabular-nums ${on ? "text-white/80" : "text-muted"}`}>{counts[c.key]}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="py-3 text-sm text-muted">Nadie en este grupo esta semana.</p>
      ) : (
        <>
          {/* Celular: una tarjeta por jugador. */}
          <ul className="space-y-2 sm:hidden">
            {visible.map((p) => (
              <li key={p.id} className="rounded-xl border border-line px-3 py-2.5">
                <Link href={`/jugadores/${p.id}`} className="font-medium text-ink hover:underline">
                  {p.name}
                </Link>
                <Tags p={p} />
                <div className="mt-2 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <Bar p={p} max={max} />
                  </div>
                  <span className="font-display font-bold text-ink tabular-nums">{formatLoad(p.load)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted">
                  <span>
                    vs su promedio <VsAverage p={p} />
                  </span>
                  {showGym && (
                    <span>
                      Gimnasio <Gym g={p.gym} />
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {/* Desde sm: tabla. */}
          <div className="hidden sm:block">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">Jugador</th>
                  <th scope="col" className="w-[32%] py-2 pr-3 font-medium">Carga de la semana</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Total</th>
                  <th scope="col" className="py-2 pr-3 font-medium">vs su promedio</th>
                  {showGym && <th scope="col" className="py-2 font-medium">Plan de gimnasio</th>}
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id} className="border-t border-line align-middle">
                    <td className="py-2.5 pr-3">
                      <Link href={`/jugadores/${p.id}`} className="font-medium text-ink hover:underline">
                        {p.name}
                      </Link>
                      <Tags p={p} />
                    </td>
                    <td className="py-2.5 pr-3">
                      <Bar p={p} max={max} />
                    </td>
                    <td className="py-2.5 pr-3 font-display font-bold text-ink tabular-nums">{formatLoad(p.load)}</td>
                    <td className="py-2.5 pr-3">
                      <VsAverage p={p} />
                    </td>
                    {showGym && (
                      <td className="py-2.5">
                        <Gym g={p.gym} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length > PREVIEW && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((e) => !e)}
              className="inline-flex min-h-11 items-center text-sm font-medium text-brand-text underline"
            >
              {expanded ? "Ver menos" : `Ver los ${filtered.length} jugadores`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
