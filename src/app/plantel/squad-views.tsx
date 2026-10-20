"use client";

import { useState } from "react";
import { pitchKind } from "@/lib/pitch";
import { FilterableSquad } from "@/app/dashboard/squad-browser";
import { PlayerRows } from "@/app/dashboard/player-row";
import type { SquadProps } from "@/app/dashboard/squad-list";
import { NO_POSITION, Pitch, PitchLayout, ViewToggle } from "@/app/pitch";
import { SectionTitle, cardClass } from "@/app/ui";

// Plantel en lista (búsqueda y filtros) o en cancha (tocar una posición muestra
// sus jugadores). La cancha depende del deporte del club.
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
}: SquadProps & { kind: NonNullable<ReturnType<typeof pitchKind>>; positions: string[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const { players } = props;
  const primaryOf = (p: (typeof players)[number]) => p.position ?? NO_POSITION;

  // Todas las posiciones del deporte (también las vacías), más las que no están
  // en el catálogo y "Sin posición" si alguien no tiene.
  const extra = [
    ...new Set(players.map(primaryOf).filter((p) => p !== NO_POSITION && !positions.includes(p))),
  ].sort();
  const offered = [
    ...positions,
    ...extra,
    ...(players.some((p) => !p.position) ? [NO_POSITION] : []),
  ];
  const count = (pos: string) => players.filter((p) => primaryOf(p) === pos).length;

  const main = selected ? players.filter((p) => primaryOf(p) === selected) : [];
  const secondary = selected
    ? players.filter((p) => p.secondary_position === selected && primaryOf(p) !== selected)
    : [];

  return (
    <PitchLayout
      selectedKey={selected}
      pitch={
        <Pitch
          kind={kind}
          positions={offered}
          badge={(pos) => String(count(pos))}
          ariaCount={(pos) => (count(pos) === 1 ? "1 jugador" : `${count(pos)} jugadores`)}
          selected={selected}
          onSelect={setSelected}
        />
      }
      panel={
        !selected ? (
          <p className={`p-5 text-sm text-muted ${cardClass}`}>
            Toca una posición en la cancha para ver sus jugadores.
          </p>
        ) : (
          <section aria-live="polite" className="space-y-4">
            <div>
              <SectionTitle>{selected}</SectionTitle>
              <p className="text-sm text-muted">
                {main.length === 1 ? "1 jugador" : `${main.length} jugadores`}
              </p>
            </div>
            {main.length > 0 ? (
              <PlayerRows {...props} players={main} />
            ) : (
              <p className={`p-5 text-sm text-muted ${cardClass}`}>
                Nadie juega de {selected.toLowerCase()} como posición principal.
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
