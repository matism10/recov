// Bloques de /metricas con los agregados de lesiones (funciones dash_* de 0020).
// Cada bloque recibe su propio resultado: si una llamada falla, solo ese bloque
// muestra el error y el resto de la página se renderiza.
import { OCCURRED_DURING_LABEL } from "@/lib/injuries";
import {
  deadlineLabel,
  formatShortDate,
  type MetricsResult,
  type PlaceCount,
  type PlaceKey,
  type PlayerStatus,
  type PositionCount,
  type RecurringPlayer,
  type UpcomingReturn,
  type WeekCount,
} from "@/lib/metrics";
import { Avatar } from "@/app/avatar";
import { BarChart } from "@/app/bar-chart";
import { BarList, MetricsBlock, MetricsError } from "@/app/metrics";
import { AvailabilityBadge } from "@/app/ui";

const MAX_POSITIONS = 8;

const PLACE_LABEL: Record<PlaceKey, string> = {
  ...OCCURRED_DURING_LABEL,
  sin_dato: "Sin dato",
};
const PLACE_ORDER: PlaceKey[] = ["entrenamiento", "competencia", "externo", "sin_dato"];

function injuriesLabel(n: number) {
  return n === 1 ? "1 lesión" : `${n} lesiones`;
}

function percent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

// a) Lesiones nuevas por semana
export function InjuriesByWeekBlock({ result }: { result: MetricsResult<WeekCount[]> }) {
  const heading = "Lesiones nuevas por semana";
  if (!result.ok) {
    return (
      <MetricsBlock heading={heading}>
        <MetricsError />
      </MetricsBlock>
    );
  }
  const weeks = result.data;
  const total = weeks.reduce((sum, w) => sum + w.injuries_count, 0);
  return (
    <MetricsBlock heading={heading} footer={`${injuriesLabel(total)} en ${weeks.length} semanas`}>
      <BarChart
        label={heading}
        values={weeks.map((w) => w.injuries_count)}
        xLabels={weeks.map((w) => formatShortDate(w.week_start))}
        highlightIndex={weeks.length - 1}
      />
    </MetricsBlock>
  );
}

// b) Lugar de la lesión
export function InjuriesByPlaceBlock({ result }: { result: MetricsResult<PlaceCount[]> }) {
  const heading = "Lugar de la lesión";
  if (!result.ok) {
    return (
      <MetricsBlock heading={heading}>
        <MetricsError />
      </MetricsBlock>
    );
  }
  const counts = new Map(result.data.map((p) => [p.place_key, p.injuries_count]));
  const total = PLACE_ORDER.reduce((sum, k) => sum + (counts.get(k) ?? 0), 0);
  if (total === 0) {
    return (
      <MetricsBlock heading={heading}>
        <p className="text-sm text-muted">Sin lesiones en los últimos 12 meses.</p>
      </MetricsBlock>
    );
  }
  return (
    <MetricsBlock heading={heading} footer={`Últimos 12 meses · ${injuriesLabel(total)}`}>
      <BarList
        rows={PLACE_ORDER.map((key) => {
          const value = counts.get(key) ?? 0;
          return {
            key,
            label: PLACE_LABEL[key],
            value,
            valueLabel: `${value} · ${percent(value, total)}%`,
            muted: key === "sin_dato",
          };
        })}
      />
    </MetricsBlock>
  );
}

// c) Lesiones por posición
export function InjuriesByPositionBlock({ result }: { result: MetricsResult<PositionCount[]> }) {
  const heading = "Lesiones por posición";
  if (!result.ok) {
    return (
      <MetricsBlock heading={heading}>
        <MetricsError />
      </MetricsBlock>
    );
  }
  const rows = [...result.data]
    .sort((a, b) => b.injuries_count - a.injuries_count || a.position_name.localeCompare(b.position_name))
    .slice(0, MAX_POSITIONS);
  return (
    <MetricsBlock heading={heading}>
      {rows.length > 0 ? (
        <BarList
          rows={rows.map((p) => ({
            key: p.position_name,
            label: p.position_name,
            value: p.injuries_count,
            valueLabel: `${p.injuries_count} · ${p.players_count} jug.`,
          }))}
        />
      ) : (
        <p className="text-sm text-muted">Sin lesiones en los últimos 12 meses.</p>
      )}
    </MetricsBlock>
  );
}

