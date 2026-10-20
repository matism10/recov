// Vista "cancha": dónde se dibuja cada puesto titular en la cancha de cada deporte.
// Solo presentación: x e y en % de una cancha vertical que ataca hacia arriba
// (y = 0 arriba). `slot` es el número de puesto en la nómina (1 a titulares; la
// banca sigue después) y `code` lo que va dentro del círculo: en rugby, el número
// de la camiseta (1 a 15); en los demás deportes, las iniciales de la posición.
// Las cantidades de titulares y banca vienen de la base (public.sports).

export type PitchKind = "rugby" | "futbol" | "hockey" | "futsal" | "handball" | "basquetbol" | "voleibol";

export type PitchSlot = { slot: number; position: string; code: string; x: number; y: number };

type Spot = [position: string, x: number, y: number];

// Iniciales por posición (deportes sin número fijo por puesto).
const CODES: Record<Exclude<PitchKind, "rugby">, Record<string, string>> = {
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

export const PITCH_LAYOUTS: Record<PitchKind, PitchSlot[]> = Object.fromEntries(
  (Object.keys(SPOTS) as PitchKind[]).map((kind) => [
    kind,
    SPOTS[kind].map(([position, x, y], i) => ({
      slot: i + 1,
      position,
      code: kind === "rugby" ? String(i + 1) : (CODES[kind][position] ?? position.slice(0, 2).toUpperCase()),
      x,
      y,
    })),
  ]),
) as Record<PitchKind, PitchSlot[]>;

export function pitchKind(sport: string | null | undefined): PitchKind | null {
  return sport && sport in PITCH_LAYOUTS ? (sport as PitchKind) : null;
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
