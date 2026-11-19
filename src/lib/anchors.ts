// Id de ancla de un bloque a partir de su título: "Carga por jugador" → "carga-por-jugador".
// Lo usa MetricsBlock y el índice del buscador (src/lib/search-index.ts).
export function anchorId(heading: string) {
  return heading
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
