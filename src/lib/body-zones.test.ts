// Tests del prellenado de lateralidad y del texto de la lesión.
// Correr con: npm test (node --test, que entiende TypeScript desde Node 23).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BODY_ZONE_KEYS,
  screenSideOf,
  suggestLaterality,
  zoneLabel,
} from "./body-zones.ts";

test("de frente, la izquierda de la pantalla es el lado derecho del cuerpo", () => {
  assert.equal(suggestLaterality("rodilla", "frente", "izq"), "derecha");
  assert.equal(suggestLaterality("rodilla", "frente", "der"), "izquierda");
});

test("de espalda no se invierte", () => {
  assert.equal(suggestLaterality("isquiotibial", "espalda", "izq"), "izquierda");
  assert.equal(suggestLaterality("isquiotibial", "espalda", "der"), "derecha");
});

test("las zonas centrales sugieren No aplica", () => {
  for (const zone of ["cabeza_cuello", "pecho", "abdomen", "espalda_alta", "lumbar"] as const) {
    assert.equal(suggestLaterality(zone, "frente", "izq"), "no_aplica");
    assert.equal(suggestLaterality(zone, "espalda", "der"), "no_aplica");
  }
});

test("screenSideOf es el inverso de suggestLaterality", () => {
  for (const view of ["frente", "espalda"] as const) {
    for (const side of ["izq", "der"] as const) {
      const lat = suggestLaterality("hombro", view, side);
      assert.deepEqual(screenSideOf(lat, view), [side]);
    }
  }
});

test("el texto concuerda en género con la zona", () => {
  assert.equal(zoneLabel("isquiotibial", "derecha"), "Isquiotibial derecho");
  assert.equal(zoneLabel("rodilla", "izquierda"), "Rodilla izquierda");
  assert.equal(zoneLabel("tobillo_pie", "bilateral"), "Tobillo y pie bilateral");
  assert.equal(zoneLabel("lumbar", "no_aplica"), "Zona lumbar");
});

test("hay 19 zonas, las del enum body_zone", () => {
  assert.equal(BODY_ZONE_KEYS.length, 19);
});
