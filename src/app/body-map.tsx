// Mapa del cuerpo (Frente o Espalda): figura anatómica en SVG, oscura sobre un
// panel oscuro, con las zonas resaltadas. Cada región lleva data-zone con el valor
// exacto del enum body_zone y data-side con el lado de la pantalla. La misma zona
// aparece en los dos lados y en las dos vistas, por eso no se usa el atributo id
// (debe ser único en la página).
//
// Las formas se dibujan para la mitad izquierda de la pantalla (x < 100); la
// derecha es su reflejo. Las regiones centrales (cabeza, pecho, abdomen, espalda
// alta, lumbar) se arman con una mitad y su reflejo.
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

const WIDTH = 200;
const HEIGHT = 430;
const MIRROR = `translate(${WIDTH} 0) scale(-1 1)`;

// Colores de la figura (panel oscuro, como las láminas anatómicas).
export const BODY_PANEL_CLASS = "rounded-2xl bg-[#141a24] p-4";
export const BODY_CAPTION_CLASS =
  "mt-2 text-center text-xs font-medium tracking-wide text-white/60 uppercase";
const BASE = "#3a4352";
const LINE = "#141a24";
const DETAIL = "#2a313d";
const SELECTED = "#38bdf8"; // celeste de marca
// Cantidad de lesiones en la zona (solo lectura): 1, 2, 3 o más.
export const HEAT_COLORS = ["#f5b82e", "#f97316", "#ef4444"] as const;

// ---------------------------------------------------------------------------
// Formas (mitad izquierda de la pantalla)
// ---------------------------------------------------------------------------
const HEAD =
  "M100,6 C113,6 120,16 120,30 C120,44 112,54 100,54 C88,54 80,44 80,30 C80,16 87,6 100,6 Z";
const DELTOID =
  "M76,71 C66,66 52,69 47,82 C44,92 45,102 49,110 C54,104 60,100 64,97 C66,88 70,79 76,71 Z";
const UPPER_ARM =
  "M49,112 C44,122 41,136 41,149 C46,152 52,152 57,150 C59,136 61,118 63,100 C57,103 52,107 49,112 Z";
const ELBOW =
  "M41,151 C46,154 52,154 57,152 C57,158 56,163 55,167 C49,168 43,167 38,165 C39,160 40,155 41,151 Z";
const FOREARM =
  "M38,167 C43,169 49,170 55,169 C54,185 50,204 46,222 C42,223 37,223 33,222 C32,202 34,183 38,167 Z";
const HAND =
  "M33,224 C37,225 42,225 46,224 C48,232 48,244 45,254 C42,260 36,261 32,257 C29,248 29,234 33,224 Z";
const KNEE =
  "M72,290 C78,292 86,292 92,290 C93,298 92,306 90,312 C84,314 78,314 73,312 C71,305 71,297 72,290 Z";

const FRONT = {
  neck: "M91,48 C91,56 88,63 74,69 L100,71 L100,54 C96,54 93,52 91,48 Z",
  pec: "M100,73 L78,72 C71,80 67,88 65,98 C67,112 77,120 90,120 C96,120 99,118 100,116 Z",
  abs: "M100,122 C95,123 90,122 86,121 C85,138 85,156 87,172 C91,179 96,183 100,184 Z",
  oblique: "M64,101 C62,113 63,125 66,137 C66,150 66,162 68,174 L86,173 C84,156 84,138 85,121 C76,120 68,113 64,101 Z",
  hip: "M68,176 L88,175 C92,182 96,188 100,192 L100,208 C96,210 92,208 88,204 C80,198 72,194 66,192 C66,186 67,181 68,176 Z",
  quad: "M66,194 C72,196 80,200 88,206 C92,210 96,212 98,214 C97,240 94,264 92,288 C86,290 78,290 72,288 C66,264 62,236 64,212 C64,206 65,200 66,194 Z",
  shin: "M73,314 C79,316 85,316 90,314 C91,334 90,356 88,384 C84,386 80,386 77,384 C72,360 70,336 73,314 Z",
  foot: "M77,386 C81,388 85,388 88,386 C89,394 92,404 94,414 C94,420 88,422 80,421 C74,420 70,418 72,412 C75,404 76,394 77,386 Z",
};

