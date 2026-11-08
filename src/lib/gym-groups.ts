// Plan de gimnasio: bloques y superseries de una sesión (20261105210000). Sin imports, para
// poder probarlo con node --test (gym-groups.test.ts).
type Groupable = { block: string | null; superset: number | null };

// Superseries: ejercicios seguidos del mismo bloque con el mismo número. Las renumera
// 1, 2, 3… en orden y deja en null las de un solo ejercicio.
export function normalizeSupersets<T extends Groupable>(list: T[]): T[] {
  const linked = list.map((e, i) => sameSuperset(e, list[i + 1]));
  return supersetsFromLinks(list, linked);
}
export const sameSuperset = (a: Groupable | undefined, b: Groupable | undefined) =>
  !!a && !!b && a.superset !== null && a.superset === b.superset && (a.block ?? "") === (b.block ?? "");

// linked[i]: el ejercicio i va en superserie con el siguiente.
export function supersetsFromLinks<T extends Groupable>(list: T[], linked: boolean[]): T[] {
  let n = 0;
  let current: number | null = null;
  return list.map((e, i) => {
    const withPrev = i > 0 && linked[i - 1];
    if (!withPrev) current = linked[i] ? ++n : null;
    return { ...e, superset: current };
  });
}

// Código de cada ejercicio: una letra por ejercicio suelto o superserie (A, B, C…) y,
// dentro de una superserie, su número (C1, C2).
export function exerciseCodes(list: Groupable[]): string[] {
  const codes: string[] = [];
  let letter = -1;
  let inGroup = 0;
  list.forEach((e, i) => {
    const withPrev = i > 0 && sameSuperset(list[i - 1], e);
    const withNext = sameSuperset(e, list[i + 1]);
    if (!withPrev) {
      letter += 1;
      inGroup = 0;
    }
    inGroup += 1;
    const l = letter < 26 ? String.fromCharCode(65 + letter) : String(letter + 1);
    codes.push(withPrev || withNext ? `${l}${inGroup}` : l);
  });
  return codes;
}

// Bloques: tramos seguidos con el mismo nombre de bloque (null = sin bloque).
export function blockRuns<T extends Groupable>(list: T[]): { block: string | null; start: number; items: T[] }[] {
  const runs: { block: string | null; start: number; items: T[] }[] = [];
  list.forEach((e, i) => {
    const last = runs.at(-1);
    if (last && (last.block ?? "") === (e.block ?? "")) last.items.push(e);
    else runs.push({ block: e.block, start: i, items: [e] });
  });
  return runs;
}
