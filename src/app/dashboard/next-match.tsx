import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { chileDateTime, compactDayLabel, eventTitle } from "@/lib/events";

// Aviso del próximo partido (competencia no cancelada) con enlace a su detalle
// en el calendario. El display (flex o inline-flex) lo define quien lo usa.
// `stacked` (móvil): etiqueta arriba y partido abajo, sin truncar.
export function NextMatch({
  match,
  stacked = false,
  className = "",
}: {
  match: { id: string; starts_at: string; opponent: string | null };
  stacked?: boolean;
  className?: string;
}) {
  const { date, time } = chileDateTime(match.starts_at);
  return (
    <Link
      href={`/calendario?fecha=${date}&evento=${match.id}`}
      className={`min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm transition hover:bg-mist ${className}`}
    >
      <CalendarClock aria-hidden="true" className="size-5 shrink-0 text-brand-strong" />
      <span className={stacked ? "min-w-0" : "contents"}>
        <span className={stacked ? "block text-muted" : "text-muted"}>Próximo partido</span>
        <span
          className={
            stacked ? "block font-semibold text-ink" : "min-w-0 truncate font-semibold text-ink"
          }
        >
          {compactDayLabel(date)}
          <span className="sr-only">, {time}</span> ·{" "}
          {eventTitle({ type: "competencia", opponent: match.opponent })}
        </span>
      </span>
    </Link>
  );
}
