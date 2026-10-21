// Sección "Carga del plantel" de /metricas (solo staff): resumen (jugadores con
// carga alta y sin minutos o sin partidos) y el ranking ordenado por carga, con
// mini barras de los últimos partidos escaladas a la duración del deporte. En
// Métricas se muestran los primeros 5; /metricas/carga tiene el ranking completo.
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
import { SectionTitle, buttonSecondary } from "@/app/ui";

export const RANKING_PREVIEW = 5;

export function LoadSection({ result }: { result: LoadResult<TeamLoad> }) {
  return (
    // Una sola lámina: título, resumen, ranking y el enlace al ranking completo.
    <section className={`mb-8 ${metricCardClass}`}>
      <SectionTitle className="mb-1">Carga del plantel</SectionTitle>
      {!result.ok ? (
        <MetricsError />
      ) : result.data.matches_count === 0 ? (
        <p className="mt-2 text-sm text-muted">
          Aún no hay partidos con participación cargada. Se carga desde Nóminas o desde el
          calendario, en cada partido.
        </p>
      ) : (
        <div className="space-y-4">
          <LoadIntro load={result.data} />
          <LoadSummary load={result.data} />
          <LoadRanking load={result.data} limit={RANKING_PREVIEW} bare />
          {result.data.players.length > RANKING_PREVIEW && (
            <Link href="/metricas/carga" className={`w-full text-sm sm:w-auto ${buttonSecondary}`}>
              Ver ranking completo
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

// Ventana, modo y avisos (otro modo, pocos partidos).
export function LoadIntro({ load }: { load: TeamLoad }) {
  const n = load.matches_count;
  // Partidos de la ventana con al menos una participación cargada en otro modo.
  const otherMatches = new Set(
    load.players.flatMap((p) => p.values.filter((v) => v.other_mode).map((v) => v.event_id)),
  ).size;
  const first = load.matches[0];
  const last = load.matches[load.matches.length - 1];
  return (
    <div className="space-y-1">
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
        <p className="text-sm text-muted">Con menos de 3 partidos no se calcula el semáforo de carga.</p>
      )}
    </div>
  );
}

// Resumen: cuántos con carga alta y cuántos sin minutos (o sin partidos en "jugó").
export function LoadSummary({ load }: { load: TeamLoad }) {
  const n = load.matches_count;
  const jugo = load.mode === "jugo";
  const ready = n >= 3;
  const high = load.players.filter((p) => p.status === "alta").length;
  const none = load.players.filter((p) => p.status === "sin_minutos" || p.status === "sin_partidos").length;
  const cards = [
    { value: high, label: "con carga alta" },
    {
      value: none,
      label: jugo
        ? `sin partidos en los últimos ${n}`
        : `sin minutos en los últimos ${n} ${n === 1 ? "partido" : "partidos"}`,
    },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="flex flex-col-reverse rounded-xl bg-mist p-4">
          <dt className="text-sm text-muted">{c.label}</dt>
          <dd className="font-display text-3xl font-bold text-ink tabular-nums">{ready ? c.value : "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

// Ranking por carga (todos o los primeros `limit`).
// `bare`: sin tarjeta propia, para ir dentro de otra lámina.
export function LoadRanking({
  load,
  limit,
  bare = false,
}: {
  load: TeamLoad;
  limit?: number;
  bare?: boolean;
}) {
  const n = load.matches_count;
  const rows = limit ? load.players.slice(0, limit) : load.players;
  return (
    <div className={bare ? "border-t border-line pt-4" : metricCardClass}>
      <h3 className="mb-2 font-medium text-ink">
        Ranking por carga{limit ? ` · primeros ${Math.min(limit, load.players.length)}` : ""}
      </h3>
      <ol className="divide-y divide-line">
        {rows.map((p, i) => (
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
            <span className="w-16 shrink-0 text-right text-sm font-semibold text-ink tabular-nums sm:w-20">
              {totalLabel(load.mode, p.total, n)}
            </span>
            <span className="w-24 shrink-0 text-right">{p.status && <StatusChip status={p.status} />}</span>
          </li>
        ))}
      </ol>
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
