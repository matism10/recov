// Tests de bloques y superseries del plan de gimnasio.
// Correr con: npm test (node --test, que entiende TypeScript desde Node 23).
import { test } from "node:test";
import assert from "node:assert/strict";
import { blockRuns, exerciseCodes, normalizeSupersets, supersetsFromLinks } from "./gym-groups.ts";

const ex = (block: string | null, superset: number | null) => ({ block, superset });

test("códigos: una letra por ejercicio suelto y número dentro de la superserie", () => {
  const list = [ex(null, null), ex(null, 4), ex(null, 4), ex(null, null), ex(null, 9), ex(null, 9), ex(null, 9)];
  assert.deepEqual(exerciseCodes(list), ["A", "B1", "B2", "C", "D1", "D2", "D3"]);
});

test("una superserie no cruza de un bloque a otro", () => {
  const list = [ex("Calentamiento", 1), ex("Principal", 1)];
  assert.deepEqual(exerciseCodes(list), ["A", "B"]);
  assert.deepEqual(
    normalizeSupersets(list).map((e) => e.superset),
    [null, null],
  );
});

test("normalizar renumera 1, 2… y deja sueltas las de un solo ejercicio", () => {
  const list = [ex(null, 7), ex(null, 7), ex(null, 3), ex(null, 5), ex(null, 5)];
  assert.deepEqual(
    normalizeSupersets(list).map((e) => e.superset),
    [1, 1, null, 2, 2],
  );
});

test("unir y separar con el siguiente", () => {
  const list = [ex(null, null), ex(null, null), ex(null, null)];
  const joined = supersetsFromLinks(list, [true, true, false]);
  assert.deepEqual(joined.map((e) => e.superset), [1, 1, 1]);
  const split = supersetsFromLinks(joined, [true, false, false]);
  assert.deepEqual(split.map((e) => e.superset), [1, 1, null]);
});

test("bloques: tramos seguidos con el mismo nombre", () => {
  const runs = blockRuns([ex(null, null), ex("A", null), ex("A", null), ex("B", null)]);
  assert.deepEqual(
    runs.map((r) => [r.block, r.start, r.items.length]),
    [
      [null, 0, 1],
      ["A", 1, 2],
      ["B", 3, 1],
    ],
  );
});
