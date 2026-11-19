// Coincidencia del buscador universal: sin tildes ni mayúsculas, por palabras sueltas.
// Cada palabra de la búsqueda debe aparecer en el texto (en cualquier orden).
import { normalizeSearch } from "./search.ts";

export const MAX_PER_BLOCK = 5;

export function searchTokens(query: string): string[] {
  return normalizeSearch(query).split(/\s+/).filter(Boolean);
}

// Puntaje de una coincidencia (mayor = mejor) o null si no coincide. El título pesa
// más que los sinónimos; empezar por la palabra buscada, más que contenerla.
export function scoreMatch(title: string, keywords: readonly string[], query: string): number | null {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return null;
  const t = normalizeSearch(title);
  const k = normalizeSearch(keywords.join(" "));
  let score = 0;
  for (const tok of tokens) {
    if (t.startsWith(tok)) score += 4;
    else if (t.split(/\s+/).some((w) => w.startsWith(tok))) score += 3;
    else if (t.includes(tok)) score += 2;
    else if (k.split(/[\s,]+/).some((w) => w.startsWith(tok))) score += 1.5;
    else return null;
  }
  return score;
}

// Trozos del texto original con marca donde coincide la búsqueda (sin tildes ni mayúsculas).
export function highlightParts(text: string, query: string): { text: string; hit: boolean }[] {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return [{ text, hit: false }];
  // Texto normalizado carácter a carácter, con el índice original de cada uno.
  let norm = "";
  const origin: number[] = [];
  let i = 0;
  for (const ch of text) {
    const n = normalizeSearch(ch);
    for (let j = 0; j < n.length; j++) origin.push(i);
    norm += n;
    i += ch.length;
  }
  const marked = new Array<boolean>(text.length).fill(false);
  for (const tok of tokens) {
    let from = 0;
    for (;;) {
      const at = norm.indexOf(tok, from);
      if (at === -1) break;
      const start = origin[at];
      const end = (origin[at + tok.length - 1] ?? text.length - 1) + 1;
      for (let p = start; p < Math.min(end, text.length); p++) marked[p] = true;
      from = at + tok.length;
    }
  }
  const parts: { text: string; hit: boolean }[] = [];
  for (let p = 0; p < text.length; p++) {
    const last = parts[parts.length - 1];
    if (last && last.hit === marked[p]) last.text += text[p];
    else parts.push({ text: text[p], hit: marked[p] });
  }
  return parts;
}

// Mejores resultados de una lista (puntaje, luego el orden original), hasta el máximo del bloque.
export function rankBy<T>(
  items: readonly T[],
  query: string,
  getText: (item: T) => { title: string; keywords?: readonly string[] },
  max = MAX_PER_BLOCK,
): T[] {
  return items
    .map((item, order) => {
      const { title, keywords = [] } = getText(item);
      return { item, order, score: scoreMatch(title, keywords, query) };
    })
    .filter((r): r is { item: T; order: number; score: number } => r.score !== null)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, max)
    .map((r) => r.item);
}
