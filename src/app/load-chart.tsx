// Gráficos de carga por partido (sin estado: sirven en servidor y cliente).
// Las barras se escalan a la duración del partido del deporte del club
// (match_minutes de la base). En "jugó" se dibujan puntos llenos o vacíos.
import { CLUB_TIME_ZONE } from "@/lib/events";
import {
  playedStreak,
  type LoadMatch,
  type LoadScaleRow,
  type LoadValue,
  type NominaMode,
} from "@/lib/match-load";

const shortDate = new Intl.DateTimeFormat("es-CL", {
  timeZone: CLUB_TIME_ZONE,
  day: "numeric",
  month: "short",
});

export function matchDateLabel(iso: string) {
  return shortDate.format(new Date(iso)).replace(".", "");
}

const pct = (value: number, max: number) => Math.max(0, Math.min(100, (value / max) * 100));

function valueText(v: LoadValue, mode: NominaMode, scale: LoadScaleRow[]) {
  if (v.other_mode) return "cargado en otro modo";
  if (!v.convocado) return "no convocado";
  if (!v.loaded) return "sin cargar";
  if (mode === "jugo") return v.played ? "jugó" : "no jugó";
  if (mode === "rango") {
    const row = scale.find((s) => s.bucket === v.bucket);
    return row && v.bucket ? `${row.label} min` : "no jugó";
  }
  return `${v.value ?? 0} min`;
}

// Mini barras del ranking: un partido por barra (o un punto en "jugó").
export function LoadMiniBars({
  values,
  mode,
  matchMinutes,
  label,
}: {
  values: LoadValue[];
  mode: NominaMode;
  matchMinutes: number;
  label: string;
}) {
  if (mode === "jugo") {
    return (
      <span role="img" aria-label={label} className="flex items-center gap-1.5">
        {values.map((v) => (
          <span
            key={v.event_id}
            className={`size-3 rounded-full border-2 ${
              v.other_mode
                ? "border-dashed border-muted"
                : v.played
                  ? "border-brand-strong bg-brand-strong"
                  : "border-line bg-white"
            }`}
          />
        ))}
      </span>
    );
  }
  return (
    <span role="img" aria-label={label} className="flex h-8 items-end gap-1">
      {values.map((v) =>
        v.other_mode ? (
          <span
            key={v.event_id}
            className="h-full w-2.5 rounded-sm border border-dashed border-muted"
          />
        ) : (
          <span key={v.event_id} className="flex h-full w-2.5 items-end rounded-sm bg-surface-2">
            <span
              className="w-full rounded-sm bg-brand-strong"
              style={{ height: `${pct(v.value ?? 0, matchMinutes)}%` }}
            />
          </span>
        ),
      )}
    </span>
  );
}

// Gráfico de los últimos partidos (ficha y "Mi carga").
//   exacto: barras con la línea del promedio del plantel por partido.
//   rango:  barras escalonadas (punto medio) con la etiqueta del rango.
//   jugo:   círculos llenos o vacíos y la racha.
export function LoadChart({
  matches,
  values,
  mode,
  matchMinutes,
  scale,
  averagePerMatch,
}: {
  matches: LoadMatch[];
  values: LoadValue[];
  mode: NominaMode;
  matchMinutes: number;
  scale: LoadScaleRow[];
  averagePerMatch: number | null;
}) {
  const byEvent = new Map(values.map((v) => [v.event_id, v]));
  const items = matches.map((m) => ({ match: m, value: byEvent.get(m.event_id) }));
  const summary = items
    .map(({ match, value }) =>
      `${matchDateLabel(match.starts_at)}${match.opponent ? ` vs. ${match.opponent}` : ""}: ${
        value ? valueText(value, mode, scale) : "sin datos"
      }`,
    )
    .join("; ");

  if (mode === "jugo") {
    const streak = playedStreak(values);
    return (
      <div className="space-y-3">
        <ol role="img" aria-label={summary} className="flex flex-wrap gap-3">
          {items.map(({ match, value }) => (
            <li key={match.event_id} className="flex w-12 flex-col items-center gap-1.5">
              <span
                className={`size-8 rounded-full border-2 ${
                  value?.played
                    ? "border-brand-strong bg-brand-strong"
                    : "border-line bg-white"
                }`}
              />
              <span className="text-xs text-muted">{matchDateLabel(match.starts_at)}</span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-ink">
          Racha: <span className="font-semibold">{streak}</span>{" "}
          {streak === 1 ? "partido seguido" : "partidos seguidos"}
        </p>
      </div>
    );
  }

  const avgPct = averagePerMatch !== null ? pct(averagePerMatch, matchMinutes) : null;
  return (
    <div>
      <div role="img" aria-label={summary} className="relative">
        <div className="flex h-36 items-end gap-2 border-b border-line">
          {items.map(({ match, value }) => {
            const height = value && !value.other_mode ? pct(value.value ?? 0, matchMinutes) : 0;
            return (
              <div key={match.event_id} className="flex h-full flex-1 flex-col justify-end">
                {value?.other_mode ? (
                  <div className="h-full rounded-t-md border border-dashed border-muted" />
                ) : (
                  <div
                    className={`rounded-t-md ${mode === "rango" ? "bg-brand" : "bg-brand-strong"}`}
                    style={{ height: `${Math.max(height, value?.value ? 2 : 0)}%` }}
                  />
                )}
              </div>
            );
          })}
        </div>
        {mode === "exacto" && avgPct !== null && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-ink/60"
            style={{ bottom: `${avgPct}%` }}
          />
        )}
      </div>
      <ol aria-hidden="true" className="mt-1.5 flex gap-2">
        {items.map(({ match, value }) => {
          const row = scale.find((s) => s.bucket === value?.bucket);
          return (
            <li key={match.event_id} className="flex-1 text-center">
              <span className="block text-xs font-medium text-ink">
                {value?.other_mode
                  ? "—"
                  : mode === "rango"
                    ? value?.bucket
                      ? row?.label
                      : "0"
                    : `${value?.value ?? 0}`}
              </span>
              <span className="block text-[11px] text-muted">{matchDateLabel(match.starts_at)}</span>
            </li>
          );
        })}
      </ol>
      {mode === "exacto" && averagePerMatch !== null && (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted">
          <span aria-hidden="true" className="inline-block w-5 border-t-2 border-dashed border-ink/60" />
          Promedio del plantel por partido: {Math.round(averagePerMatch)} min
        </p>
      )}
    </div>
  );
}
