"use client";

// Una fila de la hoja de notificaciones: ícono con el color del tipo, título, detalle,
// fecha y link a su destino. Las de evento se descartan con la X; las de estado no.
// Textos, íconos y colores salen de lib/notifications.ts.
import Link from "next/link";
import type { ComponentType } from "react";
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
import { ListRow } from "@/app/ui-blocks";
import { TONE_COLOR, type NoticeCard, type NoticeIcon } from "@/lib/notifications";

export const NOTICE_ICONS: Record<NoticeIcon, ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
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

export function NoticeRow({
  card,
  onDismiss,
  onNavigate,
}: {
  card: NoticeCard;
  onDismiss: () => void;
  // Al seguir el link la hoja se cierra.
  onNavigate: () => void;
}) {
  const color = TONE_COLOR[card.tone];
  const Icon = NOTICE_ICONS[card.icon];
  const body = (
    <>
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${color}26` }}
      >
        <Icon aria-hidden className="size-5 text-ink" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-15 font-semibold text-ink">{card.title}</span>
        {card.detail && <span className="block text-13 text-muted">{card.detail}</span>}
        {card.badge && (
          <span className={`mt-0.5 block text-xs font-medium ${card.urgent ? "text-alerta-fg" : "text-muted"}`}>
            {card.badge}
          </span>
        )}
      </span>
      {card.href && <ChevronRight aria-hidden="true" className="size-5 shrink-0 self-center text-muted" />}
    </>
  );
  return (
    <ListRow className="items-start !gap-0 !px-0 !py-0 lg:!flex">
      {card.href ? (
        <Link
          href={card.href}
          onClick={onNavigate}
          className="flex min-h-14 min-w-0 flex-1 items-start gap-3 px-4 py-3 transition hover:bg-mist focus-visible:outline-2 focus-visible:outline-brand-strong"
        >
          {body}
        </Link>
      ) : (
        <div className="flex min-h-14 min-w-0 flex-1 items-start gap-3 px-4 py-3">{body}</div>
      )}
      {card.id && (
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex size-11 shrink-0 items-center justify-center self-start text-muted transition hover:bg-mist hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong"
        >
          <X aria-hidden="true" className="size-4" />
          <span className="sr-only">Descartar: {card.title}</span>
        </button>
      )}
    </ListRow>
  );
}
