// Vista "cancha": dónde se dibuja cada puesto titular en la cancha de cada deporte.
// Solo presentación: x e y en % de una cancha vertical que ataca hacia arriba
// (y = 0 arriba). `slot` es el número de puesto en la nómina (1 a titulares; la
// banca sigue después) y `code` lo que va dentro del círculo: en rugby, el número
// de la camiseta (1 a 15); en los demás deportes, las iniciales de la posición.
// Las cantidades de titulares y banca vienen de la base (public.sports).

// "sevens" no es un deporte: es la cancha de Rugby Sevens (formato '7' de un club de rugby).
export type PitchKind = "rugby" | "sevens" | "futbol" | "hockey" | "futsal" | "handball" | "basquetbol" | "voleibol";

// Dónde va la etiqueta del puesto respecto del círculo (por defecto, debajo).
export type LabelSide = "below" | "left" | "right";

export type PitchSlot = { slot: number; position: string; code: string; x: number; y: number; labelSide?: LabelSide };

type Spot = [position: string, x: number, y: number];

// Iniciales por posición (deportes sin número fijo por puesto).
const CODES: Record<Exclude<PitchKind, "rugby" | "sevens">, Record<string, string>> = {
  futbol: {
    Portero: "PO",
    Lateral: "LA",
    "Defensa central": "DF",
    "Mediocampista defensivo": "MD",
    "Mediocampista central": "MC",
    "Mediocampista ofensivo": "MO",
    Extremo: "EX",
    "Delantero centro": "DC",
  },
  hockey: {
    Portero: "PO",
    "Defensa central": "DF",
    "Defensa lateral": "DL",
    "Mediocampista defensivo": "MD",
    "Mediocampista central": "MC",
    Delantero: "DE",
    Extremo: "EX",
  },
  futsal: { Portero: "PO", Cierre: "CI", Ala: "AL", Pívot: "PI" },
  handball: { Portero: "PO", Extremo: "EX", Lateral: "LA", Central: "CE", Pivote: "PI" },
  basquetbol: { Base: "BA", Escolta: "ES", Alero: "AL", "Ala-pívot": "AP", Pívot: "PI" },
  voleibol: {
    Armador: "AR",
    "Central (bloqueador)": "CE",
    "Punta (receptor-atacante)": "PU",
    Opuesto: "OP",
    Líbero: "LI",
  },
};

// Puestos titulares en orden de número (en rugby, 1 a 15).
const SPOTS: Record<PitchKind, Spot[]> = {
  rugby: [
    ["Pilar", 30, 14],
    ["Hooker", 50, 12],
    ["Pilar", 70, 14],
    ["Segunda línea", 40, 25],
    ["Segunda línea", 60, 25],
    ["Flanker", 20, 33],
    ["Flanker", 80, 33],
    ["Octavo", 50, 37],
    ["Medio scrum", 44, 50],
    ["Apertura", 30, 60],
    ["Wing", 14, 72],
    ["Centro", 50, 67],
    ["Centro", 68, 74],
    ["Wing", 86, 72],
    ["Fullback", 50, 88],
  ],
  // Sevens: 1 y 3 arriba, 2 debajo al medio, 4 más abajo a la derecha del 2 y 5, 6 y
  // 7 en diagonal hacia la derecha. Desde la referencia (326 × 392 px, círculo de
  // 52 px): centro del círculo en % del ancho y del alto.
  sevens: [
    ["Pilar", 12.3, 6.6],
    ["Hooker", 29.1, 28.1],
    ["Pilar", 46, 6.6],
    ["Medio scrum", 59.5, 42.3],
    ["Apertura", 68.1, 59.7],
    ["Centro", 76.7, 77],
    ["Wing", 90.8, 93.4],
  ],
  futbol: [
    ["Portero", 50, 90],
    ["Lateral", 14, 66],
    ["Defensa central", 36, 73],
    ["Defensa central", 64, 73],
    ["Lateral", 86, 66],
    ["Mediocampista defensivo", 50, 58],
    ["Mediocampista central", 32, 45],
    ["Mediocampista ofensivo", 66, 37],
    ["Extremo", 16, 20],
    ["Delantero centro", 50, 13],
    ["Extremo", 84, 20],
  ],
  hockey: [
    ["Portero", 50, 90],
    ["Defensa lateral", 16, 66],
    ["Defensa central", 38, 74],
    ["Defensa central", 62, 74],
    ["Defensa lateral", 84, 66],
    ["Mediocampista defensivo", 50, 54],
    ["Mediocampista central", 32, 40],
    ["Mediocampista central", 68, 40],
    ["Extremo", 16, 20],
    ["Delantero", 50, 14],
    ["Extremo", 84, 20],
  ],
  futsal: [
    ["Portero", 50, 89],
    ["Cierre", 50, 66],
    ["Ala", 20, 46],
    ["Ala", 80, 46],
    ["Pívot", 50, 22],
  ],
  handball: [
    ["Portero", 50, 89],
    ["Extremo", 12, 26],
    ["Lateral", 26, 46],
    ["Central", 50, 52],
    ["Lateral", 74, 46],
    ["Extremo", 88, 26],
    ["Pivote", 50, 20],
  ],
  basquetbol: [
    ["Base", 50, 78],
    ["Escolta", 78, 62],
    ["Alero", 22, 44],
    ["Ala-pívot", 76, 34],
    ["Pívot", 50, 22],
  ],
  voleibol: [
    ["Armador", 82, 66],
    ["Punta (receptor-atacante)", 18, 24],
    ["Central (bloqueador)", 50, 24],
    ["Opuesto", 82, 24],
    ["Punta (receptor-atacante)", 18, 66],
    ["Líbero", 50, 72],
  ],
};

