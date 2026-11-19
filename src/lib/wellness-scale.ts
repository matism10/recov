// Escala del check de bienestar: cómo la ve el jugador y cómo se guarda.
// La base guarda siempre 5 = mejor (normalizado): el total /25, wellness_flags y las
// notificaciones dependen de eso. El jugador, en cambio, responde cada ítem en la
// orientación natural de su nombre: en Fatiga, Dolor muscular y Estrés, 5 = más
// (más cansado, más dolor, más estrés), así que esos tres van invertidos (6 − v).
// Sin imports para que `npm test` (node --test) lo cargue directo.

export type WellnessItem = "fatigue" | "sleep" | "soreness" | "stress" | "mood";

export type WellnessScaleItem = {
  key: WellnessItem;
  title: string;
  short: string; // para columnas angostas
  inverted: boolean; // true: el 5 que ve el jugador es el peor valor
  min: string; // etiqueta del 1 que ve el jugador
  max: string; // etiqueta del 5 que ve el jugador
  worse: string; // el ítem mal, en minúscula: "fatiga alta", "sueño malo"
};

export const WELLNESS_ITEMS: WellnessScaleItem[] = [
  { key: "fatigue", title: "Fatiga", short: "Fatiga", inverted: true, min: "Fresco", max: "Muy cansado", worse: "fatiga alta" },
  { key: "sleep", title: "Calidad del sueño", short: "Sueño", inverted: false, min: "Dormí muy mal", max: "Dormí muy bien", worse: "sueño malo" },
  { key: "soreness", title: "Dolor muscular", short: "Dolor", inverted: true, min: "Sin dolor", max: "Mucho dolor", worse: "dolor muscular alto" },
  { key: "stress", title: "Estrés", short: "Estrés", inverted: true, min: "Relajado", max: "Muy estresado", worse: "estrés alto" },
  { key: "mood", title: "Ánimo", short: "Ánimo", inverted: false, min: "Muy bajo", max: "Muy bueno", worse: "ánimo bajo" },
];

export const WELLNESS_KEYS: WellnessItem[] = WELLNESS_ITEMS.map((i) => i.key);

export function wellnessItem(key: WellnessItem): WellnessScaleItem {
  return WELLNESS_ITEMS.find((i) => i.key === key)!;
}

// Valor que elige el jugador (1–5 en su orientación) → valor que se guarda (5 = mejor).
export function toStored(item: WellnessItem, shown: number) {
  return wellnessItem(item).inverted ? 6 - shown : shown;
}

// Valor guardado (5 = mejor) → valor en la orientación del jugador.
export function toShown(item: WellnessItem, stored: number) {
  return wellnessItem(item).inverted ? 6 - stored : stored;
}

// Etiqueta del extremo para un valor en la orientación del jugador (null en 2, 3 y 4).
export function shownLabel(item: WellnessItem, shown: number) {
  const q = wellnessItem(item);
  return shown === 1 ? q.min : shown === 5 ? q.max : null;
}

// "Dolor muscular 5 · Mucho dolor" / "Fatiga 4", a partir del valor guardado.
export function wellnessItemText(item: WellnessItem, stored: number) {
  const shown = toShown(item, stored);
  const label = shownLabel(item, shown);
  return `${wellnessItem(item).title} ${shown}${label ? ` · ${label}` : ""}`;
}

// Gravedad por el valor guardado (no por el número que se ve): 1 = peor.
export type WellnessSeverity = "mal" | "regular" | "bien";
export function wellnessSeverity(stored: number): WellnessSeverity {
  return stored <= 2 ? "mal" : stored === 3 ? "regular" : "bien";
}

// "Fatiga alta y estrés alto" (sin valores; para avisos que solo traen los ítems).
export function worseItemsText(items: WellnessItem[]) {
  if (items.length === 0) return "";
  const names = items.map((i) => wellnessItem(i).worse);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
  return list.charAt(0).toUpperCase() + list.slice(1);
}
