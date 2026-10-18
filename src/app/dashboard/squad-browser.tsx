"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { AVAILABILITY_LABEL, type Availability } from "@/lib/roles";
import { matchesName } from "@/lib/search";
import { cardClass, fieldClass, labelClass, textButton } from "@/app/ui";
import { Squad } from "./squad";
import { PlayerRow } from "./player-row";
import type { SquadProps } from "./squad-list";

const AVAILABILITY_FILTERS: Availability[] = ["disponible", "en_revision", "lesionado", "reintegro"];
const NO_POSITION = "Sin posición";

const chipButton = (active: boolean) =>
  `inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition ${
    active
      ? "border-brand-strong bg-brand-soft text-brand-text"
      : "border-line bg-white text-ink hover:bg-mist"
  }`;

function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="relative block">
      <span className="sr-only">Buscar jugador por nombre</span>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar jugador"
        className={`${fieldClass} pl-9`}
      />
    </label>
  );
}

// Resumen: sin búsqueda muestra la selección del servidor (primeros disponibles);
// al escribir, busca en todo el plantel.
export function SummarySquad({
  shown,
  emptyText,
  ...props
}: SquadProps & { shown: SquadProps["players"]; emptyText: string }) {
  const [query, setQuery] = useState("");
  const searching = query.trim() !== "";
  const players = searching ? props.players.filter((p) => matchesName(p.full_name, query)) : shown;

  return (
    <div className="space-y-3">
      <SearchField value={query} onChange={setQuery} />
      {players.length > 0 ? (
        <Squad {...props} players={players} />
      ) : (
        <p className={`p-5 text-sm text-muted ${cardClass}`}>
          {searching ? "Ningún jugador coincide con la búsqueda." : emptyText}
        </p>
      )}
    </div>
  );
}

// Plantel completo: búsqueda, filtro por posición (orden del deporte) y por
// disponibilidad. Todo en el cliente: el plantel llega completo una vez. Cada
// jugador va en una fila con franja de estado (PlayerRow), en celular y escritorio.
export function FilterableSquad({
  positions,
  ...props
}: SquadProps & { positions: string[] }) {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("");
  const [availability, setAvailability] = useState<Availability | "">("");

  // Solo las posiciones que tiene alguien del plantel, en el orden del deporte.
  const present = new Set(props.players.map((p) => p.position ?? NO_POSITION));
  const positionOptions = [
    ...positions.filter((p) => present.has(p)),
    ...[...present].filter((p) => p !== NO_POSITION && !positions.includes(p)).sort(),
    ...(present.has(NO_POSITION) ? [NO_POSITION] : []),
  ];

  // Los conteos de disponibilidad respetan la búsqueda y la posición elegidas.
  const base = props.players.filter(
    (p) =>
      matchesName(p.full_name, query) &&
      (!position || (p.position ?? NO_POSITION) === position),
  );
  const players = base.filter((p) => !availability || p.availability === availability);
  const filtered = query.trim() !== "" || position !== "" || availability !== "";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem]">
        <SearchField value={query} onChange={setQuery} />
        <label className={labelClass}>
          <span className="sr-only">Filtrar por posición</span>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className={fieldClass}
          >
            <option value="">Todas las posiciones</option>
            {positionOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>
      {/* Hasta lg: una sola fila con scroll horizontal, de borde a borde. */}
      <div
        role="group"
        aria-label="Filtrar por disponibilidad"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0"
      >
        <button
          type="button"
          aria-pressed={availability === ""}
          onClick={() => setAvailability("")}
          className={chipButton(availability === "")}
        >
          Todos <span className="text-xs font-normal text-muted">({base.length})</span>
        </button>
        {AVAILABILITY_FILTERS.map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={availability === a}
            onClick={() => setAvailability(availability === a ? "" : a)}
            className={chipButton(availability === a)}
          >
            {AVAILABILITY_LABEL[a]}
            <span className="text-xs font-normal text-muted">
              ({base.filter((p) => p.availability === a).length})
            </span>
          </button>
        ))}
      </div>

      {filtered && (
        <p role="status" className="flex flex-wrap items-center gap-x-3 text-sm text-muted">
          {players.length === 1 ? "1 jugador" : `${players.length} jugadores`}
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setPosition("");
              setAvailability("");
            }}
            className={textButton}
          >
            Limpiar filtros
          </button>
        </p>
      )}

      {players.length > 0 ? (
        <ul className="space-y-2">
          {players.map((p) => (
            <PlayerRow
              key={p.id}
              player={p}
              avatarUrl={p.user_id ? props.avatarUrls.get(p.user_id) : null}
              phase={props.phaseByPlayer.get(p.id)}
              canManage={props.canManage}
              linkToProfile={props.linkToProfile}
            />
          ))}
        </ul>
      ) : (
        <p className={`p-5 text-sm text-muted ${cardClass}`}>
          Ningún jugador coincide con los filtros.
        </p>
      )}
    </div>
  );
}
