// Sección "Carga del plantel" de /metricas (solo staff): jugadores con carga alta,
// jugadores sin minutos (o sin partidos en "jugó") y ranking ordenado por carga,
// con mini barras de los últimos partidos escaladas a la duración del deporte.
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import {
  LOAD_STATUS_LABEL,
  LOAD_STATUS_STYLE,
  NOMINA_MODE_LABEL,
  totalLabel,
  type LoadResult,
  type PlayerLoad,
  type TeamLoad,
} from "@/lib/match-load";
import { LoadMiniBars, matchDateLabel } from "@/app/load-chart";
import { MetricsError, metricCardClass } from "@/app/metrics";
import { SectionTitle } from "@/app/ui";

export function LoadSection({ result }: { result: LoadResult<TeamLoad> }) {
  return (
    <section className="mb-8">
      <SectionTitle className="mb-1">Carga del plantel</SectionTitle>
      {!result.ok ? (
        <MetricsError />
      ) : result.data.matches_count === 0 ? (
        <p className={`mt-3 text-sm text-muted ${metricCardClass}`}>
          Aún no hay partidos con participación cargada. Se carga desde el calendario, en
          cada partido.
        </p>
      ) : (
        <LoadContent load={result.data} />
      )}
    </section>
  );
}

function LoadContent({ load }: { load: TeamLoad }) {
  const n = load.matches_count;
  const jugo = load.mode === "jugo";
  const high = load.players.filter((p) => p.status === "alta");
  const none = load.players.filter((p) => p.status === "sin_minutos" || p.status === "sin_partidos");
  // Partidos de la ventana con al menos una participación cargada en otro modo.
  const otherMatches = new Set(
    load.players.flatMap((p) => p.values.filter((v) => v.other_mode).map((v) => v.event_id)),
  ).size;
  const first = load.matches[0];
  const last = load.matches[load.matches.length - 1];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Últimos {n} {n === 1 ? "partido" : "partidos"} con participación cargada
        {first && last && ` (${matchDateLabel(first.starts_at)} – ${matchDateLabel(last.starts_at)})`} ·{" "}
        {NOMINA_MODE_LABEL[load.mode]}
        {load.mode === "rango" && " · los minutos se estiman con el punto medio de cada rango"}
      </p>
      {otherMatches > 0 && (
        <p className="flex items-start gap-1.5 text-sm text-revision-fg">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {otherMatches === 1
            ? "1 partido cargado en otro modo: no suma en los minutos."
            : `${otherMatches} partidos cargados en otro modo: no suman en los minutos.`}
        </p>
      )}
      {n < 3 && (
        <p className="text-sm text-muted">
          Con menos de 3 partidos no se calcula el semáforo de carga.
        </p>
      )}

      {n >= 3 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <NameCard
            title="Carga alta"
            hint={jugo ? "Jugaron todos los partidos" : "25 % o más sobre el promedio"}
            players={high}
            empty="Nadie con carga alta."
          />
          <NameCard
            title={jugo ? "Sin partidos" : "Sin minutos"}
            hint={jugo ? "No jugaron en la ventana" : "0 minutos en la ventana"}
            players={none}
            empty={jugo ? "Todos jugaron algún partido." : "Todos sumaron minutos."}
          />
        </div>
      )}

      <div className={metricCardClass}>
        <h3 className="mb-3 font-medium text-ink">Ranking por carga</h3>
        <ol className="divide-y divide-line">
          {load.players.map((p, i) => (
            <li key={p.player_id} className="flex items-center gap-3 py-2.5">
              <span className="w-5 shrink-0 text-right text-xs text-muted tabular-nums">{i + 1}</span>
              <Link
                href={`/jugadores/${p.player_id}`}
                className="min-w-0 flex-1 truncate font-medium text-ink hover:underline"
              >
                {p.full_name}
              </Link>
              <LoadMiniBars
                values={p.values}
                mode={load.mode}
                matchMinutes={load.match_minutes}
                label={`Últimos partidos de ${p.full_name}`}
              />
              <span className="w-20 shrink-0 text-right text-sm font-semibold text-ink tabular-nums">
                {totalLabel(load.mode, p.total, n)}
              </span>
              <span className="hidden w-24 shrink-0 sm:block">
                {p.status && <StatusChip status={p.status} />}
              </span>
              {p.status && (
                <span className="sm:hidden">
                  <StatusChip status={p.status} />
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: NonNullable<PlayerLoad["status"]> }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${LOAD_STATUS_STYLE[status]}`}
    >
      {LOAD_STATUS_LABEL[status]}
    </span>
  );
}

function NameCard({
  title,
  hint,
  players,
  empty,
}: {
  title: string;
  hint: string;
  players: PlayerLoad[];
  empty: string;
}) {
  return (
    <div className={metricCardClass}>
      <p className="text-sm text-muted">{title}</p>
      <p className="font-display text-3xl font-bold text-ink">{players.length}</p>
      <p className="mb-2 text-xs text-muted">{hint}</p>
      {players.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {players.map((p) => (
            <li key={p.player_id}>
              <Link href={`/jugadores/${p.player_id}`} className="text-ink hover:underline">
                {p.full_name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
