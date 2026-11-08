"use client";

// Notificaciones del Resumen: las 3 más urgentes y "Ver todas (N)", que abre una hoja
// separada por color. Las de evento se descartan con la X; las de estado no tienen X
// (se van solas cuando la condición deja de cumplirse). Textos y colores: lib/notifications.ts.
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ComponentType } from "react";
import {
  Activity,
  ArrowLeftRight,
  BadgeCheck,
  BicepsFlexed,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  ChartColumn,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  Dumbbell,
  FileText,
  Gauge,
  HeartPulse,
  KeyRound,
  ListChecks,
  PartyPopper,
  Stethoscope,
  Timer,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  UserCog,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { SectionTitle } from "@/app/ui";
import { TONE_COLOR, TONE_GROUPS, type NoticeCard, type NoticeIcon } from "@/lib/notifications";
import { dismissAllNotifications, dismissNotification } from "./actions";

const VISIBLE = 3;

const ICONS: Record<NoticeIcon, ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  "calendar-x": CalendarX2,
  "calendar-plus": CalendarPlus,
  "calendar-clock": CalendarClock,
  clipboard: ClipboardList,
  "user-minus": UserMinus,
  stethoscope: Stethoscope,
  "circle-check": CircleCheck,
  "list-checks": ListChecks,
  party: PartyPopper,
  activity: Activity,
  alert: TriangleAlert,
  dumbbell: Dumbbell,
  gauge: Gauge,
  "badge-check": BadgeCheck,
  "user-cog": UserCog,
  users: Users,
  arrows: ArrowLeftRight,
  "user-plus": UserPlus,
  file: FileText,
  key: KeyRound,
  chart: ChartColumn,
  biceps: BicepsFlexed,
  heart: HeartPulse,
  "trending-up": TrendingUp,
  "trending-down": TrendingDown,
  timer: Timer,
  "calendar-check": CalendarCheck,
};

export function Notifications({ cards }: { cards: NoticeCard[] }) {
  // Descartadas en esta pantalla (se ocultan al tiro; la base las marca por detrás).
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const shown = cards.filter((c) => !hidden.has(c.key));
  if (shown.length === 0) return null;
  const dismissible = shown.filter((c) => c.id);

  const hide = (keys: string[]) => setHidden((prev) => new Set([...prev, ...keys]));
  const unhide = (keys: string[]) =>
    setHidden((prev) => {
      const next = new Set(prev);
      for (const k of keys) next.delete(k);
      return next;
    });

  const dismiss = (card: NoticeCard) => {
    if (!card.id) return;
    setError(null);
    hide([card.key]);
    startTransition(async () => {
      const res = await dismissNotification(card.id!);
      if (res.error) {
        unhide([card.key]);
        setError(res.error);
      }
    });
  };

  const dismissAll = () => {
    const keys = dismissible.map((c) => c.key);
    setError(null);
    hide(keys);
    startTransition(async () => {
      const res = await dismissAllNotifications();
      if (res.error) {
        unhide(keys);
        setError(res.error);
      }
    });
  };

  return (
    <section className="mb-8" aria-labelledby="notificaciones-title">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <SectionTitle>
          <span id="notificaciones-title">Notificaciones</span>
        </SectionTitle>
        {shown.length > VISIBLE && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex min-h-11 items-center text-sm font-medium text-brand-text underline"
          >
            Ver todas ({shown.length})
          </button>
        )}
      </div>
      <ul className="grid gap-3 lg:grid-cols-3">
        {shown.slice(0, VISIBLE).map((card) => (
          <li key={card.key}>
            <NoticeRow card={card} onDismiss={() => dismiss(card)} />
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      {open && (
        <AllSheet
          cards={shown}
          canDismissAll={dismissible.length > 0}
          onDismiss={dismiss}
          onDismissAll={dismissAll}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}

// Una tarjeta: franja izquierda de 4 px del color del tipo, ícono, título y detalle.
function NoticeRow({ card, onDismiss }: { card: NoticeCard; onDismiss: () => void }) {
  const color = TONE_COLOR[card.tone];
  const Icon = ICONS[card.icon];
  const body = (
    <>
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${color}26` }}
      >
        <Icon aria-hidden className="size-5 text-ink" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{card.title}</span>
        {card.detail && <span className="block text-sm text-muted">{card.detail}</span>}
        {card.badge && (
          <span
            className={`mt-1 inline-block text-xs font-medium ${card.urgent ? "text-alerta-fg" : "text-muted"}`}
          >
            {card.badge}
          </span>
        )}
      </span>
      {card.href && <ChevronRight aria-hidden="true" className="size-5 shrink-0 self-center text-muted" />}
    </>
  );
  return (
    <div
      className="flex h-full items-stretch overflow-hidden rounded-xl border border-line border-l-4 bg-mist"
      style={{ borderLeftColor: color }}
    >
      {card.href ? (
        <Link href={card.href} className="flex min-h-16 min-w-0 flex-1 items-start gap-3 p-4 transition hover:bg-white">
          {body}
        </Link>
      ) : (
        <div className="flex min-h-16 min-w-0 flex-1 items-start gap-3 p-4">{body}</div>
      )}
      {card.id && (
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex w-11 shrink-0 items-start justify-center pt-3.5 text-muted transition hover:bg-white hover:text-ink"
        >
          <X aria-hidden="true" className="size-4" />
          <span className="sr-only">Descartar: {card.title}</span>
        </button>
      )}
    </div>
  );
}

// "Ver todas": hoja inferior en celular y cuadro centrado en escritorio, por color.
function AllSheet({
  cards,
  canDismissAll,
  onDismiss,
  onDismissAll,
  onClose,
}: {
  cards: NoticeCard[];
  canDismissAll: boolean;
  onDismiss: (card: NoticeCard) => void;
  onDismissAll: () => void;
  onClose: () => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end bg-ink/30 lg:items-center lg:justify-center lg:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside
        role="dialog"
        aria-modal
        aria-labelledby="notificaciones-todas"
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-white p-5 shadow-lg lg:max-w-xl lg:rounded-2xl lg:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="notificaciones-todas" ref={titleRef} tabIndex={-1} className="text-xl font-semibold text-ink outline-none">
            Notificaciones ({cards.length})
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-mt-2 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-mist"
          >
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>
        <div className="space-y-5">
          {TONE_GROUPS.map(({ tone, label }) => {
            const group = cards.filter((c) => c.tone === tone);
            if (group.length === 0) return null;
            return (
              <section key={tone} aria-label={label}>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-muted uppercase">
                  <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: TONE_COLOR[tone] }} />
                  {label} ({group.length})
                </h3>
                <ul className="space-y-2">
                  {group.map((card) => (
                    <li key={card.key}>
                      <NoticeRow card={card} onDismiss={() => onDismiss(card)} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
        {canDismissAll && (
          <button
            type="button"
            onClick={onDismissAll}
            className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-muted underline"
          >
            Descartar todas
          </button>
        )}
      </aside>
    </div>
  );
}