const BACK = {
  neck: "M91,48 C92,56 91,62 89,66 L100,67 L100,54 C96,54 93,52 91,48 Z",
  trap: "M89,67 C85,70 80,71 76,71 C85,78 93,92 100,112 L100,68 Z",
  lat: "M75,73 C69,81 66,92 65,104 C67,122 73,140 84,156 L100,160 L100,114 C92,94 85,82 75,73 Z",
  lowerSide: "M65,107 C63,126 65,150 68,170 C74,164 79,160 84,157 C74,141 68,124 65,107 Z",
  lumbar: "M85,158 L100,162 L100,186 C92,185 82,181 70,172 C75,166 80,161 85,158 Z",
  glute: "M70,173 C82,182 92,186 100,187 L100,214 C94,220 84,222 76,218 C68,212 64,200 66,187 C67,182 68,177 70,173 Z",
  hamstring: "M66,206 C70,216 78,222 88,222 C92,222 96,220 98,218 C97,244 94,266 92,288 C86,290 78,290 72,288 C66,264 63,236 66,206 Z",
  calf: "M73,314 C79,316 85,316 90,314 C94,330 93,350 89,370 C87,378 85,384 83,387 L78,387 C72,370 68,345 73,314 Z",
  heel: "M78,389 L86,389 C88,398 91,408 91,416 C89,422 80,422 76,418 C75,408 76,398 78,389 Z",
};

// Líneas de músculo decorativas (no se tocan): mitad izquierda, se reflejan.
const DETAILS: Record<BodyView, string[]> = {
  frente: [
    "M87,139 L100,139",
    "M87,155 L100,155",
    "M88,170 L100,170",
    "M80,212 C81,236 82,262 84,286",
    "M70,230 C72,250 74,268 76,286",
    "M50,118 C51,128 51,138 50,146",
    "M82,322 C83,342 83,362 82,380",
  ],
  espalda: [
    "M100,70 L100,186",
    "M82,226 C82,246 82,266 82,286",
    "M81,320 C82,338 82,356 81,372",
    "M52,116 C53,126 53,136 52,146",
    "M78,96 C82,110 88,124 96,136",
  ],
};

// ---------------------------------------------------------------------------
// Regiones
// ---------------------------------------------------------------------------
type Part = { d: string; mirrored: boolean };
type Region = { zone: BodyZone; side: ScreenSide; parts: Part[] };

// Región central: cada forma más su reflejo (la cabeza ya es simétrica).
function center(zone: BodyZone, shapes: string[], whole: string[] = []): Region {
  return {
    zone,
    side: "centro",
    parts: [
      ...whole.map((d) => ({ d, mirrored: false })),
      ...shapes.flatMap((d) => [
        { d, mirrored: false },
        { d, mirrored: true },
      ]),
    ],
  };
}

// Región lateral: una a cada lado de la pantalla.
function sides(zone: BodyZone, shapes: string[]): Region[] {
  return [
    { zone, side: "izq", parts: shapes.map((d) => ({ d, mirrored: false })) },
    { zone, side: "der", parts: shapes.map((d) => ({ d, mirrored: true })) },
  ];
}

export const BODY_REGIONS: Record<BodyView, Region[]> = {
  frente: [
    center("cabeza_cuello", [FRONT.neck], [HEAD]),
    center("pecho", [FRONT.pec]),
    center("abdomen", [FRONT.abs, FRONT.oblique]),
    ...sides("hombro", [DELTOID]),
    ...sides("biceps", [UPPER_ARM]),
    ...sides("codo", [ELBOW]),
    ...sides("antebrazo", [FOREARM]),
    ...sides("mano", [HAND]),
    ...sides("cadera_ingle", [FRONT.hip]),
    ...sides("cuadriceps", [FRONT.quad]),
    ...sides("rodilla", [KNEE]),
    ...sides("tibia", [FRONT.shin]),
    ...sides("tobillo_pie", [FRONT.foot]),
  ],
  espalda: [
    center("cabeza_cuello", [BACK.neck], [HEAD]),
    center("espalda_alta", [BACK.trap, BACK.lat]),
    center("lumbar", [BACK.lowerSide, BACK.lumbar]),
    ...sides("hombro", [DELTOID]),
    ...sides("triceps", [UPPER_ARM]),
    ...sides("codo", [ELBOW]),
    ...sides("antebrazo", [FOREARM]),
    ...sides("mano", [HAND]),
    ...sides("gluteo", [BACK.glute]),
    ...sides("isquiotibial", [BACK.hamstring]),
    ...sides("rodilla", [KNEE]),
    ...sides("gemelo", [BACK.calf]),
    ...sides("tobillo_pie", [BACK.heel]),
  ],
};

