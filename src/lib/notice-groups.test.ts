import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { badgeText, buildChips, groupOf, splitGroups } from "./notice-groups.ts";
import type { NoticeCard } from "./notifications.ts";

let n = 0;
function card(p: Partial<NoticeCard>): NoticeCard {
  n += 1;
  return {
    key: `k${n}`,
    kind: "evento_nuevo",
    id: null,
    tone: "celeste",
    icon: "calendar-plus",
    title: "t",
    detail: null,
    href: null,
    badge: null,
    urgent: false,
    rank: 3,
    time: n,
    ...p,
  };
}

describe("grupos de la hoja", () => {
  it("rojas y urgentes van en Requiere atención; el resto en Avisos", () => {
    assert.equal(groupOf(card({ tone: "rojo", kind: "carga_alta" })), "atencion");
    assert.equal(groupOf(card({ kind: "tarea_bienestar", urgent: true, rank: 0 })), "atencion");
    assert.equal(groupOf(card({ kind: "tarea_bienestar" })), "avisos");
    assert.equal(groupOf(card({ tone: "naranjo" })), "avisos");
  });

  it("ordena por rango y luego lo más reciente primero", () => {
    const old = card({ time: 1 });
    const recent = card({ time: 9 });
    const g = splitGroups([old, recent]);
    assert.deepEqual(g.avisos.map((c) => c.key), [recent.key, old.key]);
    assert.equal(g.atencion.length, 0);
  });
});

describe("chips del Resumen", () => {
  it("sin notificaciones no hay chips", () => {
    assert.deepEqual(buildChips([]), []);
  });

  it("solo avisos: un chip neutro", () => {
    const chips = buildChips([card({}), card({})]);
    assert.equal(chips.length, 1);
    assert.equal(chips[0].label, "2 avisos");
    assert.equal(chips[0].style, "neutro");
    assert.equal(buildChips([card({})])[0].label, "1 aviso");
  });

  it("las tareas del jugador van primero, antes que las rojas", () => {
    const chips = buildChips([
      card({ kind: "bienestar_bajo", tone: "rojo", rank: 1 }),
      card({ kind: "tarea_bienestar", urgent: true, badge: "Vence en 5 h", rank: 0 }),
      card({ kind: "tarea_esfuerzo", rank: 2 }),
      card({}),
    ]);
    assert.deepEqual(
      chips.map((c) => c.label),
      ["1 esfuerzo por responder", "Check de bienestar · vence en 5 h", "1 bienestar bajo", "1 aviso"],
    );
    assert.equal(chips[0].group, "avisos");
    assert.equal(chips[1].group, "atencion");
  });

  it("agrupa las rojas por tipo con su conteo", () => {
    const chips = buildChips([
      card({ kind: "bienestar_bajo", tone: "rojo" }),
      card({ kind: "bienestar_bajo", tone: "rojo" }),
      card({ kind: "carga_alta", tone: "rojo" }),
    ]);
    assert.deepEqual(chips.map((c) => c.label), ["2 bienestar bajo", "1 carga alta"]);
    assert.ok(chips.every((c) => c.group === "atencion" && c.style === "peligro"));
  });

  it("el conteo de los chips cubre todas las tarjetas", () => {
    const cards = [
      card({ kind: "tarea_gimnasio" }),
      card({ kind: "evento_cancelado", tone: "rojo" }),
      card({}),
      card({ tone: "naranjo" }),
    ];
    assert.equal(buildChips(cards).reduce((s, c) => s + c.count, 0), cards.length);
  });
});

describe("insignia de la campana", () => {
  it("se oculta en 0 y muestra 9+ sobre 9", () => {
    assert.equal(badgeText(0), null);
    assert.equal(badgeText(4), "4");
    assert.equal(badgeText(9), "9");
    assert.equal(badgeText(10), "9+");
  });
});
