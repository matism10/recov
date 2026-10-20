// Vista "cancha": dónde se dibuja cada posición del catálogo (public.positions)
// en la cancha de cada deporte. Solo presentación: x e y en % de una cancha
// vertical que ataca hacia arriba (y = 0 arriba). Una posición puede tener varias
// marcas (dos pilares, dos wings); todas abren la misma posición. Una posición
// del catálogo sin marca se muestra igual, como botón bajo la cancha.

export type PitchKind = "rugby" | "futbol" | "hockey" | "futsal" | "handball" | "basquetbol" | "voleibol";

export type PitchSlot = { position: string; x: number; y: number };

export const PITCH_LAYOUTS: Record<PitchKind, PitchSlot[]> = {
  rugby: [
    { position: "Pilar", x: 30, y: 14 },
    { position: "Hooker", x: 50, y: 12 },
    { position: "Pilar", x: 70, y: 14 },
    { position: "Segunda línea", x: 40, y: 25 },
    { position: "Segunda línea", x: 60, y: 25 },
    { position: "Flanker", x: 20, y: 33 },
    { position: "Octavo", x: 50, y: 37 },
    { position: "Flanker", x: 80, y: 33 },
    { position: "Medio scrum", x: 44, y: 50 },
    { position: "Apertura", x: 30, y: 60 },
    { position: "Centro", x: 50, y: 67 },
    { position: "Centro", x: 68, y: 74 },
    { position: "Wing", x: 14, y: 72 },
    { position: "Wing", x: 86, y: 72 },
    { position: "Fullback", x: 50, y: 88 },
  ],
  futbol: [
    { position: "Delantero centro", x: 50, y: 13 },
    { position: "Extremo", x: 16, y: 20 },
    { position: "Extremo", x: 84, y: 20 },
    { position: "Mediocampista ofensivo", x: 66, y: 37 },
    { position: "Mediocampista central", x: 32, y: 45 },
    { position: "Mediocampista defensivo", x: 50, y: 58 },
    { position: "Lateral", x: 14, y: 66 },
    { position: "Defensa central", x: 36, y: 73 },
    { position: "Defensa central", x: 64, y: 73 },
    { position: "Lateral", x: 86, y: 66 },
    { position: "Portero", x: 50, y: 90 },
  ],
  hockey: [
    { position: "Delantero", x: 50, y: 14 },
    { position: "Extremo", x: 16, y: 20 },
    { position: "Extremo", x: 84, y: 20 },
    { position: "Mediocampista central", x: 32, y: 40 },
    { position: "Mediocampista central", x: 68, y: 40 },
    { position: "Mediocampista defensivo", x: 50, y: 54 },
    { position: "Defensa lateral", x: 16, y: 66 },
    { position: "Defensa central", x: 38, y: 74 },
    { position: "Defensa central", x: 62, y: 74 },
    { position: "Defensa lateral", x: 84, y: 66 },
    { position: "Portero", x: 50, y: 90 },
  ],
  futsal: [
    { position: "Pívot", x: 50, y: 22 },
    { position: "Ala", x: 20, y: 46 },
    { position: "Ala", x: 80, y: 46 },
    { position: "Cierre", x: 50, y: 66 },
    { position: "Portero", x: 50, y: 89 },
  ],
  handball: [
    { position: "Pivote", x: 50, y: 20 },
    { position: "Extremo", x: 12, y: 26 },
    { position: "Extremo", x: 88, y: 26 },
    { position: "Lateral", x: 26, y: 46 },
    { position: "Central", x: 50, y: 52 },
    { position: "Lateral", x: 74, y: 46 },
    { position: "Portero", x: 50, y: 89 },
  ],
  basquetbol: [
    { position: "Pívot", x: 50, y: 22 },
    { position: "Ala-pívot", x: 76, y: 34 },
    { position: "Alero", x: 22, y: 44 },
    { position: "Escolta", x: 78, y: 62 },
    { position: "Base", x: 50, y: 78 },
  ],
  voleibol: [
    { position: "Punta (receptor-atacante)", x: 18, y: 24 },
    { position: "Central (bloqueador)", x: 50, y: 24 },
    { position: "Opuesto", x: 82, y: 24 },
    { position: "Punta (receptor-atacante)", x: 18, y: 66 },
    { position: "Líbero", x: 50, y: 72 },
    { position: "Armador", x: 82, y: 66 },
  ],
};

export function pitchKind(sport: string | null | undefined): PitchKind | null {
  return sport && sport in PITCH_LAYOUTS ? (sport as PitchKind) : null;
}

// Nombre corto para la etiqueta de la marca (la cancha es angosta en celular).
export function shortPositionLabel(name: string) {
  return name
    .replace(/\s*\(.*\)$/, "")
    .replace("Mediocampista", "Medio")
    .replace("Delantero centro", "Centrodelantero")
    .replace("Defensa central", "Central")
    .replace("Defensa lateral", "Lateral");
}
