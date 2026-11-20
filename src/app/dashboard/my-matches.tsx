// "Mis partidos" (jugador): sus convocatorias con su participación. Solo datos
// propios (my_match_load).
import { participationLabel, type LoadScaleRow, type MyCallup } from "@/lib/match-load";
import { matchDateLabel } from "@/app/load-chart";
import { Card, CardHeader, ListRow, TableCard } from "@/app/ui-blocks";

export function MyMatches({
  callups,
  scale,
  starters,
  now,
}: {
  callups: MyCallup[];
  scale: LoadScaleRow[];
  starters: number;
  now: string; // ISO del momento del request, para separar convocatorias futuras
}) {
  return (
    <section>
      {callups.length === 0 ? (
        <Card>
          <CardHeader title="Mis partidos" />
          <p className="text-sm text-muted">Todavía no te han convocado.</p>
        </Card>
      ) : (
        <TableCard header={<CardHeader title="Mis partidos" className="mb-0" />}>
          {callups.map((c) => {
            const upcoming = Date.parse(c.starts_at) > Date.parse(now);
            const label = participationLabel(c, scale);
            return (
              <ListRow key={c.event_id} className="justify-between">
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
                  className={`shrink-0 rounded-full px-3 py-1 text-13 font-medium whitespace-nowrap ${
                    upcoming
                      ? "bg-brand-soft text-brand-text"
                      : label
                        ? "bg-mist text-ink"
                        : "bg-surface-2 text-muted"
                  }`}
                >
                  {upcoming
                    ? c.slot === null
                      ? "Convocado"
                      : c.slot > starters
                        ? `Banca · ${c.slot}`
                        : `Titular · N° ${c.slot}`
                    : (label ?? "Sin cargar")}
                </span>
              </ListRow>
            );
          })}
        </TableCard>
      )}
    </section>
  );
}
