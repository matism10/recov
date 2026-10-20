"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { Ban, CircleAlert, CircleCheck, CircleHelp, Search, type LucideIcon } from "lucide-react";
import { matchesName } from "@/lib/search";
import {
  PITCH_LAYOUTS,
  pitchKind,
  shortPlayerName,
  shortPositionLabel,
  slotLabel,
  type PitchKind,
} from "@/lib/pitch";
import { EVENT_STATE_LABEL, type EventAvailabilityRow, type EventState } from "@/lib/events";
import { Avatar } from "@/app/avatar";
import {
  NO_POSITION,
  OnlyAvailableToggle,
  Pitch,
  PitchLayout,
  ViewToggle,
  type PitchMarker,
} from "@/app/pitch";
import {
  ErrorMessage,
  SectionTitle,
  SuccessMessage,
  buttonPrimary,
  buttonSecondary,
  cardClass,
  fieldClass,
  textButton,
} from "@/app/ui";
import { saveLineup, type CallupsState, type LineupEntry } from "./actions";

type Filter = EventState | "todos" | "convocados";
type Row = EventAvailabilityRow;

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
// Filas pintadas en "Todos" y "Convocados" para distinguir a los no disponibles.
const ROW_TINT: Record<EventState, string> = {
  ok: "",
  duda: "bg-revision-bg/60",
  no: "bg-lesionado-bg/60",
};

const chipButton = (active: boolean) =>
  `inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition ${
    active ? "border-brand-strong bg-brand-soft text-brand-text" : "border-line bg-white text-ink hover:bg-mist"
  }`;
const listClass = "divide-y divide-line overflow-hidden rounded-xl border border-line bg-mist";

export type NominaProps = {
  eventId: string;
  lineup: LineupEntry[];
  starters: number;
  bench: number;
};

