// Tests de la escala del check de bienestar (orientación del jugador ↔ valor guardado).
// Correr con: npm test (node --test, que entiende TypeScript desde Node 23).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WELLNESS_KEYS,
  shownLabel,
  toShown,
  toStored,
  wellnessItemText,
  wellnessSeverity,
  worseItemsText,
} from "./wellness-scale.ts";

test("ida y vuelta de los 5 valores en los 5 ítems", () => {
  for (const key of WELLNESS_KEYS) {
    for (const v of [1, 2, 3, 4, 5]) {
      assert.equal(toShown(key, toStored(key, v)), v, `${key} ${v}`);
      assert.equal(toStored(key, toShown(key, v)), v, `${key} ${v}`);
    }
  }
});

test("el 3 queda en 3 en todos los ítems", () => {
  for (const key of WELLNESS_KEYS) {
    assert.equal(toStored(key, 3), 3);
    assert.equal(toShown(key, 3), 3);
  }
});

test("fatiga, dolor muscular y estrés van invertidos; sueño y ánimo no", () => {
  assert.equal(toStored("fatigue", 5), 1); // Muy cansado = peor
  assert.equal(toStored("soreness", 1), 5); // Sin dolor = mejor
  assert.equal(toStored("stress", 4), 2);
  assert.equal(toStored("sleep", 5), 5);
  assert.equal(toStored("mood", 2), 2);
});

test("etiquetas de los extremos en la orientación del jugador", () => {
  assert.equal(shownLabel("fatigue", 1), "Fresco");
  assert.equal(shownLabel("fatigue", 5), "Muy cansado");
  assert.equal(shownLabel("soreness", 3), null);
  assert.equal(wellnessItemText("soreness", 1), "Dolor muscular 5 · Mucho dolor");
  assert.equal(wellnessItemText("sleep", 1), "Calidad del sueño 1 · Dormí muy mal");
  assert.equal(wellnessItemText("stress", 2), "Estrés 4");
});

test("la gravedad sale del valor guardado, no del número que se ve", () => {
  assert.equal(wellnessSeverity(toStored("soreness", 5)), "mal");
  assert.equal(wellnessSeverity(toStored("sleep", 5)), "bien");
  assert.equal(wellnessSeverity(3), "regular");
  assert.equal(worseItemsText(["fatigue", "stress"]), "Fatiga alta y estrés alto");
});
