"use client";

import Link from "next/link";
import { useState } from "react";
import { Search } from "lucide-react";
import { AVAILABILITY_LABEL, type Availability } from "@/lib/roles";
import { matchesName } from "@/lib/search";
import type { SquadPlayer } from "@/lib/squad";
import { Avatar } from "@/app/avatar";
import {
  AVAILABILITY_STRIPE,
  AVAILABILITY_TEXT,
  AvailabilityBadge,
  cardClass,
  fieldClass,
  textButton,
} from "@/app/ui";
import { AvailabilitySelect } from "@/app/dashboard/availability-select";
import { PlayerIdentity, markInjuryClass } from "@/app/dashboard/squad-list";

// Grupos de la lista: primero los no disponibles.
const GROUP_ORDER: Availability[] = ["lesionado", "en_revision", "reintegro", "disponible"];
// Orden del recuento: disponibles primero (la cifra protagonista).
const COUNT_ORDER: Availability[] = ["disponible", "en_revision", "lesionado", "reintegro"];

const NO_POSITION = "Sin posición";

// "7 disponibles · 1 en revisión · 1 lesionado · 1 en reintegro"
function countLabel(state: Availability, n: number) {
  if (state === "disponible") return n === 1 ? "disponible" : "disponibles";
  if (state === "lesionado") return n === 1 ? "lesionado" : "lesionados";
  return state === "en_revision" ? "en revisión" : "en reintegro";
}

// Plantel (Dirección A): recuento por estado (cada cifra filtra), buscador y lista
// agrupada por estado con franja de color. Mismas acciones que antes: el selector de
// disponibilidad y "Marcar lesión" para quien gestiona lesiones; la ficha para el staff.
export function GroupedSquad({
  players,
  positions,
  avatarUrls,
  phaseByPlayer,
  canManage,
  linkToProfile,
}: {
  players: SquadPlayer[];
  positions: string[];
  avatarUrls: Map<string, string>;
  phaseByPlayer: Map<string, string>;
  canManage: boolean;
  linkToProfile: boolean;
}) {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("");
  const [state, setState] = useState<Availability | "">("");

  const present = new Set(players.map((p) => p.position ?? NO_POSITION));
  const positionOptions = [
    ...positions.filter((p) => present.has(p)),
    ...[...present].filter((p) => p !== NO_POSITION && !positions.includes(p)).sort(),
    ...(present.has(NO_POSITION) ? [NO_POSITION] : []),
  ];

  // El recuento respeta la búsqueda y la posición; el filtro por estado se aplica después.
  const base = players.filter(
    (p) => matchesName(p.full_name, query) && (!position || (p.position ?? NO_POSITION) === position),
  );
  const count = (s: Availability) => base.filter((p) => p.availability === s).length;
  const visible = base.filter((p) => !state || p.availability === state);
  const filtered = query.trim() !== "" || position !== "" || state !== "";

  return (
    <div className="space-y-6">
      {/* Recuento: cada cifra es un botón que filtra la lista. */}
      <div role="group" aria-label="Filtrar por disponibilidad" className="grid grid-cols-3 gap-x-2 gap-y-1 lg:flex lg:items-end lg:gap-6">
        {COUNT_ORDER.map((s) => {
          const n = count(s);
          const hero = s === "disponible";
          const active = state === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => setState(active ? "" : s)}
              className={`flex min-h-11 flex-col items-start rounded-md px-2 py-1 text-left transition ${
                hero ? "col-span-3" : ""
              } ${active ? "bg-surface-2" : "hover:bg-mist"}`}
            >
              <span
                className={`font-bold tabular-nums ${AVAILABILITY_TEXT[s]} ${
                  hero ? "text-[44px] leading-[48px]" : "text-[28px] leading-8"
                }`}
              >
                {n}
              </span>
              <span className="text-sm text-muted">{countLabel(s, n)}</span>
            </button>
          );
        })}
      </div>

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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar jugador"
            className={`${fieldClass} pl-9`}
          />
        </label>
        <label className="block">
          <span className="sr-only">Filtrar por posición</span>
          <select value={position} onChange={(e) => setPosition(e.target.value)} className={fieldClass}>
            <option value="">Todas las posiciones</option>
            {positionOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtered && (
        <p role="status" className="flex flex-wrap items-center gap-x-3 text-sm text-muted">
          {visible.length === 1 ? "1 jugador" : `${visible.length} jugadores`}
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setPosition("");
              setState("");
            }}
            className={textButton}
          >
            Limpiar filtros
          </button>
        </p>
      )}

      {visible.length === 0 ? (
        <p className={`p-5 text-sm text-muted ${cardClass}`}>Ningún jugador coincide con los filtros.</p>
      ) : (
        GROUP_ORDER.map((s) => {
          const group = visible
            .filter((p) => p.availability === s)
            .sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));
          if (group.length === 0) return null;
          return (
            <section key={s}>
              <h2 className="mb-2 flex items-baseline gap-2 font-sans text-lg font-bold text-ink">
                {AVAILABILITY_LABEL[s]}
                <span className="text-sm font-semibold text-muted tabular-nums">{group.length}</span>
              </h2>
              <ul className="space-y-2">
                {group.map((p) => (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    avatarUrl={p.user_id ? avatarUrls.get(p.user_id) : null}
                    phase={phaseByPlayer.get(p.id)}
                    canManage={canManage}
                    linkToProfile={linkToProfile}
                  />
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

// Fila de 64 px: franja de estado de 4 px, avatar de 40, nombre 17/600, posición y
// fase en 14 y, a la derecha, el badge o (para quien gestiona) el selector y la acción.
function PlayerRow({
  player: p,
  avatarUrl,
  phase,
  canManage,
  linkToProfile,
}: {
  player: SquadPlayer;
  avatarUrl: string | null | undefined;
  phase: string | undefined;
  canManage: boolean;
  linkToProfile: boolean;
}) {
  const status = p.availability as Availability;
  // "En revisión" no se cambia a mano: lo resuelve la revisión de la lesión.
  const editable = canManage && status !== "en_revision";
  return (
    <li className="relative overflow-hidden rounded-xl bg-mist">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${AVAILABILITY_STRIPE[status]}`} />
      <div className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 py-3 pr-4 pl-5">
        <div className="min-w-0 flex-1">
          <PlayerIdentity playerId={p.id} linkToProfile={linkToProfile}>
            <Avatar name={p.full_name} url={avatarUrl} size="md" />
            <div className="min-w-0">
              <p className="text-[17px] leading-6 font-semibold break-words text-ink group-hover:underline">
                {p.full_name}
              </p>
              {(p.position || phase) && (
                <p className="text-sm text-muted">{[p.position, phase].filter(Boolean).join(" · ")}</p>
              )}
            </div>
          </PlayerIdentity>
        </div>
        {editable ? (
          // Móvil: en su propia línea, alineado con el nombre. Escritorio: a la derecha.
          <div className="flex w-full items-center justify-between gap-4 pl-[52px] lg:w-auto lg:pl-0">
            <AvailabilitySelect playerId={p.id} playerName={p.full_name} value={status} />
            <Link href={`/lesiones/marcar/${p.id}`} className={markInjuryClass}>
              Marcar lesión
            </Link>
          </div>
        ) : (
          <AvailabilityBadge status={status} />
        )}
      </div>
    </li>
  );
}
