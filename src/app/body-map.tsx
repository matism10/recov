// Mapa del cuerpo (Frente o Espalda) en SVG. Cada región lleva data-zone con el
// valor exacto del enum body_zone y data-side con el lado de la pantalla. La misma
// zona aparece en los dos lados y en las dos vistas, por eso no se usa el atributo
// id (debe ser único en la página).
//
// Sin hooks: con onPick es un input (registro de lesión, componente de cliente);
// sin onPick es solo lectura y se puede usar desde el servidor (ficha de la
// lesión, Resumen del staff).
import {
  BODY_ZONES,
  screenSideOf,
  suggestLaterality,
  zoneLabel,
  type BodyView,
  type BodyZone,
  type Laterality,
  type ScreenSide,
} from "@/lib/body-zones";

type Shape =
  | { kind: "rect"; x: number; y: number; w: number; h: number; rx: number }
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number };

type Region = { zone: BodyZone; side: ScreenSide; shapes: Shape[] };

const rect = (x: number, y: number, w: number, h: number, rx: number): Shape => ({ kind: "rect", x, y, w, h, rx });
const ellipse = (cx: number, cy: number, rx: number, ry: number): Shape => ({ kind: "ellipse", cx, cy, rx, ry });

const WIDTH = 200;
const HEIGHT = 416;

// Refleja una forma al otro lado de la pantalla.
function mirror(s: Shape): Shape {
  return s.kind === "rect" ? { ...s, x: WIDTH - s.x - s.w } : { ...s, cx: WIDTH - s.cx };
}

// Regiones del lado izquierdo de la pantalla; el derecho es su reflejo.
const LIMBS: Record<BodyView, [BodyZone, Shape][]> = {
  frente: [
    ["hombro", ellipse(60, 80, 15, 13)],
    ["biceps", rect(43, 94, 21, 50, 9)],
    ["codo", ellipse(51, 153, 12, 10)],
    ["antebrazo", rect(37, 164, 20, 46, 8)],
    ["mano", ellipse(45, 226, 12, 15)],
    ["cadera_ingle", rect(75, 174, 24, 30, 9)],
    ["cuadriceps", rect(75, 207, 23, 74, 10)],
    ["rodilla", ellipse(86, 294, 13, 11)],
    ["tibia", rect(77, 307, 19, 72, 9)],
    ["tobillo_pie", rect(71, 382, 26, 28, 9)],
  ],
  espalda: [
    ["hombro", ellipse(60, 80, 15, 13)],
    ["triceps", rect(43, 94, 21, 50, 9)],
    ["codo", ellipse(51, 153, 12, 10)],
    ["antebrazo", rect(37, 164, 20, 46, 8)],
    ["mano", ellipse(45, 226, 12, 15)],
    ["gluteo", rect(75, 174, 24, 36, 11)],
    ["isquiotibial", rect(75, 213, 23, 68, 10)],
    ["rodilla", ellipse(86, 294, 13, 11)],
    ["gemelo", rect(77, 307, 19, 72, 9)],
    ["tobillo_pie", rect(71, 382, 26, 28, 9)],
  ],
};

const CENTER: Record<BodyView, [BodyZone, Shape[]][]> = {
  frente: [
    ["cabeza_cuello", [ellipse(100, 32, 19, 23), rect(90, 51, 20, 15, 5)]],
    ["pecho", [rect(74, 68, 52, 50, 12)]],
    ["abdomen", [rect(77, 121, 46, 51, 10)]],
  ],
  espalda: [
    ["cabeza_cuello", [ellipse(100, 32, 19, 23), rect(90, 51, 20, 15, 5)]],
    ["espalda_alta", [rect(74, 68, 52, 58, 12)]],
    ["lumbar", [rect(77, 129, 46, 43, 10)]],
  ],
};

function regionsOf(view: BodyView): Region[] {
  return [
    ...CENTER[view].map(([zone, shapes]) => ({ zone, side: "centro" as const, shapes })),
    ...LIMBS[view].flatMap(([zone, shape]) => [
      { zone, side: "izq" as const, shapes: [shape] },
      { zone, side: "der" as const, shapes: [mirror(shape)] },
    ]),
  ];
}

