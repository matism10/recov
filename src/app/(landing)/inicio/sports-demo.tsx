"use client";

import { useState } from "react";
import { PITCH_LAYOUTS, shortPositionLabel, type PitchKind } from "@/lib/pitch";
import { Pitch } from "@/app/pitch";
import { Avatar } from "@/app/avatar";
import { AvailabilityBadge } from "@/app/ui";
import type { Availability } from "@/lib/roles";

// Pantalla interactiva de Deportes: los deportes son botones que cambian la cancha, y al
// tocar un puesto se ven los jugadores de esa posición. Datos ficticios, solo presentación.
const SPORTS: { id: Exclude<PitchKind, "sevens">; label: string }[] = [
  { id: "rugby", label: "Rugby" },
  { id: "futbol", label: "Fútbol" },
  { id: "futsal", label: "Futsal" },
  { id: "handball", label: "Handball" },
  { id: "voleibol", label: "Vóleibol" },
  { id: "basquetbol", label: "Básquetbol" },
  { id: "hockey", label: "Hockey césped" },
];

const NAMES = [
  "Camilo Reyes", "Joaquín Ferrada", "Matías Olivares", "Benjamín Soto", "Tomás Aravena", "Nicolás Pardo",
  "Felipe Zúñiga", "Diego Contreras", "Sebastián Lagos", "Ignacio Vera", "Martín Carrasco", "Lucas Bravo",
  "Cristóbal Muñoz", "Vicente Rojas", "Agustín Fuentes", "Gaspar Tapia", "Emilio Navarro", "Renato Campos",
  "Bruno Salinas", "Maximiliano Díaz", "Julián Molina", "Bastián Ortiz", "Simón Leiva", "Andrés Valdés",
];

type DemoPlayer = { name: string; status: Availability; detail: string };

// Tres jugadores por posición: casi siempre uno lesionado o en reintegro, para mostrar los estados.
function playersFor(kind: PitchKind, position: string, index: number): DemoPlayer[] {
  const seed = [...`${kind}${position}`].reduce((a, c) => a + c.charCodeAt(0), 0);
  const name = (i: number) => NAMES[(seed + index * 7 + i * 5) % NAMES.length];
  const third: DemoPlayer =
    index % 3 === 0
      ? { name: name(2), status: "lesionado", detail: "Rehabilitación · vuelve el 12 dic" }
      : index % 3 === 1
        ? { name: name(2), status: "reintegro", detail: "Reintegro · vuelve el 2 dic" }
        : { name: name(2), status: "disponible", detail: "Carga dentro de lo habitual" };
  return [
    { name: name(0), status: "disponible", detail: "Carga dentro de lo habitual" },
    { name: name(1), status: "disponible", detail: index % 2 ? "Carga alta esta semana" : "Carga dentro de lo habitual" },
    third,
  ];
}

export function SportsDemo() {
  const [sport, setSport] = useState<(typeof SPORTS)[number]["id"]>("rugby");
  const [sevens, setSevens] = useState(false);
  const kind: PitchKind = sport === "rugby" && sevens ? "sevens" : sport;

  return (
    <>
      <ul className="lp-pills" aria-label="Elige un deporte">
        {SPORTS.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              aria-pressed={s.id === sport}
              aria-controls="lp-sport-screen"
              onClick={() => {
                setSport(s.id);
                setSevens(false);
              }}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ul>
      <Screen key={kind} kind={kind} sport={SPORTS.find((s) => s.id === sport)!.label} sevens={sport === "rugby" ? { on: sevens, set: setSevens } : null} />
    </>
  );
}

function Screen({ kind, sport, sevens }: { kind: PitchKind; sport: string; sevens: { on: boolean; set: (v: boolean) => void } | null }) {
  const layout = PITCH_LAYOUTS[kind];
  const positions = [...new Set(layout.map((l) => l.position))];
  const [selected, setSelected] = useState(positions[0]);
  const index = positions.indexOf(selected);
  const players = playersFor(kind, selected, index);
  const total = positions.length * 3;

  return (
    <div id="lp-sport-screen" className="lp-screen">
      <div className="lp-screen-bar">
        <div>
          <p className="lp-screen-title">Plantel</p>
          <p className="lp-screen-sub">
            {sport}{kind === "sevens" ? " · Sevens" : ""} · {total} jugadores
          </p>
        </div>
        {sevens && (
          <div role="group" aria-label="Formato de rugby" className="lp-toggle lp-toggle-sm">
            <button type="button" aria-pressed={!sevens.on} onClick={() => sevens.set(false)}>Rugby 15</button>
            <button type="button" aria-pressed={sevens.on} onClick={() => sevens.set(true)}>Sevens</button>
          </div>
        )}
      </div>
      <div className="lp-screen-body">
        <div className="lp-screen-pitch">
          <Pitch
            kind={kind}
            markers={layout.map((l) => ({
              key: String(l.slot),
              code: l.code,
              label: shortPositionLabel(l.position),
              active: l.position === selected,
              ariaLabel: `Ver jugadores de ${l.position}`,
              onClick: () => setSelected(l.position),
              x: l.x,
              y: l.y,
              labelSide: l.labelSide,
            }))}
          />
          <p className="lp-screen-hint">Toca un puesto para ver a sus jugadores.</p>
        </div>
        <div className="lp-screen-list" aria-live="polite">
          <p className="lp-screen-pos">{selected}</p>
          <p className="lp-screen-sub">{players.length} jugadores · datos ficticios</p>
          <ul>
            {players.map((p) => (
              <li key={p.name} data-status={p.status}>
                <Avatar name={p.name} size="md" />
                <div className="lp-screen-player">
                  <p>{p.name}</p>
                  <p>{p.detail}</p>
                </div>
                <AvailabilityBadge status={p.status} />
              </li>
            ))}
          </ul>
          <div className="lp-legend" aria-hidden="true">
            <span><i style={{ background: "#16a34a" }} />Disponible</span>
            <span><i style={{ background: "#dc2626" }} />Lesionado</span>
            <span><i style={{ background: "#7c3aed" }} />Reintegro</span>
          </div>
        </div>
      </div>
    </div>
  );
}
