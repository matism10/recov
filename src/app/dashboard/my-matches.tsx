// "Mis partidos" (jugador): sus convocatorias con su participación. Solo datos
// propios (my_match_load).
import { participationLabel, type LoadScaleRow, type MyCallup } from "@/lib/match-load";
import { matchDateLabel } from "@/app/load-chart";
import { SectionTitle, cardClass } from "@/app/ui";

export function MyMatches({
  callups,
  scale,
  now,
}: {
  callups: MyCallup[];
  scale: LoadScaleRow[];
  now: string; // ISO del momento del request, para separar convocatorias futuras
}) {
  return (
    <section className="mb-8">
      <SectionTitle className="mb-3">Mis partidos</SectionTitle>
      {callups.length === 0 ? (
        <p className={`p-5 text-sm text-muted ${cardClass}`}>Todavía no te han convocado.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-mist">
          {callups.map((c) => {
            const upcoming = Date.parse(c.starts_at) > Date.parse(now);
            const label = participationLabel(c, scale);
            return (
              <li key={c.event_id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">
                    {c.opponent ? `vs. ${c.opponent}` : "Partido"}
                  </p>
                  <p className="text-sm text-muted">
                    {matchDateLabel(c.starts_at)}
                    {c.location && ` · ${c.location}`}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ${
                    upcoming
                      ? "bg-brand-soft text-brand-text"
                      : label
                        ? "bg-white text-ink"
                        : "bg-surface-2 text-muted"
                  }`}
                >
                  {upcoming ? "Convocado" : (label ?? "Sin cargar")}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
