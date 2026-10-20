"use client";

// Vista "cancha": la cancha del deporte del club con marcas tocables. Dentro del
// círculo va el código del puesto (número en rugby, iniciales en los demás) y
// debajo una etiqueta (la posición o el jugador que ocupa el puesto). La banca,
// si la hay, va en una columna al costado. Solo presentación: quien la usa
// decide qué marcas hay y qué pasa al tocarlas.
import { useEffect, useRef, type ReactNode } from "react";
import type { PitchKind } from "@/lib/pitch";

export const NO_POSITION = "Sin posición";

const GRASS = new Set<PitchKind>(["rugby", "futbol", "hockey"]);

export type PitchMarker = {
  key: string;
  code: string;
  label: string;
  active: boolean;
  filled?: boolean; // puesto ocupado (nómina)
  ariaLabel?: string; // sin texto: la marca no se anuncia ni se enfoca (repetida)
  onClick: () => void;
};

export function Pitch({
  kind,
  markers,
  bench,
  below,
}: {
  kind: PitchKind;
  markers: (PitchMarker & { x: number; y: number })[];
  bench?: { title: string; markers: PitchMarker[] };
  below?: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className={`mx-auto flex max-w-[480px] gap-2 ${bench ? "" : "justify-center"}`}>
        <div
          role="group"
          aria-label="Cancha"
          className={`relative aspect-[100/140] min-w-0 flex-1 overflow-hidden rounded-2xl ${
            GRASS.has(kind) ? "bg-[#2f7d4c]" : "bg-[#c99560]"
          } ${bench ? "" : "max-w-[420px]"}`}
        >
          <FieldLines kind={kind} />
          {markers.map((m) => (
            <div
              key={m.key}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${m.x}%`, top: `${m.y}%` }}
            >
              <MarkerButton marker={m} onField />
            </div>
          ))}
        </div>
        {bench && (
          <div
            role="group"
            aria-label={bench.title}
            className="flex w-16 shrink-0 flex-col items-center gap-1 rounded-2xl bg-mist py-2"
          >
            <p className="text-[11px] font-semibold text-muted">{bench.title}</p>
            {bench.markers.map((m) => (
              <MarkerButton key={m.key} marker={m} />
            ))}
          </div>
        )}
      </div>
      {below}
    </div>
  );
}

function MarkerButton({ marker: m, onField = false }: { marker: PitchMarker; onField?: boolean }) {
  const hidden = !m.ariaLabel;
  return (
    <button
      type="button"
      onClick={m.onClick}
      aria-pressed={hidden ? undefined : m.active}
      aria-hidden={hidden ? true : undefined}
      tabIndex={hidden ? -1 : 0}
      aria-label={m.ariaLabel}
      className="flex min-h-11 min-w-11 flex-col items-center gap-0.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand-strong"
    >
      <span
        className={`flex size-9 items-center justify-center rounded-full border-2 text-xs font-bold tabular-nums shadow-sm transition ${
          m.active
            ? "border-white bg-brand text-ink"
            : m.filled
              ? "border-white bg-brand-strong text-white"
              : onField
                ? "border-white/90 bg-white text-ink"
                : "border-dashed border-muted bg-white text-ink"
        }`}
      >
        {m.code}
      </span>
      <span
        className={`max-w-[84px] truncate rounded-full px-1.5 py-px text-[10px] leading-tight font-semibold ${
          m.active
            ? "bg-brand text-ink"
            : onField
              ? "bg-ink/70 text-white"
              : m.filled
                ? "text-ink"
                : "text-muted"
        }`}
      >
        {m.label}
      </span>
    </button>
  );
}

// Lista de lo elegido bajo (celular) o al lado (escritorio) de la cancha.
// En celular, al elegir algo la página baja hasta su lista.
export function PitchLayout({
  pitch,
  panel,
  selectedKey,
}: {
  pitch: ReactNode;
  panel: ReactNode;
  selectedKey: string | number | null;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedKey !== null && !window.matchMedia("(min-width: 1024px)").matches) {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedKey]);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)] lg:items-start">
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

// "Solo disponibles": filtro de la lista de una posición.
export function OnlyAvailableToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 accent-brand-strong"
      />
      Solo disponibles
    </label>
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