export const BODY_REGIONS: Record<BodyView, Region[]> = {
  frente: regionsOf("frente"),
  espalda: regionsOf("espalda"),
};

export type BodyMark = { zone: BodyZone; laterality: Laterality };

// ¿La lesión (zona + lado) cae en esta región de esta vista?
function marks(region: Region, view: BodyView, mark: BodyMark) {
  if (region.zone !== mark.zone) return false;
  if (region.side === "centro") return true;
  return screenSideOf(mark.laterality, view).includes(region.side);
}

// Fondo según cuántas lesiones caen en la región (solo lectura).
function heatFill(count: number) {
  if (count <= 0) return "var(--color-surface-2)";
  if (count === 1) return "#fca5a5";
  if (count === 2) return "#f87171";
  return "var(--color-lesionado)";
}

export function regionLabel(region: Region, view: BodyView) {
  return zoneLabel(region.zone, suggestLaterality(region.zone, view, region.side));
}

export function BodyMap({
  view,
  selected,
  heat,
  onPick,
  className = "",
}: {
  view: BodyView;
  selected?: BodyMark | null; // input: la zona elegida
  heat?: BodyMark[]; // solo lectura: lesiones que se pintan
  onPick?: (zone: BodyZone, side: ScreenSide) => void;
  className?: string;
}) {
  const title = view === "frente" ? "Frente" : "Espalda";
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role={onPick ? "group" : "img"}
      aria-label={onPick ? `Cuerpo, vista de ${title.toLowerCase()}` : `Zonas lesionadas, vista de ${title.toLowerCase()}`}
      className={`block h-auto w-full select-none ${className}`}
    >
      {BODY_REGIONS[view].map((region) => {
        const key = `${region.zone}-${region.side}`;
        const label = regionLabel(region, view);
        const isSelected = !!selected && marks(region, view, selected);
        const count = heat ? heat.filter((m) => marks(region, view, m)).length : 0;
        const fill = onPick
          ? isSelected
            ? "var(--color-brand)"
            : "var(--color-surface-2)"
          : heatFill(count);
        const stroke = isSelected ? "var(--color-brand-strong)" : "#ffffff";
        const shapes = region.shapes.map((s, i) =>
          s.kind === "rect" ? (
            <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill={fill} stroke={stroke} strokeWidth={2} />
          ) : (
            <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={fill} stroke={stroke} strokeWidth={2} />
          ),
        );

        if (!onPick) {
          return (
            <g key={key} data-zone={region.zone} data-side={region.side}>
              <title>{count > 0 ? `${label}: ${count}` : label}</title>
              {shapes}
            </g>
          );
        }
        return (
          <g
            key={key}
            data-zone={region.zone}
            data-side={region.side}
            role="button"
            tabIndex={0}
            aria-label={label}
            aria-pressed={isSelected}
            onClick={() => onPick(region.zone, region.side)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPick(region.zone, region.side);
              }
            }}
            className="cursor-pointer outline-none transition-opacity hover:opacity-80 focus-visible:[&>*]:stroke-ink focus-visible:[&>*]:[stroke-width:3]"
          >
            <title>{label}</title>
            {shapes}
          </g>
        );
      })}
    </svg>
  );
}

// Nombre de la zona (sin lado) para listas y leyendas.
export function zoneName(zone: BodyZone) {
  return BODY_ZONES[zone].label;
}

// Frente y Espalda lado a lado, solo lectura (ficha de la lesión y Resumen).
export function BodyMapPair({ heat, className = "" }: { heat: BodyMark[]; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`}>
      {(["frente", "espalda"] as const).map((v) => (
        <figure key={v} className="min-w-0">
          <BodyMap view={v} heat={heat} />
          <figcaption className="mt-1 text-center text-xs font-medium tracking-wide text-muted uppercase">
            {v === "frente" ? "Frente" : "Espalda"}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
