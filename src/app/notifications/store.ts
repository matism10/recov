"use client";

// Estado compartido de las notificaciones en el navegador: lo leen la campana del
// encabezado (que además muestra la hoja) y la franja del Resumen. Solo se modifica en
// efectos y eventos del cliente, nunca al renderizar en el servidor.
import { useMemo, useSyncExternalStore } from "react";
import type { NoticeCard } from "@/lib/notifications";
import type { NoticeGroup } from "@/lib/notice-groups";
import { dismissAllNotifications, dismissNotification } from "@/app/dashboard/actions";
import { loadNotifications } from "./actions";

type State = {
  // null = aún no se sabe (no se ha pedido ni sembrado).
  cards: NoticeCard[] | null;
  // Lo último que sembró el Resumen (para saber si las tarjetas ya son las suyas).
  seed: NoticeCard[] | null;
  scope: string | null;
  open: boolean;
  group: NoticeGroup | null;
  error: string | null;
};

const SERVER_STATE: State = { cards: null, seed: null, scope: null, open: false, group: null, error: null };
let state: State = SERVER_STATE;
// Descartadas en este navegador (se ocultan al tiro; la base las marca por detrás).
const hidden = new Set<string>();
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export function useNotificationState() {
  const s = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );
  // `hidden` cambia siempre junto con un `set`, así que depender de `s` basta.
  const cards = useMemo(() => (s.cards ? s.cards.filter((c) => !hidden.has(c.key)) : null), [s]);
  return { ...s, cards };
}

// El Resumen ya trae las tarjetas del servidor: las deja listas para la campana.
export function seedNotifications(cards: NoticeCard[]) {
  set({ cards, seed: cards });
}

export async function refreshNotifications() {
  try {
    const res = await loadNotifications();
    if (!res.ok) return;
    if (state.scope !== res.scope) hidden.clear();
    set({ cards: res.cards, scope: res.scope });
  } catch {
    // Sin red: se queda lo último que se sabía.
  }
}

export function openNotifications(group: NoticeGroup | null = null) {
  set({ open: true, group, error: null });
}

export function closeNotifications() {
  set({ open: false, group: null });
}

async function run(keys: string[], action: () => Promise<{ error?: string }>) {
  keys.forEach((k) => hidden.add(k));
  set({ error: null });
  try {
    const res = await action();
    if (res.error) throw new Error(res.error);
  } catch (e) {
    keys.forEach((k) => hidden.delete(k));
    set({ error: e instanceof Error ? e.message : "No se pudo descartar. Intenta de nuevo." });
  }
}

export function dismissCard(card: NoticeCard) {
  if (!card.id) return;
  return run([card.key], () => dismissNotification(card.id!));
}

export function dismissAllCards() {
  const keys = (state.cards ?? []).filter((c) => c.id && !hidden.has(c.key)).map((c) => c.key);
  if (keys.length === 0) return;
  return run(keys, () => dismissAllNotifications());
}
