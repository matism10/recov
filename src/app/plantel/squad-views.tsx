"use client";

import { useState } from "react";
import { PITCH_LAYOUTS, pitchKind, shortPositionLabel, type PitchKind } from "@/lib/pitch";
import { FilterableSquad } from "@/app/dashboard/squad-browser";
import { PlayerRows } from "@/app/dashboard/player-row";
import type { SquadProps } from "@/app/dashboard/squad-list";
import { NO_POSITION, OnlyAvailableToggle, Pitch, PitchLayout, ViewToggle } from "@/app/pitch";
import { SectionTitle, cardClass } from "@/app/ui";

// Plantel en lista (búsqueda, filtros y orden) o en cancha (tocar una posición
// muestra sus jugadores). La cancha depende del deporte del club.
export function SquadViews({
  sport,
  positions,
  ...props
}: SquadProps & { sport: string | null; positions: string[] }) {
  const kind = pitchKind(sport);
  const [view, setView] = useState<"lista" | "cancha">("lista");

  return (
    <div className="space-y-4">
      {kind && <ViewToggle view={view} onChange={setView} />}
      {view === "cancha" && kind ? (
        <SquadPitch kind={kind} positions={positions} {...props} />
      ) : (
        <FilterableSquad positions={positions} {...props} />
      )}
    </div>
  );
}

function SquadPitch({
  kind,
  positions,
  ...props
}: SquadProps & { kind: PitchKind; positions: string[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const { players } = props;
  const primaryOf = (p: (typeof players)[number]) => p.position ?? NO_POSITION;
  const count = (pos: string) => players.filter((p) => primaryOf(p) === pos).length;
  const countLabel = (pos: string) => (count(pos) === 1 ? "1 jugador" : `${count(pos)} jugadores`);
  const choose = (pos: string) => setSelected(selected === pos ? null : pos);

  // Marcas: los puestos titulares del deporte. Las repetidas (dos pilares) eligen
  // la misma posición; solo la primera se anuncia y se enfoca.
  const seen = new Set<string>();
  const markers = PITCH_LAYOUTS[kind]
    .filter((s) => positions.includes(s.position))
    .map((s) => {
      const first = !seen.has(s.position);
      seen.add(s.position);
      return {
        key: `${s.slot}`,
        x: s.x,
        y: s.y,
        code: s.code,
        label: shortPositionLabel(s.position),
        active: selected === s.position,
        ariaLabel: first ? `${s.position}: ${countLabel(s.position)}` : undefined,
        onClick: () => choose(s.position),
      };
    });

  // Posiciones sin marca: las del catálogo que no están en la cancha, las que no
  // están en el catálogo y "Sin posición".
  const loose = [
    ...positions.filter((p) => !PITCH_LAYOUTS[kind].some((s) => s.position === p)),
    ...[...new Set(players.map(primaryOf))]
      .filter((p) => p !== NO_POSITION && !positions.includes(p))
      .sort(),
    ...(players.some((p) => !p.position) ? [NO_POSITION] : []),
  ];

  const available = (list: typeof players) =>
    onlyAvailable ? list.filter((p) => p.availability === "disponible") : list;
  const main = selected ? available(players.filter((p) => primaryOf(p) === selected)) : [];
  const secondary = selected
    ? available(players.filter((p) => p.secondary_position === selected && primaryOf(p) !== selected))
    : [];

  return (
    <PitchLayout
      selectedKey={selected}
      pitch={
        <Pitch
          kind={kind}
          markers={markers}
          below={
            loose.length > 0 && (
              <div role="group" aria-label="Otras posiciones" className="flex flex-wrap justify-center gap-2">
                {loose.map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={selected === p}
                    onClick={() => choose(p)}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition ${
                      selected === p
                        ? "border-brand-strong bg-brand-soft text-brand-text"
                        : "border-line bg-white text-ink hover:bg-mist"
                    }`}
                  >
                    {p}
                    <span className="text-xs font-normal text-muted">({count(p)})</span>
                  </button>
                ))}
              </div>
            )
          }
        />
      }
      panel={
        !selected ? (
          <p className={`p-5 text-sm text-muted ${cardClass}`}>
            Toca una posición en la cancha para ver sus jugadores.
          </p>
        ) : (
          <section aria-live="polite" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-x-4">
              <div>
                <SectionTitle>{selected}</SectionTitle>
                <p className="text-sm text-muted">{countLabel(selected)}</p>
              </div>
              <OnlyAvailableToggle checked={onlyAvailable} onChange={setOnlyAvailable} />
            </div>
            {main.length > 0 ? (
              <PlayerRows {...props} players={main} />
            ) : (
              <p className={`p-5 text-sm text-muted ${cardClass}`}>
                {onlyAvailable
                  ? "No hay jugadores disponibles en esta posición."
                  : `Nadie juega de ${selected.toLowerCase()} como posición principal.`}
              </p>
            )}
            {secondary.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted">
                  También juegan aquí ({secondary.length})
                </h3>
                <PlayerRows {...props} players={secondary} />
              </div>
            )}
          </section>
        )
      }
    />
  );
}