// Sevens: etiqueta debajo en 1, 2 y 3; a la derecha en 4; a la izquierda en 5, 6 y 7.
const SEVENS_LABEL_SIDE: LabelSide[] = ["below", "below", "below", "right", "left", "left", "left"];

export const PITCH_LAYOUTS: Record<PitchKind, PitchSlot[]> = Object.fromEntries(
  (Object.keys(SPOTS) as PitchKind[]).map((kind) => [
    kind,
    SPOTS[kind].map(([position, x, y], i) => ({
      slot: i + 1,
      position,
      code:
        kind === "rugby" || kind === "sevens"
          ? String(i + 1)
          : (CODES[kind][position] ?? position.slice(0, 2).toUpperCase()),
      x,
      y,
      ...(kind === "sevens" ? { labelSide: SEVENS_LABEL_SIDE[i] } : {}),
    })),
  ]),
) as Record<PitchKind, PitchSlot[]>;

export function pitchKind(sport: string | null | undefined, format: "15" | "7" = "15"): PitchKind | null {
  if (sport === "rugby" && format === "7") return "sevens";
  return sport && sport !== "sevens" && sport in PITCH_LAYOUTS ? (sport as PitchKind) : null;
}

// Nombre corto para la etiqueta bajo el círculo (la cancha es angosta en celular).
export function shortPositionLabel(name: string) {
  return name
    .replace(/\s*\(.*\)$/, "")
    .replace("Segunda línea", "2ª línea")
    .replace("Mediocampista", "Medio")
    .replace("Delantero centro", "Centrodelantero")
    .replace("Defensa central", "Central")
    .replace("Defensa lateral", "Lateral");
}

// Apellido (o nombre corto) para la etiqueta de un puesto ocupado.
export function shortPlayerName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : parts[0];
}

// Nombre de un puesto: "Puesto 9 · Medio scrum" o "Banca · 18".
export function slotLabel(kind: PitchKind, starters: number, slot: number) {
  if (slot > starters) return `Banca · ${slot}`;
  const spot = PITCH_LAYOUTS[kind].find((s) => s.slot === slot);
  return spot ? `Puesto ${slot} · ${spot.position}` : `Puesto ${slot}`;
}

// Banca sugerida por puesto (no obligatoria; la lista de cada puesto parte filtrada en ellas): las posiciones que se suelen usar en
// cada número de la banca. En rugby, 16 hooker, 17 y 18 pilares, 19 segunda línea,
// 20 tercera línea, 21 medio scrum, 22 apertura o fullback y 23 centro o wing.
export type BenchHint = { positions: string[]; label: string };

export const BENCH_HINTS: Partial<Record<PitchKind, Record<number, BenchHint>>> = {
  rugby: {
    16: { positions: ["Hooker"], label: "Hooker" },
    17: { positions: ["Pilar"], label: "Pilar" },
    18: { positions: ["Pilar"], label: "Pilar" },
    19: { positions: ["Segunda línea"], label: "2ª línea" },
    20: { positions: ["Flanker", "Octavo"], label: "3ª línea" },
    21: { positions: ["Medio scrum"], label: "Medio scrum" },
    22: { positions: ["Apertura", "Fullback"], label: "Apertura o fullback" },
    23: { positions: ["Centro", "Wing"], label: "Centro o wing" },
  },
};

export function benchHint(kind: PitchKind, slot: number): BenchHint | null {
  return BENCH_HINTS[kind]?.[slot] ?? null;
}
