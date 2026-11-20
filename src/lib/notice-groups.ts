// Agrupación de las notificaciones para la campana y la franja "Requiere atención" del
// Resumen. Solo lógica pura (sin acceso a datos): decide qué tarjeta va en cada grupo
// y arma los chips. Importa con rutas relativas para poder correr con node --test.
import type { NoticeCard } from "./notifications.ts";

export type NoticeGroup = "atencion" | "avisos";

export const GROUP_LABEL: Record<NoticeGroup, string> = {
  atencion: "Requiere atención",
  avisos: "Avisos",
};

// Requiere atención: las rojas (carga alta, bienestar bajo, evento cancelado o
// modificado) y las de estado que vencen en menos de 12 h (`urgent`).
export function groupOf(card: NoticeCard): NoticeGroup {
  return card.tone === "rojo" || card.urgent ? "atencion" : "avisos";
}

// Dentro de cada grupo: las urgentes primero y después lo más reciente (o lo que vence antes).
export function splitGroups(cards: NoticeCard[]): Record<NoticeGroup, NoticeCard[]> {
  const sorted = [...cards].sort((a, b) => a.rank - b.rank || b.time - a.time);
  return {
    atencion: sorted.filter((c) => groupOf(c) === "atencion"),
    avisos: sorted.filter((c) => groupOf(c) === "avisos"),
  };
}

export type NoticeChip = {
  key: string;
  label: string;
  count: number;
  // Grupo de la hoja al que lleva el chip.
  group: NoticeGroup;
  // "peligro": rojas; "tarea": lo que el jugador debe responder; "neutro": el resto.
  style: "peligro" | "tarea" | "neutro";
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// "Vence en 5 h" → "vence en 5 h".
const dueText = (badge: string | null) => (badge ? ` · ${badge.charAt(0).toLowerCase()}${badge.slice(1)}` : "");

// Las tareas del jugador van primero (esfuerzo de entrenamiento o partido, esfuerzo del
// gimnasio y check de bienestar); después las rojas por tipo, y al final "N avisos" con
// todo lo demás. Sin nada, no hay chips.
export function buildChips(cards: NoticeCard[]): NoticeChip[] {
  const chips: NoticeChip[] = [];
  const used = new Set<string>();
  const take = (pred: (c: NoticeCard) => boolean) => {
    const list = cards.filter(pred);
    for (const c of list) used.add(c.key);
    return list;
  };

  const esfuerzo = take((c) => c.kind === "tarea_esfuerzo");
  if (esfuerzo.length) {
    chips.push({
      key: "tarea_esfuerzo",
      label: `${plural(esfuerzo.length, "esfuerzo", "esfuerzos")} por responder`,
      count: esfuerzo.length,
      group: esfuerzo.some((c) => groupOf(c) === "atencion") ? "atencion" : "avisos",
      style: "tarea",
    });
  }
  const gym = take((c) => c.kind === "tarea_gimnasio");
  if (gym.length) {
    chips.push({
      key: "tarea_gimnasio",
      label: `${plural(gym.length, "esfuerzo", "esfuerzos")} de gimnasio por responder`,
      count: gym.length,
      group: gym.some((c) => groupOf(c) === "atencion") ? "atencion" : "avisos",
      style: "tarea",
    });
  }
  const wellness = take((c) => c.kind === "tarea_bienestar");
  if (wellness.length) {
    chips.push({
      key: "tarea_bienestar",
      label: `Check de bienestar${dueText(wellness[0].badge)}`,
      count: wellness.length,
      group: groupOf(wellness[0]),
      style: "tarea",
    });
  }

  const red: { kind: string; one: string; many: string }[] = [
    { kind: "bienestar_bajo", one: "bienestar bajo", many: "bienestar bajo" },
    { kind: "carga_alta", one: "carga alta", many: "carga alta" },
    { kind: "evento_cancelado", one: "evento cancelado", many: "eventos cancelados" },
    { kind: "evento_modificado", one: "evento modificado", many: "eventos modificados" },
  ];
  for (const r of red) {
    const list = take((c) => c.kind === r.kind);
    if (list.length) {
      chips.push({
        key: r.kind,
        label: plural(list.length, r.one, r.many),
        count: list.length,
        group: "atencion",
        style: "peligro",
      });
    }
  }

  // Lo urgente que no tiene chip propio sigue en "Requiere atención".
  const urgentRest = cards.filter((c) => !used.has(c.key) && groupOf(c) === "atencion");
  if (urgentRest.length) {
    for (const c of urgentRest) used.add(c.key);
    chips.push({
      key: "atencion_otras",
      label: plural(urgentRest.length, "requiere atención", "requieren atención"),
      count: urgentRest.length,
      group: "atencion",
      style: "peligro",
    });
  }

  const rest = cards.filter((c) => !used.has(c.key));
  if (rest.length) {
    chips.push({
      key: "avisos",
      label: plural(rest.length, "aviso", "avisos"),
      count: rest.length,
      group: "avisos",
      style: "neutro",
    });
  }
  return chips;
}

// Insignia de la campana: el total, "9+" sobre 9; vacío si es 0.
export function badgeText(total: number): string | null {
  if (total <= 0) return null;
  return total > 9 ? "9+" : String(total);
}
