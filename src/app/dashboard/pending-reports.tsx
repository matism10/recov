// "Pendientes" del jugador en el Resumen: sesiones por responder (sRPE) y el check de
// bienestar, de my_pending_reports. Sin pendientes, el bloque no aparece.
import Link from "next/link";
import { Activity, BicepsFlexed, ChartColumn, ChevronRight } from "lucide-react";
import { SectionTitle } from "@/app/ui";
import { dayLabel, sessionWhen, type PendingReport } from "@/lib/srpe";
import { todayInChile } from "@/lib/injuries";

export function PendingReports({ items }: { items: PendingReport[] }) {
  if (items.length === 0) return null;
  const today = todayInChile();
  return (
    <section className="mb-8" aria-labelledby="pendientes-title">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <SectionTitle>
          <span id="pendientes-title">Pendientes</span>
        </SectionTitle>
        <span className="text-sm text-muted">
          {items.length} por responder
        </span>
      </div>
      <ul className="grid gap-3 lg:grid-cols-2">
        {items.map((item) =>
          item.kind === "gym" ? (
            <li key={item.log_id}>
              <Link
                href={`/mi-plan/esfuerzo/${item.log_id}`}
                className="flex min-h-16 items-center gap-3.5 rounded-2xl bg-brand-soft p-4 text-ink transition hover:bg-brand/30"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand">
                  <BicepsFlexed aria-hidden="true" className="size-5 text-ink" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">¿Qué tan dura fue la sesión de gimnasio?</span>
                  <span className="block text-sm text-ink/80">
                    {item.report_date === today ? "Hoy" : dayLabel(item.report_date)} · {item.label ?? "Por tu cuenta"} ·{" "}
                    {item.minutes} min
                  </span>
                </span>
                <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-brand-text" />
              </Link>
            </li>
          ) : item.kind === "session" ? (
            <li key={item.event_id}>
              <Link
                href={`/reportar/${item.event_id}`}
                className="flex min-h-16 items-center gap-3.5 rounded-2xl bg-brand-soft p-4 text-ink transition hover:bg-brand/30"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand">
                  <ChartColumn aria-hidden="true" className="size-5 text-ink" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {item.event_type === "competencia"
                      ? "¿Qué tan duro fue el partido?"
                      : "¿Qué tan duro fue el entrenamiento?"}
                  </span>
                  <span className="block text-sm text-ink/80">
                    {sessionWhen(item.starts_at)} · {item.minutes} min{item.estimated ? " (estimado)" : ""}
                  </span>
                </span>
                <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-brand-text" />
              </Link>
            </li>
          ) : (
            <li key="bienestar">
              <Link
                href="/bienestar"
                className="flex min-h-16 items-center gap-3.5 rounded-2xl border border-line bg-mist p-4 text-ink transition hover:bg-white"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white">
                  <Activity aria-hidden="true" className="size-5 text-brand-text" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">Check de bienestar</span>
                  <span className="block text-sm text-ink/80">
                    {item.report_date === today ? "Hoy" : `Del ${dayLabel(item.report_date)}`} · 5 preguntas
                  </span>
                </span>
                <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-brand-text" />
              </Link>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

// "Mi bienestar" (junto a "Mi carga"): último total sobre 25.
export function MyWellness({ last }: { last: { report_date: string; total: number } | null }) {
  return (
    <section>
      <SectionTitle className="mb-3">Mi bienestar</SectionTitle>
      <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-mist p-5">
        {last ? (
          <>
            <span className="text-sm text-muted">Último: {dayLabel(last.report_date)}</span>
            <span className="font-display text-2xl font-extrabold text-ink tabular-nums">
              {last.total}
              <span className="text-sm font-semibold text-muted"> / 25</span>
            </span>
          </>
        ) : (
          <span className="text-sm text-muted">Aún no respondes el check de bienestar.</span>
        )}
      </div>
    </section>
  );
}
