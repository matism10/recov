"use client";

// Franja "Requiere atención" del Resumen: chips de 44 px por tipo con su conteo (las
// tareas del jugador primero) y "N avisos" con el resto. Cada chip abre la hoja de la
// campana, desplazada a su grupo. Sin notificaciones no aparece. La lista completa y el
// descarte viven en la campana (src/app/notifications).
import { useEffect, type ReactNode } from "react";
import { buildChips, type NoticeChip } from "@/lib/notice-groups";
import type { NoticeCard } from "@/lib/notifications";
import { openNotifications, seedNotifications, useNotificationState } from "@/app/notifications/store";

const CHIP_STYLE: Record<NoticeChip["style"], string> = {
  peligro: "border-danger/30 bg-lesionado-bg text-lesionado-fg",
  tarea: "border-brand-line bg-brand-wash text-brand-deep",
  neutro: "border-line bg-card text-ink",
};

export function AttentionStrip({
  cards: initial,
  action,
  className = "",
}: {
  cards: NoticeCard[];
  // Acción a la derecha de la franja (por ejemplo "Ver métricas"). Con ella la franja aparece aunque no haya avisos.
  action?: ReactNode;
  className?: string;
}) {
  const live = useNotificationState();
  // Hasta sembrar la campana se muestra lo que trajo el servidor (así no hay parpadeo).
  useEffect(() => {
    seedNotifications(initial);
  }, [initial]);

  const cards = live.seed === initial && live.cards ? live.cards : initial;
  const chips = buildChips(cards);
  if (chips.length === 0 && !action) return null;
  const urgent = chips.some((c) => c.style !== "neutro");

  return (
    <section id="notificaciones" aria-label="Notificaciones" className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {urgent && <p className="mb-2 text-13 font-semibold tracking-wide text-muted uppercase">Requiere atención</p>}
          <ul className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <li key={chip.key}>
                <button
                  type="button"
                  onClick={() => openNotifications(chip.group)}
                  aria-haspopup="dialog"
                  className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong ${CHIP_STYLE[chip.style]}`}
                >
                  {chip.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
        {action}
      </div>
    </section>
  );
}
