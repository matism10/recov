// Búsqueda por nombre sin tildes ni mayúsculas: "martin" encuentra "Martín".
export function normalizeSearch(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function matchesName(name: string, query: string) {
  const q = normalizeSearch(query);
  return !q || normalizeSearch(name).includes(q);
}
