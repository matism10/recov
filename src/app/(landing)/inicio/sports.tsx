"use client";

import { useState } from "react";
import { PITCH_LAYOUTS, shortPositionLabel, type PitchKind } from "@/lib/pitch";
import { Pitch, ViewToggle, type PitchMarker } from "@/app/pitch";
import { Avatar } from "@/app/avatar";
import { AvailabilityBadge } from "@/app/ui";
import type { Availability } from "@/lib/roles";
import { BrowserFrame } from "./frame";

const SPORTS: { id: PitchKind; label: string; icon: React.ReactNode }[] = [
  { id: "rugby", label: "Rugby", icon: <><ellipse cx="12" cy="12" rx="9" ry="5.5" transform="rotate(-35 12 12)" /><path d="M8.5 15.5l7-7M10.5 13.5l1.5 1.5M12.5 11.5L14 13" /></> },
  { id: "futbol", label: "Fútbol", icon: <><circle cx="12" cy="12" r="9" /><path d="M12 8l3.5 2.5-1.3 4h-4.4l-1.3-4z" /></> },
  { id: "futsal", label: "Futsal", icon: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></> },
  { id: "handball", label: "Handball", icon: <><circle cx="12" cy="12" r="9" /><path d="M5 6c4 3 10 3 14 0M5 18c4-3 10-3 14 0" /></> },
  { id: "voleibol", label: "Vóleibol", icon: <><circle cx="12" cy="12" r="9" /><path d="M12 3c0 6 3 9 8 10M12 3c-1 5-4 8-8 9M7 20c3-5 7-6 11-5" /></> },
  { id: "basquetbol", label: "Básquetbol", icon: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3v18M5.5 5.5c3 3 3 10 0 13M18.5 5.5c-3 3-3 10 0 13" /></> },
  { id: "hockey", label: "Hockey césped", icon: <><path d="M6 3l5 13c.7 2 3 2.6 5 2" /><circle cx="19" cy="18" r="1.6" /></> },
];

const STRIPE: Record<string, string> = { disponible: "bg-disponible", lesionado: "bg-lesionado", reintegro: "bg-reintegro" };

const NAMES = [
  "Camilo Reyes", "Joaquín Ferrada", "Matías Olivares", "Benjamín Soto", "Tomás Aravena", "Nicolás Pardo", "Felipe Zúñiga",
  "Diego Contreras", "Sebastián Lagos", "Ignacio Vera", "Martín Carrasco", "Lucas Bravo", "Cristóbal Muñoz", "Vicente Rojas",
  "Agustín Fuentes", "Gaspar Tapia", "Emilio Navarro", "Renato Campos", "Bruno Salinas", "Maximiliano Díaz",
];
const STATUS_ORDER: Availability[] = ["disponible", "disponible", "disponible", "lesionado", "disponible", "reintegro", "disponible"];

function playersFor(position: string, index: number) {
  return STATUS_ORDER.map((status, i) => ({
    name: NAMES[(index * 5 + i * 3) % NAMES.length],
    status,
    phase: status === "lesionado" ? "Rehabilitación" : status === "reintegro" ? "Reintegro" : undefined,
    position,
  }));
}

export function Sports() {
  const [sport, setSport] = useState<PitchKind>("rugby");
  return (
    <div>
      <div role="group" aria-label="Deporte" className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-2 lg:mx-0 lg:flex-wrap lg:px-0">
        {SPORTS.map((s) => {
          const on = s.id === sport;
          return (
            <button
              key={s.id}
              aria-pressed={on}
              onClick={() => setSport(s.id)}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-5 font-bold transition ${on ? "bg-[#38BDF8] text-[#04263D]" : "bg-[#12304A] text-white hover:bg-[#1a4468]"}`}
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{s.icon}</svg>
              {s.label}
            </button>
          );
        })}
      </div>
      <Replica key={sport} kind={sport} />
    </div>
  );
}

function Replica({ kind }: { kind: PitchKind }) {
  const layout = PITCH_LAYOUTS[kind];
  const positions = [...new Set(layout.map((l) => l.position))];
  const [selected, setSelected] = useState(positions[0]);
  const [only, setOnly] = useState(false);
  const idx = positions.indexOf(selected);
  const all = playersFor(selected, idx);
  const list = only ? all.filter((p) => p.status === "disponible") : all;
  const markers = layout.map<PitchMarker & { x: number; y: number }>((l) => ({
    key: String(l.slot), code: l.code, label: shortPositionLabel(l.position), active: l.position === selected,
    ariaLabel: `${l.position}`, onClick: () => setSelected(l.position), x: l.x, y: l.y,
  }));
  return (
    <BrowserFrame className="mt-6 text-[#0E1B2C]">
      <div className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-[family-name:var(--l-title)] text-2xl font-extrabold tracking-tight">Plantel</p>
            <p className="text-sm text-[#5B6675]">{positions.length * 7} jugadores</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#5B6675]">
            Vista:
            <ViewToggle view="cancha" onChange={() => {}} />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start">
          <Pitch kind={kind} markers={markers} />
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-[family-name:var(--l-title)] text-lg font-bold">{selected}</p>
                <p className="text-sm text-[#5B6675]">{all.length} jugadores</p>
              </div>
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} className="size-5 accent-[#0284c7]" />
                Solo disponibles
              </label>
            </div>
            <ul className="space-y-2">
              {list.map((p) => (
                <li key={p.name} className="relative overflow-hidden rounded-xl bg-[#F7F8FA]">
                  <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${STRIPE[p.status]}`} />
                  <div className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 py-3 pr-4 pl-5">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar name={p.name} size="md" />
                      <div className="min-w-0">
                        <p className="text-[17px] leading-6 font-semibold">{p.name}</p>
                        <p className="text-sm text-[#5B6675]">{[p.position, p.phase].filter(Boolean).join(" · ")}</p>
                      </div>
                    </div>
                    <AvailabilityBadge status={p.status} />
                    <span className="inline-flex min-h-11 items-center text-sm font-medium whitespace-nowrap text-[#0369a1] underline">Marcar lesión</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}
