// Ranking de asistencia a entrenamientos: la tarjeta del Resumen (top 5 del último
// mes) y la lista completa de /asistencia usan la misma fila.
import Link from "next/link";
import { ListChecks } from "lucide-react";
import {
  attendanceBarClass,
  attendancePercent,
  type AttendanceRow,
} from "@/lib/attendance";
import { MetricsError, metricCardClass } from "@/app/metrics";
import { SectionTitle, buttonSecondary } from "@/app/ui";

export function AttendanceList({ rows, highlightId }: { rows: AttendanceRow[]; highlightId?: string | null }) {
  return (
    <ol className="space-y-3">
      {rows.map((r, i) => {
        const pct = attendancePercent(r);
        const mine = highlightId === r.player_id;
        return (
          <li
            key={r.player_id}
            className={`grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 ${
              mine ? "-mx-2 rounded-lg bg-brand-soft px-2 py-1" : ""
            }`}
          >
            <span className="row-span-2 text-right text-sm font-medium text-muted tabular-nums">{i + 1}</span>
            <span className="truncate text-sm font-medium text-ink">{r.full_name}</span>
            <span className="text-sm font-semibold text-ink tabular-nums">{pct} %</span>
            <span
              role="img"
              aria-label={`${pct} % de asistencia`}
              className="block h-2 overflow-hidden rounded-full bg-line"
            >
              <span className={`block h-full rounded-full ${attendanceBarClass(pct)}`} style={{ width: `${pct}%` }} />
            </span>
            <span className="text-xs text-muted tabular-nums">
              {r.attended}/{r.total}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// Tarjeta del Resumen (métrica opcional 'asistencia'): los 5 primeros del último mes.
export function AttendanceCard({
  result,
}: {
  result: { ok: true; data: AttendanceRow[] } | { ok: false };
}) {
  return (
    <section className={`flex flex-col ${metricCardClass}`}>
      <SectionTitle>Asistencia a entrenamientos</SectionTitle>
      <p className="mt-0.5 text-xs text-muted">Último mes</p>
      <div className="mt-4 flex-1">
        {!result.ok ? (
          <MetricsError />
        ) : result.data.length === 0 ? (
          <p className="flex items-start gap-2 text-sm text-muted">
            <ListChecks aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            Todavía no hay listas guardadas este mes. El staff pasa lista desde cada entrenamiento en el
            calendario.
          </p>
        ) : (
          <AttendanceList rows={result.data.slice(0, 5)} />
        )}
      </div>
      <Link href="/asistencia" className={`mt-4 text-sm ${buttonSecondary}`}>
        Ver asistencia completa
      </Link>
    </section>
  );
}
