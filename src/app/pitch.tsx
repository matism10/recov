"use client";

// Vista "cancha": la cancha del deporte del club con marcas tocables. Dentro del
// círculo va el código del puesto (número en rugby, iniciales en los demás) y
// debajo una etiqueta (la posición o el jugador que ocupa el puesto). La banca,
// si la hay, va en una columna al costado. Solo presentación: quien la usa
// decide qué marcas hay y qué pasa al tocarlas.
import { useEffect, useRef, type ReactNode } from "react";
import type { LabelSide, PitchKind } from "@/lib/pitch";

export const NO_POSITION = "Sin posición";

const GRASS = new Set<PitchKind>(["rugby", "sevens", "futbol", "hockey"]);

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
  markers: (PitchMarker & { x: number; y: number; labelSide?: LabelSide })[];
  bench?: { title: string; markers: PitchMarker[] };
  below?: ReactNode;
}) {
  // Sevens: cancha horizontal (como la imagen de referencia) y la banca en una franja
  // debajo. Resto: con banca, la misma superficie se ensancha: a la izquierda la cancha
  // y, junto a la línea lateral, la zona de la banca (dentro del verde).
  const landscape = kind === "sevens";
  const sideBench = bench && !landscape;
  return (
    <div className="space-y-3">
      <div
        role="group"
        aria-label="Cancha"
        className={`relative mx-auto w-full overflow-hidden ${landscape && bench ? "rounded-t-2xl" : "rounded-2xl"} ${
          landscape
            ? "aspect-[626/432] max-w-[640px]"
            : sideBench
              ? "aspect-[126/140] max-w-[480px]"
              : "aspect-[100/140] max-w-[420px]"
        } ${GRASS.has(kind) ? "bg-[#2f7d4c]" : "bg-[#c99560]"}`}
      >
        <div className={`absolute inset-y-0 left-0 ${sideBench ? "w-[79.4%]" : "w-full"}`}>
          <FieldLines kind={kind} />
          {markers.map((m) => (
            <div
              key={m.key}
              className="absolute"
              // El centro del círculo (36 px) cae en (x, y); con la etiqueta al lado, se
              // corre el botón para no mover el círculo.
              style={{
                left: `${m.x}%`,
                top: `${m.y}%`,
                transform:
                  m.labelSide === "right"
                    ? "translate(-22px, -50%)"
                    : m.labelSide === "left"
                      ? "translate(calc(-100% + 22px), -50%)"
                      : m.labelSide === "above"
                        ? "translate(-50%, calc(-100% + 18px))"
                        : "translate(-50%, -50%)",
              }}
            >
              <MarkerButton marker={m} onField side={m.labelSide ?? "below"} />
            </div>
          ))}
        </div>
        {sideBench && (
          <div
            role="group"
            aria-label={bench.title}
            className="absolute inset-y-0 right-0 flex w-[20.6%] flex-col items-center justify-evenly border-l-2 border-dashed border-white/60 bg-black/15 py-1"
          >
            <p className="rounded-full bg-white/90 px-2 py-px text-[10px] font-bold tracking-wide text-ink uppercase">
              {bench.title}
            </p>
            {bench.markers.map((m) => (
              <MarkerButton key={m.key} marker={m} onField compact />
            ))}
          </div>
        )}
      </div>
      {landscape && bench && (
        <div
          role="group"
          aria-label={bench.title}
          className="mx-auto -mt-3 flex w-full max-w-[640px] flex-wrap items-center justify-center gap-x-1 gap-y-1 rounded-b-2xl border-t-2 border-dashed border-white/60 bg-[#28703f] px-2 py-2"
        >
          <p className="rounded-full bg-white/90 px-2 py-px text-[10px] font-bold tracking-wide text-ink uppercase">
            {bench.title}
          </p>
          {bench.markers.map((m) => (
            <MarkerButton key={m.key} marker={m} onField compact />
          ))}
        </div>
      )}
      {below}
    </div>
  );
}

function MarkerButton({
  marker: m,
  onField = false,
  compact = false,
  side = "below",
}: {
  marker: PitchMarker;
  onField?: boolean;
  side?: LabelSide;
  compact?: boolean; // banca: círculo más chico para que entren todos los puestos
}) {
  const hidden = !m.ariaLabel;
  return (
    <button
      type="button"
      onClick={m.onClick}
      aria-pressed={hidden ? undefined : m.active}
      aria-hidden={hidden ? true : undefined}
      tabIndex={hidden ? -1 : 0}
      aria-label={m.ariaLabel}
      className={`flex min-h-11 min-w-11 items-center gap-0.5 rounded-xl px-1 outline-none focus-visible:ring-2 focus-visible:ring-white ${
        side === "right"
          ? "flex-row"
          : side === "left"
            ? "flex-row-reverse"
            : side === "above"
              ? "flex-col-reverse"
              : "flex-col"
      }`}
    >
      <span
        className={`flex items-center justify-center rounded-full border-2 text-xs font-bold tabular-nums shadow-sm transition ${
          compact ? "size-7" : "size-9"
        } ${
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
        className={`truncate rounded-full px-1.5 py-px leading-tight font-semibold ${
          compact ? "max-w-[64px] text-[9px]" : "max-w-[84px] text-[10px]"
        } ${
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
  if (kind === "sevens") {
    // Medio campo de Sevens como la imagen de referencia (626 × 432): línea de arriba
    // con su marca al medio, líneas de 5 m punteadas a los costados, la de 10 m
    // punteada y la de 22 m continua.
    const l = { stroke: "white", strokeOpacity: 0.8, strokeWidth: 3, fill: "none" };
    const d = { ...l, strokeDasharray: "12 10" };
    return (
      <svg aria-hidden="true" viewBox="0 0 626 432" preserveAspectRatio="none" className="absolute inset-0 size-full">
        {Array.from({ length: 6 }, (_, i) => (
          <rect key={i} x="0" y={i * 80} width="626" height="40" fill="white" fillOpacity="0.04" />
        ))}
        <line x1="0" y1="6" x2="626" y2="6" {...l} />
        <line x1="313" y1="0" x2="313" y2="14" {...l} />
        <line x1="38" y1="6" x2="38" y2="432" {...d} />
        <line x1="597" y1="6" x2="597" y2="432" {...d} />
        <line x1="0" y1="103" x2="626" y2="103" {...d} />
        <line x1="0" y1="245" x2="626" y2="245" {...l} />
        <line x1="18" y1="370" x2="52" y2="370" {...l} />
        <line x1="574" y1="378" x2="608" y2="378" {...l} />
      </svg>
    );
  }
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