// d) Jugadores recurrentes
export function RecurringPlayersBlock({
  result,
  status,
  avatarUrls,
}: {
  result: MetricsResult<RecurringPlayer[]>;
  status: Map<string, PlayerStatus> | null;
  avatarUrls: Map<string, string>;
}) {
  const heading = "Jugadores recurrentes";
  const subtitle = "2 o más lesiones en 12 meses";
  if (!result.ok) {
    return (
      <MetricsBlock heading={heading} subtitle={subtitle}>
        <MetricsError />
      </MetricsBlock>
    );
  }
  return (
    <MetricsBlock heading={heading} subtitle={subtitle}>
      {result.data.length > 0 ? (
        <ul className="divide-y divide-line">
          {result.data.map((p) => {
            const userId = status?.get(p.player_id)?.user_id;
            return (
              <li key={p.player_id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={p.full_name} url={userId ? avatarUrls.get(userId) : null} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{p.full_name}</p>
                    <p className="text-sm text-muted">
                      {p.position_name} · última {formatShortDate(p.last_injury_on)}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    p.injuries_count >= 3
                      ? "bg-lesionado-bg text-lesionado-fg"
                      : "bg-revision-bg text-revision-fg"
                  }`}
                >
                  {p.injuries_count} lesiones
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nadie con 2 o más lesiones en 12 meses.</p>
      )}
    </MetricsBlock>
  );
}

// e) Próximas altas estimadas: vencidas primero y luego por fecha.
export function UpcomingReturnsBlock({
  result,
  status,
  avatarUrls,
}: {
  result: MetricsResult<UpcomingReturn[]>;
  status: Map<string, PlayerStatus> | null;
  avatarUrls: Map<string, string>;
}) {
  const heading = "Próximas altas estimadas";
  const subtitle = "Próximos 30 días";
  if (!result.ok) {
    return (
      <MetricsBlock heading={heading} subtitle={subtitle}>
        <MetricsError />
      </MetricsBlock>
    );
  }
  const rows = [...result.data].sort(
    (a, b) => a.return_on.localeCompare(b.return_on) || a.full_name.localeCompare(b.full_name),
  );
  if (rows.length === 0) {
    return (
      <MetricsBlock heading={heading} subtitle={subtitle}>
        <p className="text-sm text-muted">Sin altas estimadas en los próximos 30 días.</p>
      </MetricsBlock>
    );
  }
  // Sin la lectura de players no hay estado: la columna se omite.
  const showStatus = status !== null;
  const avatarOf = (playerId: string) => {
    const userId = status?.get(playerId)?.user_id;
    return userId ? avatarUrls.get(userId) : null;
  };
  const badgeOf = (playerId: string) => {
    const s = status?.get(playerId);
    return s ? <AvailabilityBadge status={s.availability} /> : null;
  };

  return (
    <MetricsBlock heading={heading} subtitle={subtitle}>
      {/* Celular y tablet: lista apilada, como en /dashboard. */}
      <ul className="divide-y divide-line lg:hidden">
        {rows.map((r) => {
          const overdue = r.days_left < 0;
          return (
            <li
              key={r.injury_id}
              className={`flex items-center justify-between gap-3 py-3 ${
                overdue ? "-mx-2 rounded-lg bg-revision-bg/50 px-2" : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={r.full_name} url={avatarOf(r.player_id)} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{r.full_name}</p>
                  <p className="text-sm text-muted">
                    {formatShortDate(r.return_on)} ·{" "}
                    <span className={overdue ? "text-revision-fg" : ""}>
                      {deadlineLabel(r.days_left)}
                    </span>
                  </p>
                </div>
              </div>
              {showStatus && badgeOf(r.player_id)}
            </li>
          );
        })}
      </ul>

      {/* Escritorio: tabla con el mismo estilo que las de /dashboard. */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-left">
          <thead className="text-sm text-muted">
            <tr className="border-b border-line">
              <th scope="col" className="py-3 pr-3 font-medium">
                Jugador
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Regreso estimado
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Plazo
              </th>
              {showStatus && (
                <th scope="col" className="py-3 pl-3 font-medium">
                  Estado
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const overdue = r.days_left < 0;
              return (
                <tr key={r.injury_id} className={overdue ? "bg-revision-bg/50" : ""}>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.full_name} url={avatarOf(r.player_id)} />
                      <span className="font-medium text-ink">{r.full_name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-sm text-muted">{formatShortDate(r.return_on)}</td>
                  <td className={`px-3 py-3 text-sm ${overdue ? "font-medium text-revision-fg" : "text-muted"}`}>
                    {deadlineLabel(r.days_left)}
                  </td>
                  {showStatus && <td className="py-3 pl-3">{badgeOf(r.player_id)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </MetricsBlock>
  );
}
