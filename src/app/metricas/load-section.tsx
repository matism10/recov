// "Minutos jugados" (Métricas → Carga) y el ranking completo de /metricas/carga: minutos de
// los últimos partidos con participación cargada, con mini barras escaladas a la duración
// del partido del deporte. Sin semáforo ni etiqueta "Alta": solo los minutos. En Métricas
// van los primeros 5 y una lista desplegable con quienes no sumaron minutos.
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { NOMINA_MODE_LABEL, type LoadResult, type PlayerLoad, type TeamLoad } from "@/lib/match-load";
import { matchDateLabel } from "@/app/load-chart";
import { LoadRow } from "./load-row";
import { MetricsBlock, MetricsError } from "@/app/metrics";
import { buttonSecondary } from "@/app/ui";

export const RANKING_PREVIEW = 5;

// Sin minutos (o sin partidos en "jugó") en la ventana.
export function withoutMinutes(load: TeamLoad) {
  return load.players.filter(
    (p) =>
      p.status === "sin_minutos" ||
      p.status === "sin_partidos" ||
      (p.status === null && (load.mode === "jugo" ? p.played_count === 0 : p.total === 0) && p.other_mode === 0),
  );
}

export function MinutesSection({ result }: { result: LoadResult<TeamLoad> }) {
  const heading = "Minutos jugados";
  if (!result.ok) {
    return (
      <MetricsBlock heading={heading} info="minutos">
        <MetricsError />
      </MetricsBlock>
    );
  }
  const load = result.data;
  if (load.matches_count === 0) {
    return (
      <MetricsBlock heading={heading} info="minutos">
        <p className="text-sm text-muted">
          Aún no hay partidos con participación cargada. Se carga desde Nóminas o desde el calendario, en cada partido.
        </p>
      </MetricsBlock>
    );
  }
  const n = load.matches_count;
  const none = withoutMinutes(load);
  return (
    <MetricsBlock heading={heading} info="minutos">
      <div className="space-y-4">
        <LoadIntro load={load} />
        <LoadList load={load} players={load.players.slice(0, RANKING_PREVIEW)} ranked />
        {load.players.length > RANKING_PREVIEW && (
          <Link href="/metricas/carga" className={`w-full text-sm sm:w-auto ${buttonSecondary}`}>
            Ver ranking completo
          </Link>
        )}
        {none.length > 0 && (
          <details className="group rounded-lg bg-mist px-3 py-2">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
              {load.mode === "jugo"
                ? `Sin partidos en los últimos ${n} (${none.length})`
                : `Sin minutos en los últimos ${n} ${n === 1 ? "partido" : "partidos"} (${none.length})`}
              <span aria-hidden="true" className="text-muted transition group-open:rotate-180">▾</span>
            </summary>
            <LoadList load={load} players={none} />
          </details>
        )}
      </div>
    </MetricsBlock>
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
        <p className="text-sm text-muted">Con menos de 3 partidos cargados, los minutos todavía dicen poco.</p>
      )}
    </div>
  );
}

// Lista de filas de minutos; `ranked` numera según el orden del ranking.
export function LoadList({ load, players, ranked = false }: { load: TeamLoad; players: PlayerLoad[]; ranked?: boolean }) {
  return (
    <ol className="divide-y divide-line">
      {players.map((p, i) => (
        <LoadRow
          key={p.player_id}
          player={p}
          rank={ranked ? i + 1 : undefined}
          mode={load.mode}
          matchMinutes={load.match_minutes}
          matchesCount={load.matches_count}
          matches={load.matches}
          scale={load.scale}
        />
      ))}
    </ol>
  );
}
