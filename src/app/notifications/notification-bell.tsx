"use client";

// Campana del encabezado: conteo en una insignia y, al abrir, la hoja con todas las
// notificaciones (hoja inferior en celular, panel de ~420 px bajo la campana, a la derecha, en
// escritorio). El conteo se pide después de montar (no frena ninguna pantalla).
import { useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Bell, X } from "lucide-react";
import { Card, EmptyState } from "@/app/ui-blocks";
import { TONE_COLOR } from "@/lib/notifications";
import { GROUP_LABEL, badgeText, splitGroups, type NoticeGroup } from "@/lib/notice-groups";
import { NoticeRow } from "./notice-row";
import {
  closeNotifications,
  dismissAllCards,
  dismissCard,
  openNotifications,
  refreshNotifications,
  useNotificationState,
} from "./store";

const FOCUSABLE = "button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])";

export function NotificationBell({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { cards, open } = useNotificationState();
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const total = cards?.length ?? 0;
  const badge = badgeText(total);

  // Después de montar y en cada pantalla nueva; también al volver a la pestaña.
  useEffect(() => {
    void refreshNotifications();
  }, [pathname]);
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && void refreshNotifications();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const close = useCallback(() => {
    closeNotifications();
    triggerRef.current?.focus();
  }, []);

  const base =
    tone === "dark"
      ? "bg-white/15 text-white hover:bg-white/25 focus-visible:outline-white"
      : "border border-line bg-white text-ink hover:bg-mist focus-visible:outline-brand-strong";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close() : openNotifications())}
        aria-label={`Notificaciones, ${total}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`relative flex size-11 shrink-0 items-center justify-center rounded-xl transition focus-visible:outline-2 focus-visible:outline-offset-2 lg:size-10 ${base}`}
      >
        <Bell aria-hidden="true" className="size-5 lg:size-4" />
        {badge && (
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs leading-none font-semibold text-white ring-2 ring-white"
          >
            {badge}
          </span>
        )}
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(<NotificationSheet onClose={close} />, document.body)}
    </>
  );
}

function NotificationSheet({ onClose }: { onClose: () => void }) {
  const { cards, group, error } = useNotificationState();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const groups = splitGroups(cards ?? []);
  const total = cards?.length ?? 0;
  const dismissible = (cards ?? []).some((c) => c.id);

  // Sin scroll de fondo y la lista fresca al abrir.
  useEffect(() => {
    void refreshNotifications();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Foco al título y, si vienen de un chip, desplazada a ese grupo.
  const loaded = cards !== null;
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    panel.querySelector<HTMLElement>("[data-title]")?.focus({ preventScroll: true });
    if (group) panel.querySelector<HTMLElement>(`[data-group="${group}"]`)?.scrollIntoView({ block: "start" });
  }, [group, loaded]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Tab") {
      // Foco atrapado dentro de la hoja.
      const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || active?.hasAttribute("data-title"))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[60]" onKeyDown={onKeyDown}>
      <div aria-hidden="true" className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl border border-line bg-white shadow-lg lg:inset-x-auto lg:top-[4.5rem] lg:right-8 lg:bottom-auto lg:max-h-[min(640px,calc(100dvh-6rem))] lg:w-[420px] lg:rounded-2xl"
      >
        <div aria-hidden="true" className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-line-strong lg:hidden" />
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-3 pb-2 lg:px-5 lg:pt-4">
          <h2 id={titleId} data-title tabIndex={-1} className="font-sans text-lg font-bold text-ink outline-none">
            Notificaciones{total > 0 ? ` (${total})` : ""}
          </h2>
          <div className="-mr-2 flex items-center">
            {dismissible && (
              <button
                type="button"
                onClick={() => void dismissAllCards()}
                className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-medium text-brand-text underline focus-visible:outline-2 focus-visible:outline-brand-strong"
              >
                Descartar todas
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-11 items-center justify-center rounded-xl text-muted transition hover:bg-mist focus-visible:outline-2 focus-visible:outline-brand-strong"
            >
              <X aria-hidden="true" className="size-5" />
              <span className="sr-only">Cerrar</span>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pb-5 lg:px-5">
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          {cards === null ? (
            <p role="status" className="py-8 text-center text-sm text-muted">
              Cargando…
            </p>
          ) : total === 0 ? (
            <EmptyState title="No tienes notificaciones" />
          ) : (
            (["atencion", "avisos"] as NoticeGroup[]).map((g) =>
              groups[g].length === 0 ? null : (
                <section key={g} data-group={g} aria-labelledby={`${titleId}-${g}`} className="scroll-mt-1">
                  <h3
                    id={`${titleId}-${g}`}
                    className="mb-2 flex items-center gap-2 text-13 font-semibold tracking-wide text-muted uppercase"
                  >
                    <span
                      aria-hidden="true"
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: g === "atencion" ? TONE_COLOR.rojo : TONE_COLOR.gris }}
                    />
                    {GROUP_LABEL[g]} ({groups[g].length})
                  </h3>
                  <Card flush>
                    <ul className="divide-y divide-line">
                      {groups[g].map((card) => (
                        <NoticeRow
                          key={card.key}
                          card={card}
                          onDismiss={() => void dismissCard(card)}
                          onNavigate={onClose}
                        />
                      ))}
                    </ul>
                  </Card>
                </section>
              ),
            )
          )}
        </div>
      </div>
    </div>
  );
}
