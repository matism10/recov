"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Ban, CircleAlert, CircleCheck, CircleHelp, Search, type LucideIcon } from "lucide-react";
import { matchesName } from "@/lib/search";
import { pitchKind } from "@/lib/pitch";
import { Pitch, PitchLayout, ViewToggle } from "@/app/pitch";
import { EVENT_STATE_LABEL, type EventAvailabilityRow, type EventState } from "@/lib/events";
import { Avatar } from "@/app/avatar";
import {
  ErrorMessage,
  SectionTitle,
  SuccessMessage,
  buttonPrimary,
  cardClass,
  fieldClass,
} from "@/app/ui";
import { saveCallups, type CallupsState } from "./actions";

type Filter = EventState | "todos" | "convocados";

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

// Filtro y búsqueda en el cliente: el plantel llega completo una sola vez.
// Con `nomina`, cada jugador tiene una casilla para la convocatoria y se guarda
// todo junto; se puede convocar a un no disponible, con aviso. En la vista
// cancha, tocar una posición muestra sus jugadores (con las mismas casillas).
export function AvailablePlayers({
  players,
  positions,
  sport = null,
  secondaryByPlayer = {},
  nomina = null,
}: {
  players: EventAvailabilityRow[];
  positions: string[];
  sport?: string | null;
  secondaryByPlayer?: Record<string, string>;
  nomina?: { eventId: string; selected: string[] } | null;
}) {
  const kind = pitchKind(sport);
  const [view, setView] = useState<"lista" | "cancha">("lista");
  const [pitchPosition, setPitchPosition] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(
    nomina && nomina.selected.length > 0 ? "convocados" : "ok",
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => new Set(nomina?.selected ?? []));
  const [saved, setSaved] = useState(() => new Set(nomina?.selected ?? []));
  const [state, setState] = useState<CallupsState>({});
  const [pending, startTransition] = useTransition();

  const counts: Record<Filter, number> = {
    ok: players.filter((p) => p.state === "ok").length,
    duda: players.filter((p) => p.state === "duda").length,
    no: players.filter((p) => p.state === "no").length,
    todos: players.length,
    convocados: players.filter((p) => selected.has(p.player_id)).length,
  };
  const filters = nomina
    ? [{ value: "convocados" as Filter, label: "Convocados" }, ...FILTERS]
    : FILTERS;

  const q = query.trim();
  const visible = players
    .filter(
      (p) =>
        filter === "todos" ||
        (filter === "convocados" ? selected.has(p.player_id) : p.state === filter),
    )
    .filter((p) => matchesName(p.full_name, q))
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

  const unavailableSelected = players.filter(
    (p) => selected.has(p.player_id) && p.state === "no",
  ).length;
  const dirty = selected.size !== saved.size || [...selected].some((id) => !saved.has(id));

  // Vista cancha: jugadores por posición principal y por secundaria.
  const primaryOf = (p: EventAvailabilityRow) => p.player_position ?? NO_POSITION;
  const byPrimary = (pos: string) => players.filter((p) => primaryOf(p) === pos);
  const bySecondary = (pos: string) =>
    players.filter((p) => secondaryByPlayer[p.player_id] === pos && primaryOf(p) !== pos);
  const sortByName = (list: EventAvailabilityRow[]) =>
    [...list].sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));
  const pitchPositions = [
    ...positions,
    ...[...new Set(players.map(primaryOf))]
      .filter((p) => p !== NO_POSITION && !positions.includes(p))
      .sort(),
    ...(players.some((p) => !p.player_position) ? [NO_POSITION] : []),
  ];

  // Fila de jugador (lista y cancha): casilla de convocatoria, nombre y estado.
  function renderRow(p: EventAvailabilityRow) {
    const checked = selected.has(p.player_id);
    return (
      <li
        key={p.player_id}
        className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 sm:px-5 ${
          filter === "todos" || filter === "convocados" ? ROW_TINT[p.state] : ""
        }`}
      >
        <div className="flex min-w-0 items-center gap-1">
          {nomina && (
            <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(p.player_id)}
                disabled={pending}
                className="size-5 accent-brand-strong"
              />
              <span className="sr-only">Convocar a {p.full_name}</span>
            </label>
          )}
          <Link
            href={`/jugadores/${p.player_id}`}
            className="flex min-h-11 min-w-0 items-center gap-3 font-medium text-ink hover:underline"
          >
            <Avatar name={p.full_name} />
            <span className="min-w-0 break-words">{p.full_name}</span>
          </Link>
        </div>
        <StateBadge state={p.state} />
      </li>
    );
  }

  function toggle(id: string) {
    setState({});
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    if (!nomina) return;
    const ids = [...selected];
    startTransition(async () => {
      const result = await saveCallups(nomina.eventId, ids);
      if (result.ok) setSaved(new Set(ids));
      setState(result);
    });
  }

  return (
    <div className="space-y-6">
      {nomina && (
        <div className="sticky top-0 z-10 -mx-4 space-y-2 border-b border-line bg-white px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink">
              <span className="font-semibold">{selected.size}</span>{" "}
              {selected.size === 1 ? "convocado" : "convocados"}
              {dirty && <span className="text-muted"> · sin guardar</span>}
            </p>
            <button
              type="button"
              onClick={save}
              disabled={pending || !dirty}
              className={`text-sm ${buttonPrimary}`}
            >
              {pending ? "Guardando…" : "Guarda la convocatoria"}
            </button>
          </div>
          {unavailableSelected > 0 && (
            <p className="flex items-start gap-1.5 text-sm text-lesionado-fg">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {unavailableSelected === 1
                ? "Convocaste a 1 jugador no disponible para esa fecha."
                : `Convocaste a ${unavailableSelected} jugadores no disponibles para esa fecha.`}
            </p>
          )}
          {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
          {state.ok && !pending && !dirty && (
            <SuccessMessage>Convocatoria guardada.</SuccessMessage>
          )}
        </div>
      )}

      {kind && <ViewToggle view={view} onChange={setView} />}

      {view === "cancha" && kind ? (
        <PitchLayout
          selectedKey={pitchPosition}
          pitch={
            <Pitch
              kind={kind}
              positions={pitchPositions}
              badge={(pos) => {
                const list = byPrimary(pos);
                const n = nomina
                  ? list.filter((p) => selected.has(p.player_id)).length
                  : list.filter((p) => p.state === "ok").length;
                return `${n}/${list.length}`;
              }}
              ariaCount={(pos) => {
                const list = byPrimary(pos);
                const n = nomina
                  ? list.filter((p) => selected.has(p.player_id)).length
                  : list.filter((p) => p.state === "ok").length;
                return `${n} ${nomina ? "convocados" : "disponibles"} de ${list.length}`;
              }}
              selected={pitchPosition}
              onSelect={setPitchPosition}
            />
          }
          panel={
            !pitchPosition ? (
              <p className={`p-5 text-sm text-muted ${cardClass}`}>
                Toca una posición en la cancha para ver sus jugadores
                {nomina ? " y convocarlos." : "."}
              </p>
            ) : (
              <section aria-live="polite" className="space-y-4">
                <div>
                  <SectionTitle>{pitchPosition}</SectionTitle>
                  <p className="text-sm text-muted">
                    {byPrimary(pitchPosition).length === 1
                      ? "1 jugador"
                      : `${byPrimary(pitchPosition).length} jugadores`}
                  </p>
                </div>
                {byPrimary(pitchPosition).length > 0 ? (
                  <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-mist">
                    {sortByName(byPrimary(pitchPosition)).map(renderRow)}
                  </ul>
                ) : (
                  <p className={`p-5 text-sm text-muted ${cardClass}`}>
                    Nadie juega de {pitchPosition.toLowerCase()} como posición principal.
                  </p>
                )}
                {bySecondary(pitchPosition).length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted">
                      También juegan aquí ({bySecondary(pitchPosition).length})
                    </h3>
                    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-mist">
                      {sortByName(bySecondary(pitchPosition)).map(renderRow)}
                    </ul>
                  </div>
                )}
              </section>
            )
          }
        />
      ) : (
        <>
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
            <div
              role="group"
              aria-label="Filtrar por disponibilidad"
              className="flex flex-wrap gap-2"
            >
              {filters.map((f) => {
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
              {q
                ? "Ningún jugador coincide con la búsqueda."
                : filter === "convocados"
                  ? "Todavía no hay convocados. Elige jugadores en los otros filtros."
                  : "No hay jugadores en este grupo."}
            </p>
          ) : (
            ordered.map(([position, list]) => (
              <section key={position}>
                <h2 className="mb-2 text-sm font-medium text-muted">
                  {position} <span className="font-normal">({list.length})</span>
                </h2>
                <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-mist">
                  {list.map(renderRow)}
                </ul>
              </section>
            ))
          )}
        </>
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
