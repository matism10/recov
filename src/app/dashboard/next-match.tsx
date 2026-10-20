import Link from "next/link";
import { CalendarClock, ClipboardList } from "lucide-react";
import { chileDateTime, compactDayLabel, eventTitle } from "@/lib/events";

// Aviso del próximo partido (competencia no cancelada) con enlace a su detalle
// en el calendario. Quien arma nóminas ve además un botón con ícono que lleva
// directo a armar la nómina de ese partido. El display (flex o inline-flex) lo
// define quien lo usa. `stacked` (móvil): etiqueta arriba y partido abajo.
export function NextMatch({
  match,
  canNomina = false,
  stacked = false,
  className = "",
}: {
  match: { id: string; starts_at: string; opponent: string | null };
  canNomina?: boolean;
  stacked?: boolean;
  className?: string;
}) {
  const { date, time } = chileDateTime(match.starts_at);
  return (
    <div
      className={`min-h-11 items-stretch overflow-hidden rounded-xl border border-line bg-white text-sm ${className}`}
    >
      <Link
        href={`/calendario?fecha=${date}&evento=${match.id}`}
        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 transition hover:bg-mist"
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
      {canNomina && (
        <Link
          href={`/calendario/${match.id}/disponibles`}
          title="Armar nómina de este partido"
          aria-label="Armar nómina de este partido"
          className="flex min-w-11 shrink-0 items-center justify-center gap-1.5 border-l border-line px-3 text-brand-text transition hover:bg-brand-soft"
        >
          <ClipboardList aria-hidden="true" className="size-5" />
          <span className="text-xs font-semibold lg:sr-only">Nómina</span>
        </Link>
      )}
    </div>
  );
}