export type BodyMark = { zone: BodyZone; laterality: Laterality };

// ¿La lesión (zona + lado) cae en esta región de esta vista?
function marks(region: Region, view: BodyView, mark: BodyMark) {
  if (region.zone !== mark.zone) return false;
  if (region.side === "centro") return true;
  return screenSideOf(mark.laterality, view).includes(region.side);
}

function heatFill(count: number) {
  if (count <= 0) return BASE;
  return HEAT_COLORS[Math.min(count, HEAT_COLORS.length) - 1];
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
  const title = view === "frente" ? "frente" : "espalda";
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role={onPick ? "group" : "img"}
      aria-label={onPick ? `Cuerpo, vista de ${title}` : `Zonas lesionadas, vista de ${title}`}
      className={`block h-auto w-full select-none ${className}`}
    >
      {BODY_REGIONS[view].map((region) => {
        const key = `${region.zone}-${region.side}`;
        const label = regionLabel(region, view);
        const isSelected = !!selected && marks(region, view, selected);
        const count = heat ? heat.filter((m) => marks(region, view, m)).length : 0;
        const fill = onPick ? (isSelected ? SELECTED : BASE) : heatFill(count);
        const paths = region.parts.map((p, i) => (
          <path
            key={i}
            d={p.d}
            transform={p.mirrored ? MIRROR : undefined}
            fill={fill}
            stroke={LINE}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        ));

        if (!onPick) {
          return (
            <g key={key} data-zone={region.zone} data-side={region.side}>
              <title>{count > 0 ? `${label}: ${count}` : label}</title>
              {paths}
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
            className="cursor-pointer outline-none [&>path]:transition-[fill] hover:[&>path]:brightness-125 focus-visible:[&>path]:stroke-white focus-visible:[&>path]:[stroke-width:2.5]"
          >
            <title>{label}</title>
            {paths}
          </g>
        );
      })}

      {/* Líneas de músculo, encima y sin capturar toques. */}
      <g fill="none" stroke={DETAIL} strokeWidth={1.1} strokeLinecap="round" pointerEvents="none" opacity={0.9}>
        {DETAILS[view].flatMap((d, i) => [
          <path key={`${i}l`} d={d} />,
          <path key={`${i}r`} d={d} transform={MIRROR} />,
        ])}
      </g>
    </svg>
  );
}

// Nombre de la zona (sin lado) para listas y leyendas.
export function zoneName(zone: BodyZone) {
  return BODY_ZONES[zone].label;
}

// Leyenda de colores del mapa de solo lectura.
export function HeatLegend({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-white/70 ${className}`}>
      {["1 lesión", "2", "3 o más"].map((label, i) => (
        <li key={label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: HEAT_COLORS[i] }} />
          {label}
        </li>
      ))}
    </ul>
  );
}

// Frente y Espalda lado a lado en el panel oscuro, solo lectura (ficha de la
// lesión y Resumen). Con legend, muestra qué significa cada color.
export function BodyMapPair({
  heat,
  legend = false,
  className = "",
}: {
  heat: BodyMark[];
  legend?: boolean;
  className?: string;
}) {
  return (
    <div className={`${BODY_PANEL_CLASS} ${className}`}>
      <div className="grid grid-cols-2 gap-3">
        {(["frente", "espalda"] as const).map((v) => (
          <figure key={v} className="min-w-0">
            <BodyMap view={v} heat={heat} />
            <figcaption className={BODY_CAPTION_CLASS}>{v === "frente" ? "Frente" : "Espalda"}</figcaption>
          </figure>
        ))}
      </div>
      {legend && <HeatLegend className="mt-3" />}
    </div>
  );
}
