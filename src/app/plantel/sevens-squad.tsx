"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { matchesName } from "@/lib/search";
import { SEVENS_POSITIONS, sevensPositionLabel, type SevensMember } from "@/lib/sevens";
import { cardClass, fieldClass } from "@/app/ui";
import { PlayerRows } from "@/app/dashboard/player-row";
import type { SquadProps } from "@/app/dashboard/squad-list";

const chipButton = (active: boolean) =>
  `inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition ${
    active ? "border-brand-strong bg-brand-soft text-brand-text" : "border-line bg-white text-ink hover:bg-mist"
  }`;

// Plantel en Sevens: solo el grupo, con su posición de Sevens y chips por posición
// (coincide con la principal o la secundaria).
export function SevensSquad({
  sevensByUser,
  ...props
}: SquadProps & { sevensByUser: Record<string, SevensMember> }) {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("");

  const sevensOf = (userId: string | null) => (userId ? sevensByUser[userId] : undefined);
  const matchesPosition = (userId: string | null, pos: string) => {
    const m = sevensOf(userId);
    return m?.position === pos || m?.secondary_position === pos;
  };

  // La fila muestra la posición de Sevens en vez de la del 15.
  const rows = props.players.map((p) => ({ ...p, position: sevensPositionLabel(sevensOf(p.user_id)) }));
  const shown = rows.filter(
    (p) =>
      (query.trim() === "" || matchesName(p.full_name, query)) &&
      (position === "" || matchesPosition(p.user_id, position)),
  );

  return (
    <div className="space-y-4">
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
          placeholder="Buscar jugador"
          className={`${fieldClass} pl-9`}
        />
      </label>
      <div
        role="group"
        aria-label="Filtrar por posición en Sevens"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0"
      >
        <button
          type="button"
          aria-pressed={position === ""}
          onClick={() => setPosition("")}
          className={chipButton(position === "")}
        >
          Todas
        </button>
        {SEVENS_POSITIONS.map((pos) => (
          <button
            key={pos}
            type="button"
            aria-pressed={position === pos}
            onClick={() => setPosition(position === pos ? "" : pos)}
            className={chipButton(position === pos)}
          >
            {pos}
            <span className="text-xs font-normal text-muted">
              ({props.players.filter((p) => matchesPosition(p.user_id, pos)).length})
            </span>
          </button>
        ))}
      </div>
      {shown.length > 0 ? (
        <PlayerRows {...props} players={shown} />
      ) : (
        <p className={`p-5 text-sm text-muted ${cardClass}`}>Ningún jugador coincide con los filtros.</p>
      )}
    </div>
  );
}
