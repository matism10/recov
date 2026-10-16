"use client";

import Link from "next/link";
import { useState } from "react";
import { Ban, CircleCheck, CircleHelp, Search, type LucideIcon } from "lucide-react";
import { EVENT_STATE_LABEL, type EventAvailabilityRow, type EventState } from "@/lib/events";
import { Avatar } from "@/app/avatar";
import { cardClass, fieldClass } from "@/app/ui";

type Filter = EventState | "todos";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ok", label: "Disponibles" },
  { value: "duda", label: "En duda" },
  { value: "no", label: "No disponibles" },
  { value: "todos", label: "Todos" },
];

const STATE_ICON: Record<EventState, LucideIcon> = {
  ok: CircleCheck,
  duda: CircleHelp,
  no: Ban,
};
const STATE_BADGE: Record<EventState, string> = {
  ok: "bg-disponible-bg text-disponible-fg",
  duda: "bg-revision-bg text-revision-fg",
  no: "bg-lesionado-bg text-lesionado-fg",
};
// Filas pintadas en "Todos" para distinguir a los que no están disponibles.
const ROW_TINT: Record<EventState, string> = {
  ok: "",
  duda: "bg-revision-bg/60",
  no: "bg-lesionado-bg/60",
};

const NO_POSITION = "Sin posición";

// Sin tildes ni mayúsculas, para buscar "martin" y encontrar "Martín".
const normalize = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Filtro y búsqueda en el cliente: el plantel llega completo una sola vez.
export function AvailablePlayers({
  players,
  positions,
}: {
  players: EventAvailabilityRow[];
  positions: string[];
}) {
  const [filter, setFilter] = useState<Filter>("ok");
  const [query, setQuery] = useState("");

  const counts: Record<Filter, number> = {
    ok: players.filter((p) => p.state === "ok").length,
    duda: players.filter((p) => p.state === "duda").length,
    no: players.filter((p) => p.state === "no").length,
    todos: players.length,
  };

  const q = normalize(query.trim());
  const visible = players
    .filter((p) => filter === "todos" || p.state === filter)
    .filter((p) => !q || normalize(p.full_name).includes(q))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));

  // Agrupados por posición en el orden del deporte; las que no están en el
  // catálogo van después y los jugadores sin posición al final.
  const groups = new Map<string, EventAvailabilityRow[]>();
  for (const p of visible) {
    const key = p.player_position ?? NO_POSITION;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const rank = (name: string) => {
    if (name === NO_POSITION) return Number.MAX_SAFE_INTEGER;
    const i = positions.indexOf(name);
    return i === -1 ? positions.length : i;
  };
  const ordered = [...groups.entries()].sort(
    ([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, "es"),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label className="relative block">
          <span className="sr-only">Buscar jugador por nombre</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre"
            className={`${fieldClass} pl-9`}
          />
        </label>
        <div role="group" aria-label="Filtrar por disponibilidad" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f.value)}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition ${
                  active
                    ? "border-brand-strong bg-brand-soft text-brand-text"
                    : "border-line bg-white text-ink hover:bg-mist"
                }`}
              >
                {f.label}
                <span className="text-xs font-normal text-muted">({counts[f.value]})</span>
              </button>
            );
          })}
        </div>
      </div>

      {ordered.length === 0 ? (
        <p className={`p-5 text-sm text-muted ${cardClass}`}>
          {q ? "Ningún jugador coincide con la búsqueda." : "No hay jugadores en este grupo."}
        </p>
      ) : (
        ordered.map(([position, list]) => (
          <section key={position}>
            <h2 className="mb-2 text-sm font-medium text-muted">
              {position} <span className="font-normal">({list.length})</span>
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-mist">
              {list.map((p) => (
                <li
                  key={p.player_id}
                  className={`flex items-center justify-between gap-4 px-5 py-3 ${
                    filter === "todos" ? ROW_TINT[p.state] : ""
                  }`}
                >
                  <Link
                    href={`/jugadores/${p.player_id}`}
                    className="flex min-h-11 items-center gap-3 font-medium text-ink hover:underline"
                  >
                    <Avatar name={p.full_name} />
                    {p.full_name}
                  </Link>
                  <StateBadge state={p.state} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function StateBadge({ state }: { state: EventState }) {
  const Icon = STATE_ICON[state];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${STATE_BADGE[state]}`}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {EVENT_STATE_LABEL[state]}
    </span>
  );
}
