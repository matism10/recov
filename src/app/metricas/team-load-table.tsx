// Carga de la semana por jugador (Métricas → "Carga del plantel"): barra apilada por tipo
// (Cancha, Gimnasio, Partido), total, comparación con su promedio y el plan de gimnasio
// ("2 de 2"; "0 de 2" en gris). Arriba, "Plan de gimnasio cumplido: X %".
// Datos de team_srpe_load, team_load_breakdown y gym_adherence (semana actual).
import Link from "next/link";
import { formatLoad, type TeamSrpeRow } from "@/lib/srpe";
import {
  LOAD_KINDS,
  LOAD_KIND_COLOR,
  LOAD_KIND_LABEL,
  adherencePct,
  type GymAdherenceRow,
  type LoadBreakdownRow,
} from "@/lib/gym";

const PREVIEW = 8;

export function TeamLoadTable({
  team,
  breakdown,
  adherence,
}: {
  team: TeamSrpeRow[];
  breakdown: LoadBreakdownRow[] | null;
  adherence: GymAdherenceRow[] | null;
}) {
  const parts = new Map((breakdown ?? []).map((b) => [b.player_id, b]));
  const gym = new Map((adherence ?? []).map((a) => [a.player_id, a]));
  const rows = [...team].sort((a, b) => b.current_load - a.current_load);
  const max = Math.max(1, ...rows.map((r) => r.current_load));
  const pct = adherence ? adherencePct(adherence) : null;
  const due = (adherence ?? []).reduce((n, a) => n + a.due, 0);
  const done = (adherence ?? []).reduce((n, a) => n + Math.min(a.done, a.due), 0);
  const assigned = (adherence ?? []).reduce((n, a) => n + a.assigned, 0);

  const row = (p: TeamSrpeRow) => {
    const b = parts.get(p.player_id);
    const g = gym.get(p.player_id);
    return (
      <tr key={p.player_id} className="border-t border-line">
        <td className="py-2.5 pr-3">
          <Link href={`/jugadores/${p.player_id}`} className="font-medium text-ink hover:underline">
            {p.full_name}
          </Link>
        </td>
        <td className="w-[38%] py-2.5 pr-3">
          <div
            className="flex h-3.5 gap-px overflow-hidden rounded"
            style={{ width: `${Math.max(p.current_load > 0 ? 2 : 0, (p.current_load / max) * 100)}%` }}
            aria-label={
              b
                ? `Cancha ${formatLoad(b.cancha)}, gimnasio ${formatLoad(b.gimnasio)}, partido ${formatLoad(b.partido)}`
                : undefined
            }
            role={b ? "img" : undefined}
          >
            {b &&
              LOAD_KINDS.map((k) =>
                b[k] > 0 ? <div key={k} style={{ flexGrow: b[k], background: LOAD_KIND_COLOR[k] }} /> : null,
              )}
          </div>
        </td>
        <td className="py-2.5 pr-3 font-display font-bold text-ink tabular-nums">{formatLoad(p.current_load)}</td>
        <td className="py-2.5 pr-3">
          {p.high_load ? (
            <span className="rounded-full bg-alerta-bg px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-alerta-fg">
              Carga alta{p.pct_over !== null ? ` · +${p.pct_over} %` : ""}
            </span>
          ) : p.prior_weeks >= 3 && p.pct_over !== null ? (
            <span className="text-sm text-ink">{p.pct_over >= 0 ? `+${p.pct_over} %` : `−${Math.abs(p.pct_over)} %`}</span>
          ) : (
            <span className="text-sm text-muted">—</span>
          )}
        </td>
        <td className="py-2.5">
          {g && g.assigned > 0 ? (
            <span
              className={
                g.done >= g.assigned
                  ? "text-sm text-ink"
                  : "rounded-full bg-[#F1F5F9] px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-[#334155]"
              }
            >
              {g.done} de {g.assigned}
            </span>
          ) : (
            <span className="text-sm text-muted">Sin plan</span>
          )}
        </td>
      </tr>
    );
  };

  const table = (list: TeamSrpeRow[]) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th className="py-2 pr-3 font-medium">Jugador</th>
            <th className="py-2 pr-3 font-medium">Carga de la semana</th>
            <th className="py-2 pr-3 font-medium">Total</th>
            <th className="py-2 pr-3 font-medium">vs su promedio</th>
            <th className="py-2 font-medium">Plan de gimnasio</th>
          </tr>
        </thead>
        <tbody>{list.map(row)}</tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-3 rounded-xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink">Carga por jugador</h3>
          <p className="text-sm text-muted">Esta semana, por tipo de sesión.</p>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink" aria-label="Tipos de carga">
          {LOAD_KINDS.map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: LOAD_KIND_COLOR[k] }} />
              {LOAD_KIND_LABEL[k]}
            </li>
          ))}
        </ul>
      </div>

      {adherence && assigned > 0 && (
        <div className="rounded-lg bg-mist p-3">
          <p className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold text-ink tabular-nums">{pct !== null ? `${pct} %` : "—"}</span>
            <span className="text-sm font-medium text-ink">Plan de gimnasio cumplido</span>
          </p>
          <p className="text-xs text-muted">
            {due > 0
              ? `${done} de ${due} sesiones que ya tocaban esta semana (${assigned} asignadas en total).`
              : `${assigned} sesiones asignadas esta semana; aún no toca ninguna.`}
          </p>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-muted">Sin jugadores en el plantel.</p>
      ) : (
        <>
          {table(rows.slice(0, PREVIEW))}
          {rows.length > PREVIEW && (
            <details className="group">
              <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-brand-text underline">
                Ver todos ({rows.length})
              </summary>
              {table(rows.slice(PREVIEW))}
            </details>
          )}
        </>
      )}
    </div>
  );
}