// Jugadores del plantel con su disponibilidad para un evento. Con `nomina`
// (quien puede armarla, en un partido) se arma la nómina: en la lista se convoca
// con casillas; en la cancha se asigna cada puesto titular y de banca. Todo se
// guarda junto. Se puede convocar a un no disponible, con aviso.
export function AvailablePlayers({
  players,
  positions,
  sport = null,
  secondaryByPlayer = {},
  nomina = null,
}: {
  players: Row[];
  positions: string[];
  sport?: string | null;
  secondaryByPlayer?: Record<string, string>;
  nomina?: NominaProps | null;
}) {
  const kind = pitchKind(sport);
  const [view, setView] = useState<"lista" | "cancha">("lista");
  const [filter, setFilter] = useState<Filter>(
    nomina && nomina.lineup.length > 0 ? "convocados" : "ok",
  );
  const [sort, setSort] = useState<"posicion" | "nombre">("posicion");
  const [query, setQuery] = useState("");
  const [lineup, setLineup] = useState(
    () => new Map((nomina?.lineup ?? []).map((e) => [e.player_id, e.slot])),
  );
  const [saved, setSaved] = useState(() => serialize(nomina?.lineup ?? []));
  const [state, setState] = useState<CallupsState>({});
  const [pending, startTransition] = useTransition();

  const byId = new Map(players.map((p) => [p.player_id, p]));
  const starters = nomina?.starters ?? 0;
  const max = nomina ? nomina.starters + nomina.bench : 0;
  const entries: LineupEntry[] = [...lineup].map(([player_id, slot]) => ({ player_id, slot }));
  const dirty = serialize(entries) !== saved;
  const titulares = entries.filter((e) => e.slot !== null && e.slot <= starters).length;
  const banca = entries.filter((e) => e.slot !== null && e.slot > starters).length;
  const unavailable = entries.filter((e) => byId.get(e.player_id)?.state === "no").length;

  // Posición y orden del deporte.
  const primaryOf = (p: Row) => p.player_position ?? NO_POSITION;
  const rank = (name: string) => {
    if (name === NO_POSITION) return Number.MAX_SAFE_INTEGER;
    const i = positions.indexOf(name);
    return i === -1 ? positions.length : i;
  };
  const byName = (a: Row, b: Row) => a.full_name.localeCompare(b.full_name, "es");
  const byPosition = (a: Row, b: Row) => rank(primaryOf(a)) - rank(primaryOf(b)) || byName(a, b);

  // ---- cambios de la nómina ----------------------------------------------
  function update(next: Map<string, number | null>) {
    setState({});
    setLineup(next);
  }
  function toggle(id: string) {
    const next = new Map(lineup);
    if (next.has(id)) next.delete(id);
    else if (next.size >= max) {
      setState({ error: `La nómina admite hasta ${max} jugadores.` });
      return;
    } else next.set(id, null);
    update(next);
  }
  function assign(id: string, slot: number) {
    const replaced = [...lineup].find(([pid, s]) => s === slot && pid !== id)?.[0];
    // Un jugador nuevo cabe si hay cupo o si reemplaza a quien ocupaba el puesto.
    if (!lineup.has(id) && !replaced && lineup.size >= max) {
      setState({ error: `La nómina admite hasta ${max} jugadores.` });
      return;
    }
    const next = new Map(lineup);
    // Quien ocupaba el puesto sale de la nómina.
    if (replaced) next.delete(replaced);
    next.set(id, slot);
    update(next);
  }
  function clearSlot(slot: number) {
    const next = new Map(lineup);
    for (const [pid, s] of next) if (s === slot) next.set(pid, null);
    update(next);
  }
  function save() {
    if (!nomina) return;
    const payload = entries;
    startTransition(async () => {
      const result = await saveLineup(nomina.eventId, payload);
      if (result.ok) setSaved(serialize(payload));
      setState(result);
    });
  }

  const slotChip = (slot: number | null | undefined) => {
    if (slot === null || slot === undefined || !nomina) return null;
    const bench = slot > starters;
    return (
      <span
        className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
          bench ? "bg-white text-ink ring-1 ring-line" : "bg-brand-strong text-white"
        }`}
      >
        {bench ? `Banca ${slot}` : `N° ${slot}`}
      </span>
    );
  };

  // Fila de jugador de la lista: casilla, nombre, puesto y estado.
  function listRow(p: Row) {
    const checked = lineup.has(p.player_id);
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
          <span className="ml-2">{slotChip(lineup.get(p.player_id))}</span>
        </div>
        <StateBadge state={p.state} />
      </li>
    );
  }

  return (
    <div className="space-y-6">
      {nomina && (
        <div className="sticky top-0 z-10 -mx-4 space-y-2 border-b border-line bg-white px-4 py-3 lg:-mx-8 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink">
              <span className="font-semibold">{lineup.size}</span>{" "}
              {lineup.size === 1 ? "convocado" : "convocados"}
              <span className="text-muted">
                {" "}
                · Titulares {titulares}/{nomina.starters} · Banca {banca}/{nomina.bench}
              </span>
              {dirty && <span className="text-muted"> · sin guardar</span>}
            </p>
            <button
              type="button"
              onClick={save}
              disabled={pending || !dirty}
              className={`text-sm ${buttonPrimary}`}
            >
              {pending ? "Guardando…" : "Guarda la nómina"}
            </button>
          </div>
          {unavailable > 0 && (
            <p className="flex items-start gap-1.5 text-sm text-lesionado-fg">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {unavailable === 1
                ? "Convocaste a 1 jugador no disponible para esa fecha."
                : `Convocaste a ${unavailable} jugadores no disponibles para esa fecha.`}
            </p>
          )}
          {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
          {state.ok && !pending && !dirty && <SuccessMessage>Nómina guardada.</SuccessMessage>}
        </div>
      )}

      {kind && <ViewToggle view={view} onChange={setView} />}

      {view === "cancha" && kind ? (
        nomina ? (
          <LineupPitch
            kind={kind}
            nomina={nomina}
            players={players}
            lineup={lineup}
            secondaryByPlayer={secondaryByPlayer}
            byPosition={byPosition}
            primaryOf={primaryOf}
            pending={pending}
            onAssign={assign}
            onClear={clearSlot}
            slotChip={slotChip}
          />
        ) : (
          <PositionsPitch
            kind={kind}
            players={players}
            positions={positions}
            secondaryByPlayer={secondaryByPlayer}
            primaryOf={primaryOf}
            byName={byName}
          />
        )
      ) : (
        <ListView
          players={players}
          filters={nomina ? [{ value: "convocados", label: "Convocados" }, ...FILTERS] : FILTERS}
          filter={filter}
          onFilter={setFilter}
          sort={sort}
          onSort={setSort}
          query={query}
          onQuery={setQuery}
          isConvocado={(id) => lineup.has(id)}
          primaryOf={primaryOf}
          rank={rank}
          byName={byName}
          row={listRow}
        />
      )}
    </div>
  );
}

function serialize(entries: LineupEntry[]) {
  return JSON.stringify(
    [...entries]
      .sort((a, b) => a.player_id.localeCompare(b.player_id))
      .map((e) => [e.player_id, e.slot]),
  );
}

// ---------------------------------------------------------------------------
// Lista: búsqueda, filtros por disponibilidad y orden (por posición o nombre)
// ---------------------------------------------------------------------------
function ListView({
  players,
  filters,
  filter,
  onFilter,
  sort,
  onSort,
  query,
  onQuery,
  isConvocado,
  primaryOf,
  rank,
  byName,
  row,
}: {
  players: Row[];
  filters: { value: Filter; label: string }[];
  filter: Filter;
  onFilter: (f: Filter) => void;
  sort: "posicion" | "nombre";
  onSort: (s: "posicion" | "nombre") => void;
  query: string;
  onQuery: (q: string) => void;
  isConvocado: (id: string) => boolean;
  primaryOf: (p: Row) => string;
  rank: (name: string) => number;
  byName: (a: Row, b: Row) => number;
  row: (p: Row) => ReactNode;
}) {
  const count = (f: Filter) =>
    f === "todos"
      ? players.length
      : f === "convocados"
        ? players.filter((p) => isConvocado(p.player_id)).length
        : players.filter((p) => p.state === f).length;

  const q = query.trim();
  const visible = players
    .filter(
      (p) =>
        filter === "todos" ||
        (filter === "convocados" ? isConvocado(p.player_id) : p.state === filter),
    )
    .filter((p) => matchesName(p.full_name, q))
    .sort(byName);

  // Por posición: agrupados en el orden del deporte. Por nombre: una sola lista.
  const groups = new Map<string, Row[]>();
  for (const p of visible) groups.set(primaryOf(p), [...(groups.get(primaryOf(p)) ?? []), p]);
  const ordered = [...groups.entries()].sort(
    ([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, "es"),
  );

  return (
    <>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <label className="relative block">
            <span className="sr-only">Buscar jugador por nombre</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Buscar por nombre"
              className={`${fieldClass} pl-9`}
            />
          </label>
          <label>
            <span className="sr-only">Ordenar</span>
            <select
              value={sort}
              onChange={(e) => onSort(e.target.value as "posicion" | "nombre")}
              className={fieldClass}
            >
              <option value="posicion">Ordenar por posición</option>
              <option value="nombre">Ordenar por nombre</option>
            </select>
          </label>
        </div>
        <div role="group" aria-label="Filtrar por disponibilidad" className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => onFilter(f.value)}
              className={chipButton(filter === f.value)}
            >
              {f.label}
              <span className="text-xs font-normal text-muted">({count(f.value)})</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className={`p-5 text-sm text-muted ${cardClass}`}>
          {q
            ? "Ningún jugador coincide con la búsqueda."
            : filter === "convocados"
              ? "Todavía no hay convocados. Elige jugadores en los otros filtros o en la cancha."
              : "No hay jugadores en este grupo."}
        </p>
      ) : sort === "nombre" ? (
        <ul className={listClass}>{visible.map(row)}</ul>
      ) : (
        ordered.map(([position, list]) => (
          <section key={position}>
            <h2 className="mb-2 text-sm font-medium text-muted">
              {position} <span className="font-normal">({list.length})</span>
            </h2>
            <ul className={listClass}>{list.map(row)}</ul>
          </section>
        ))
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Cancha de la nómina: cada puesto titular y de banca se asigna a un jugador
// ---------------------------------------------------------------------------
function LineupPitch({
  kind,
  nomina,
  players,
  lineup,
  secondaryByPlayer,
  byPosition,
  primaryOf,
  pending,
  onAssign,
  onClear,
  slotChip,
}: {
  kind: PitchKind;
  nomina: NominaProps;
  players: Row[];
  lineup: Map<string, number | null>;
  secondaryByPlayer: Record<string, string>;
  byPosition: (a: Row, b: Row) => number;
  primaryOf: (p: Row) => string;
  pending: boolean;
  onAssign: (playerId: string, slot: number) => void;
  onClear: (slot: number) => void;
  slotChip: (slot: number | null | undefined) => ReactNode;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const byId = new Map(players.map((p) => [p.player_id, p]));
  const holder = (slot: number) => {
    for (const [pid, s] of lineup) if (s === slot) return byId.get(pid) ?? null;
    return null;
  };
  const choose = (slot: number) => setSelected(selected === slot ? null : slot);

  const spots = PITCH_LAYOUTS[kind].filter((s) => s.slot <= nomina.starters);
  const markers = spots.map((s) => {
    const h = holder(s.slot);
    return {
      key: `${s.slot}`,
      x: s.x,
      y: s.y,
      code: s.code,
      label: h ? shortPlayerName(h.full_name) : shortPositionLabel(s.position),
      active: selected === s.slot,
      filled: !!h,
      ariaLabel: `Puesto ${s.slot}, ${s.position}: ${h ? h.full_name : "vacío"}`,
      onClick: () => choose(s.slot),
    };
  });
  // Puestos titulares sin lugar en el dibujo (si el deporte tuviera más) y banca.
  const extraStarters = Array.from({ length: nomina.starters }, (_, i) => i + 1).filter(
    (n) => !spots.some((s) => s.slot === n),
  );
  const benchSlots = [
    ...extraStarters,
    ...Array.from({ length: nomina.bench }, (_, i) => nomina.starters + i + 1),
  ];
  const benchMarkers: PitchMarker[] = benchSlots.map((slot) => {
    const h = holder(slot);
    return {
      key: `${slot}`,
      code: String(slot),
      label: h ? shortPlayerName(h.full_name) : "—",
      active: selected === slot,
      filled: !!h,
      ariaLabel: `${slotLabel(kind, nomina.starters, slot)}: ${h ? h.full_name : "vacío"}`,
      onClick: () => choose(slot),
    };
  });

  const position =
    selected !== null ? spots.find((s) => s.slot === selected)?.position : undefined;
  const current = selected !== null ? holder(selected) : null;
  const avail = (list: Row[]) =>
    (onlyAvailable ? list.filter((p) => p.state === "ok") : list).sort(byPosition);
  const groups: { title: string; list: Row[]; folded?: boolean }[] = position
    ? [
        {
          title: `Juegan de ${position.toLowerCase()}`,
          list: avail(players.filter((p) => primaryOf(p) === position)),
        },
        {
          title: "También juegan aquí",
          list: avail(
            players.filter(
              (p) => secondaryByPlayer[p.player_id] === position && primaryOf(p) !== position,
            ),
          ),
        },
        {
          title: "Resto del plantel",
          folded: true,
          list: avail(
            players.filter(
              (p) => primaryOf(p) !== position && secondaryByPlayer[p.player_id] !== position,
            ),
          ),
        },
      ]
    : [{ title: "Plantel", list: avail([...players]) }];

  const assignRow = (p: Row) => {
    const slot = lineup.get(p.player_id);
    const here = selected !== null && slot === selected;
    return (
      <li
        key={p.player_id}
        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 sm:px-4"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={p.full_name} />
          <span className="min-w-0 font-medium break-words text-ink">{p.full_name}</span>
          {slotChip(slot)}
        </div>
        <div className="flex items-center gap-2">
          <StateBadge state={p.state} />
          {here ? (
            <span className="px-2 text-sm font-medium text-brand-text">En este puesto</span>
          ) : (
            <button
              type="button"
              onClick={() => selected !== null && onAssign(p.player_id, selected)}
              disabled={pending}
              aria-label={`${current ? `Reemplazar a ${current.full_name} por` : "Asignar a"} ${p.full_name}${
                slot ? ` (ahora en el ${slot})` : ""
              }`}
              className={`text-sm ${buttonSecondary}`}
            >
              {current ? "Reemplazar" : slot ? "Mover aquí" : "Asignar"}
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <PitchLayout
      selectedKey={selected}
      pitch={<Pitch kind={kind} markers={markers} bench={{ title: "Banca", markers: benchMarkers }} />}
      panel={
        selected === null ? (
          <p className={`p-5 text-sm text-muted ${cardClass}`}>
            Toca un puesto en la cancha o en la banca para elegir quién lo ocupa.
          </p>
        ) : (
          <section aria-live="polite" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-x-4">
              <SectionTitle>{slotLabel(kind, nomina.starters, selected)}</SectionTitle>
              <OnlyAvailableToggle checked={onlyAvailable} onChange={setOnlyAvailable} />
            </div>
            {current ? (
              <div className={`flex flex-wrap items-center justify-between gap-3 p-4 ${cardClass}`}>
                <p className="text-sm text-ink">
                  Lo ocupa <span className="font-semibold">{current.full_name}</span>
                </p>
                <button type="button" onClick={() => onClear(selected)} className={textButton}>
                  Quitar del puesto
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted">Puesto vacío: elige a un jugador.</p>
            )}
            {current && (
              <p className="text-sm text-muted">
                Si eliges a otro jugador, {current.full_name} sale de la nómina.
              </p>
            )}
            {groups.map((g) =>
              g.list.length === 0 ? null : g.folded ? (
                <details key={g.title}>
                  <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-brand-text underline">
                    {g.title} ({g.list.length})
                  </summary>
                  <ul className={`mt-2 ${listClass}`}>{g.list.map(assignRow)}</ul>
                </details>
              ) : (
                <div key={g.title} className="space-y-2">
                  <h3 className="text-sm font-medium text-muted">
                    {g.title} ({g.list.length})
                  </h3>
                  <ul className={listClass}>{g.list.map(assignRow)}</ul>
                </div>
              ),
            )}
            {groups.every((g) => g.list.length === 0) && (
              <p className={`p-5 text-sm text-muted ${cardClass}`}>No hay jugadores disponibles.</p>
            )}
          </section>
        )
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Cancha solo de lectura (staff sin permiso de nómina): jugadores por posición
// ---------------------------------------------------------------------------
function PositionsPitch({
  kind,
  players,
  positions,
  secondaryByPlayer,
  primaryOf,
  byName,
}: {
  kind: PitchKind;
  players: Row[];
  positions: string[];
  secondaryByPlayer: Record<string, string>;
  primaryOf: (p: Row) => string;
  byName: (a: Row, b: Row) => number;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const seen = new Set<string>();
  const markers = PITCH_LAYOUTS[kind]
    .filter((s) => positions.includes(s.position))
    .map((s) => {
      const first = !seen.has(s.position);
      seen.add(s.position);
      const list = players.filter((p) => primaryOf(p) === s.position);
      return {
        key: `${s.slot}`,
        x: s.x,
        y: s.y,
        code: s.code,
        label: shortPositionLabel(s.position),
        active: selected === s.position,
        ariaLabel: first
          ? `${s.position}: ${list.filter((p) => p.state === "ok").length} disponibles de ${list.length}`
          : undefined,
        onClick: () => setSelected(selected === s.position ? null : s.position),
      };
    });
  const avail = (list: Row[]) =>
    (onlyAvailable ? list.filter((p) => p.state === "ok") : list).sort(byName);
  const main = selected ? avail(players.filter((p) => primaryOf(p) === selected)) : [];
  const secondary = selected
    ? avail(
        players.filter(
          (p) => secondaryByPlayer[p.player_id] === selected && primaryOf(p) !== selected,
        ),
      )
    : [];
  const row = (p: Row) => (
    <li
      key={p.player_id}
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 sm:px-5"
    >
      <Link
        href={`/jugadores/${p.player_id}`}
        className="flex min-h-11 min-w-0 items-center gap-3 font-medium text-ink hover:underline"
      >
        <Avatar name={p.full_name} />
        <span className="min-w-0 break-words">{p.full_name}</span>
      </Link>
      <StateBadge state={p.state} />
    </li>
  );

  return (
    <PitchLayout
      selectedKey={selected}
      pitch={<Pitch kind={kind} markers={markers} />}
      panel={
        !selected ? (
          <p className={`p-5 text-sm text-muted ${cardClass}`}>
            Toca una posición en la cancha para ver sus jugadores.
          </p>
        ) : (
          <section aria-live="polite" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-x-4">
              <SectionTitle>{selected}</SectionTitle>
              <OnlyAvailableToggle checked={onlyAvailable} onChange={setOnlyAvailable} />
            </div>
            {main.length > 0 ? (
              <ul className={listClass}>{main.map(row)}</ul>
            ) : (
              <p className={`p-5 text-sm text-muted ${cardClass}`}>
                No hay jugadores en esta posición.
              </p>
            )}
            {secondary.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted">
                  También juegan aquí ({secondary.length})
                </h3>
                <ul className={listClass}>{secondary.map(row)}</ul>
              </div>
            )}
          </section>
        )
      }
    />
  );
}

function StateBadge({ state }: { state: EventState }) {
  const Icon = STATE_ICON[state];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ${STATE_BADGE[state]}`}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {EVENT_STATE_LABEL[state]}
    </span>
  );
}
