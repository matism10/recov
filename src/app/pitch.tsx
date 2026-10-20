"use client";

// Vista "cancha": la cancha del deporte del club con una marca por posición de
// juego. Tocar una marca elige esa posición (las marcas repetidas, como los dos
// pilares, eligen la misma). Las posiciones sin marca y "Sin posición" van como
// botones bajo la cancha. Solo presentación: el padre decide qué listar.
import { useEffect, useRef, type ReactNode } from "react";
import { PITCH_LAYOUTS, shortPositionLabel, type PitchKind } from "@/lib/pitch";

export const NO_POSITION = "Sin posición";

const GRASS = new Set<PitchKind>(["rugby", "futbol", "hockey"]);

export function Pitch({
  kind,
  positions,
  badge,
  ariaCount,
  selected,
  onSelect,
}: {
  kind: PitchKind;
  // Posiciones a ofrecer, en el orden del deporte (incluida NO_POSITION si aplica).
  positions: string[];
  // Texto de la marca (p. ej. "6" o "3/6").
  badge: (position: string) => string;
  // Texto para lectores de pantalla (p. ej. "6 jugadores").
  ariaCount: (position: string) => string;
  selected: string | null;
  onSelect: (position: string | null) => void;
}) {
  const slots = PITCH_LAYOUTS[kind].filter((s) => positions.includes(s.position));
  const placed = new Set(slots.map((s) => s.position));
  const loose = positions.filter((p) => !placed.has(p));
  const seen = new Set<string>();

  return (
    <div className="space-y-3">
      <div
        role="group"
        aria-label="Cancha: elige una posición"
        className={`relative mx-auto aspect-[100/140] w-full max-w-[420px] overflow-hidden rounded-2xl ${
          GRASS.has(kind) ? "bg-[#2f7d4c]" : "bg-[#c99560]"
        }`}
      >
        <FieldLines kind={kind} />
        {slots.map((s, i) => {
          // Solo la primera marca de cada posición se enfoca y se anuncia.
          const first = !seen.has(s.position);
          seen.add(s.position);
          const active = selected === s.position;
          return (
            <button
              key={`${s.position}-${i}`}
              type="button"
              onClick={() => onSelect(active ? null : s.position)}
              aria-pressed={first ? active : undefined}
              aria-hidden={first ? undefined : true}
              tabIndex={first ? 0 : -1}
              aria-label={first ? `${s.position}: ${ariaCount(s.position)}` : undefined}
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
              className="absolute flex min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <span
                className={`flex size-9 items-center justify-center rounded-full border-2 text-xs font-bold tabular-nums shadow-sm transition ${
                  active
                    ? "border-white bg-brand text-ink"
                    : "border-white/90 bg-white text-ink"
                }`}
              >
                {badge(s.position)}
              </span>
              <span
                className={`max-w-[84px] truncate rounded-full px-1.5 py-px text-[10px] leading-tight font-semibold ${
                  active ? "bg-brand text-ink" : "bg-ink/70 text-white"
                }`}
              >
                {shortPositionLabel(s.position)}
              </span>
            </button>
          );
        })}
      </div>

      {loose.length > 0 && (
        <div role="group" aria-label="Otras posiciones" className="flex flex-wrap justify-center gap-2">
          {loose.map((p) => {
            const active = selected === p;
            return (
              <button
                key={p}
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(active ? null : p)}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition ${
                  active
                    ? "border-brand-strong bg-brand-soft text-brand-text"
                    : "border-line bg-white text-ink hover:bg-mist"
                }`}
              >
                {p}
                <span className="text-xs font-normal text-muted">({badge(p)})</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Lista de la posición elegida bajo (celular) o al lado (escritorio) de la cancha.
// En celular, al elegir una posición la página baja hasta su lista.
export function PitchLayout({
  pitch,
  panel,
  selectedKey,
}: {
  pitch: ReactNode;
  panel: ReactNode;
  selectedKey: string | null;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedKey && !window.matchMedia("(min-width: 1024px)").matches) {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedKey]);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start">
      <div className="lg:sticky lg:top-4">{pitch}</div>
      <div ref={panelRef} className="min-w-0 scroll-mt-28">
        {panel}
      </div>
    </div>
  );
}

// Cambio entre lista y cancha.
export function ViewToggle({
  view,
  onChange,
}: {
  view: "lista" | "cancha";
  onChange: (view: "lista" | "cancha") => void;
}) {
  return (
    <div role="group" aria-label="Vista" className="inline-flex rounded-xl border border-line bg-white p-1">
      {(["lista", "cancha"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => onChange(v)}
          className={`min-h-9 rounded-lg px-4 text-sm font-medium transition ${
            view === v ? "bg-brand-soft text-brand-text" : "text-ink hover:bg-mist"
          }`}
        >
          {v === "lista" ? "Lista" : "Cancha"}
        </button>
      ))}
    </div>
  );
}

// Líneas de la cancha (blancas) según el deporte, en un viewBox de 100 × 140.
function FieldLines({ kind }: { kind: PitchKind }) {
  const line = { stroke: "white", strokeOpacity: 0.75, strokeWidth: 0.6, fill: "none" };
  const dash = { ...line, strokeDasharray: "2 2" };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 140"
      preserveAspectRatio="none"
      className="absolute inset-0 size-full"
    >
      {GRASS.has(kind) &&
        Array.from({ length: 7 }, (_, i) => (
          <rect key={i} x="0" y={i * 20} width="100" height="10" fill="white" fillOpacity="0.04" />
        ))}
      <rect x="4" y="4" width="92" height="132" {...line} />
      {kind === "rugby" && (
        <>
          <line x1="4" y1="14" x2="96" y2="14" {...line} />
          <line x1="4" y1="126" x2="96" y2="126" {...line} />
          <line x1="4" y1="70" x2="96" y2="70" {...line} />
          <line x1="4" y1="38" x2="96" y2="38" {...line} />
          <line x1="4" y1="102" x2="96" y2="102" {...line} />
          <line x1="4" y1="58" x2="96" y2="58" {...dash} />
          <line x1="4" y1="82" x2="96" y2="82" {...dash} />
          <path d="M45 14 V6 M55 14 V6 M45 10 H55 M45 126 V134 M55 126 V134 M45 130 H55" {...line} strokeWidth={0.9} />
        </>
      )}
      {(kind === "futbol" || kind === "futsal") && (
        <>
          <line x1="4" y1="70" x2="96" y2="70" {...line} />
          <circle cx="50" cy="70" r="9" {...line} />
          {kind === "futbol" ? (
            <>
              <rect x="22" y="4" width="56" height="18" {...line} />
              <rect x="37" y="4" width="26" height="7" {...line} />
              <rect x="22" y="118" width="56" height="18" {...line} />
              <rect x="37" y="129" width="26" height="7" {...line} />
            </>
          ) : (
            <>
              <path d="M28 4 A22 18 0 0 0 72 4" {...line} />
              <path d="M28 136 A22 18 0 0 1 72 136" {...line} />
            </>
          )}
        </>
      )}
      {kind === "hockey" && (
        <>
          <line x1="4" y1="70" x2="96" y2="70" {...line} />
          <line x1="4" y1="36" x2="96" y2="36" {...dash} />
          <line x1="4" y1="104" x2="96" y2="104" {...dash} />
          <path d="M26 4 A24 20 0 0 0 74 4" {...line} />
          <path d="M26 136 A24 20 0 0 1 74 136" {...line} />
        </>
      )}
      {kind === "handball" && (
        <>
          <line x1="4" y1="70" x2="96" y2="70" {...line} />
          <path d="M22 4 A28 20 0 0 0 78 4" {...line} />
          <path d="M14 4 A36 30 0 0 0 86 4" {...dash} />
          <path d="M22 136 A28 20 0 0 1 78 136" {...line} />
          <path d="M14 136 A36 30 0 0 1 86 136" {...dash} />
        </>
      )}
      {kind === "basquetbol" && (
        <>
          <rect x="34" y="4" width="32" height="30" {...line} />
          <circle cx="50" cy="34" r="10" {...line} />
          <path d="M10 4 V24 A40 40 0 0 0 90 24 V4" {...line} />
          <circle cx="50" cy="10" r="2" {...line} />
          <path d="M40 136 A10 10 0 0 1 60 136" {...line} />
        </>
      )}
      {kind === "voleibol" && (
        <>
          <line x1="4" y1="4" x2="96" y2="4" stroke="white" strokeWidth={1.6} />
          <line x1="4" y1="47" x2="96" y2="47" {...line} />
        </>
      )}
    </svg>
  );
}
