// Zonas del cuerpo y lateralidad de una lesión (enums body_zone e
// injury_laterality, migración 20261104230000). Los valores son también los
// identificadores (data-zone) de las regiones del mapa del cuerpo (src/app/body-map.tsx).
// Sin imports con "@/": lo prueban los tests con node (body-zones.test.ts).
import type { Database } from "./supabase/database.types";

export type BodyZone = Database["public"]["Enums"]["body_zone"];
export type Laterality = Database["public"]["Enums"]["injury_laterality"];
export type BodyView = "frente" | "espalda";
// Lado de la pantalla donde está la región tocada (no el lado del cuerpo).
export type ScreenSide = "izq" | "der" | "centro";

type ZoneInfo = { label: string; feminine: boolean; central: boolean };

// En orden de la cabeza a los pies (orden del select alternativo).
export const BODY_ZONES: Record<BodyZone, ZoneInfo> = {
  cabeza_cuello: { label: "Cabeza y cuello", feminine: false, central: true },
  hombro: { label: "Hombro", feminine: false, central: false },
  biceps: { label: "Bíceps", feminine: false, central: false },
  triceps: { label: "Tríceps", feminine: false, central: false },
  codo: { label: "Codo", feminine: false, central: false },
  antebrazo: { label: "Antebrazo", feminine: false, central: false },
  mano: { label: "Mano", feminine: true, central: false },
  pecho: { label: "Pecho", feminine: false, central: true },
  espalda_alta: { label: "Espalda alta", feminine: true, central: true },
  lumbar: { label: "Zona lumbar", feminine: true, central: true },
  abdomen: { label: "Abdomen", feminine: false, central: true },
  cadera_ingle: { label: "Cadera e ingle", feminine: true, central: false },
  gluteo: { label: "Glúteo", feminine: false, central: false },
  cuadriceps: { label: "Cuádriceps", feminine: false, central: false },
  isquiotibial: { label: "Isquiotibial", feminine: false, central: false },
  rodilla: { label: "Rodilla", feminine: true, central: false },
  tibia: { label: "Tibia", feminine: true, central: false },
  gemelo: { label: "Gemelo", feminine: false, central: false },
  tobillo_pie: { label: "Tobillo y pie", feminine: false, central: false },
};

export const BODY_ZONE_KEYS = Object.keys(BODY_ZONES) as BodyZone[];

export const LATERALITIES: Laterality[] = ["derecha", "izquierda", "bilateral", "no_aplica"];

export const LATERALITY_LABEL: Record<Laterality, string> = {
  derecha: "Derecha",
  izquierda: "Izquierda",
  bilateral: "Bilateral",
  no_aplica: "No aplica",
};

export function isBodyZone(value: unknown): value is BodyZone {
  return typeof value === "string" && value in BODY_ZONES;
}

export function isLaterality(value: unknown): value is Laterality {
  return typeof value === "string" && (LATERALITIES as string[]).includes(value);
}

export function isCentralZone(zone: BodyZone) {
  return BODY_ZONES[zone].central;
}

// Lado sugerido al tocar una región. De frente, el cuerpo mira a quien usa la
// pantalla: su lado derecho queda a la izquierda de la pantalla. De espalda no se
// invierte (izquierda de la pantalla = izquierda del cuerpo). Las zonas centrales
// sugieren "No aplica".
export function suggestLaterality(zone: BodyZone, view: BodyView, side: ScreenSide): Laterality {
  if (isCentralZone(zone) || side === "centro") return "no_aplica";
  if (view === "frente") return side === "izq" ? "derecha" : "izquierda";
  return side === "izq" ? "izquierda" : "derecha";
}

// Lado de la pantalla en que se ve un lado del cuerpo en cada vista (inverso de
// suggestLaterality), para resaltar la región correcta en el mapa.
export function screenSideOf(laterality: Laterality, view: BodyView): ScreenSide[] {
  if (laterality === "derecha") return [view === "frente" ? "izq" : "der"];
  if (laterality === "izquierda") return [view === "frente" ? "der" : "izq"];
  return ["izq", "der", "centro"];
}

// Texto de injuries.type: "Isquiotibial derecho", "Rodilla izquierda", "Pecho".
// Igual que private.injury_zone_type (la base guarda el que arma ella).
export function zoneLabel(zone: BodyZone, laterality: Laterality) {
  const { label, feminine } = BODY_ZONES[zone];
  switch (laterality) {
    case "derecha":
      return `${label} ${feminine ? "derecha" : "derecho"}`;
    case "izquierda":
      return `${label} ${feminine ? "izquierda" : "izquierdo"}`;
    case "bilateral":
      return `${label} bilateral`;
    default:
      return label;
  }
}
