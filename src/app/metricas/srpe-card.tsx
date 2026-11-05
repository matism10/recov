// Tarjeta "Carga sRPE" dentro de "Carga del plantel" (Métricas, staff): cuántos
// jugadores tienen "Carga alta" esta semana y cuántos están "Bajo lo habitual" en
// bienestar, con link a cada ficha. Los cálculos vienen de team_srpe_load y
// wellness_flags (umbrales provisorios en la base).
import Link from "next/link";
import { formatLoad, wellnessReason, type TeamSrpeRow, type WellnessFlag } from "@/lib/srpe";

export function SrpeCard({
  team,
  flags,
}: {
  team: TeamSrpeRow[] | null;
  flags: WellnessFlag[] | null;
}) {
  if (!team || !flags) {
    return (
      <div className="rounded-xl border border-line bg-white p-4 text-sm text-muted">
        No se pudo cargar la carga sRPE.
      </div>
    );
  }
  const high = team.filter((p) => p.high_load);
  const low = flags.filter((f) => f.low);
  const responded = team.filter((p) => p.current_sessions > 0).length;

  return (
    <div className="space-y-3 rounded-xl border border-line bg-white p-4">
      <div>
        <h3 className="font-semibold text-ink">Carga sRPE</h3>
        <p className="text-sm text-muted">
          Esfuerzo × minutos de esta semana, comparado con el promedio de las 4 anteriores.{" "}
          {responded} de {team.length} {team.length === 1 ? "jugador respondió" : "jugadores respondieron"} esta semana.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Group
          title="Carga alta"
          count={high.length}
          empty="Nadie con carga alta esta semana."
          items={high.map((p) => ({
            id: p.player_id,
            name: p.full_name,
            detail: `${formatLoad(p.current_load)}${p.pct_over !== null ? ` · +${p.pct_over} % sobre su promedio` : ""}`,
          }))}
        />
        <Group
          title="Bajo lo habitual"
          subtitle="bienestar"
          count={low.length}
          empty="Nadie con el bienestar bajo lo habitual en los últimos 7 días."
          items={low.map((f) => ({ id: f.player_id, name: f.full_name, detail: `${f.total} / 25 · ${wellnessReason(f)}` }))}
        />
      </div>
    </div>
  );
}

function Group({
  title,
  subtitle,
  count,
  empty,
  items,
}: {
  title: string;
  subtitle?: string;
  count: number;
  empty: string;
  items: { id: string; name: string; detail: string }[];
}) {
  return (
    <div className="rounded-lg bg-mist p-3">
      <p className="flex items-baseline gap-2">
        <span className={`font-display text-3xl font-bold tabular-nums ${count > 0 ? "text-alerta-fg" : "text-ink"}`}>
          {count}
        </span>
        <span className="text-sm font-medium text-ink">
          {title}
          {subtitle && <span className="font-normal text-muted"> · {subtitle}</span>}
        </span>
      </p>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {items.map((i) => (
            <li key={i.id}>
              <Link href={`/jugadores/${i.id}`} className="block rounded-md px-1 py-1 text-sm hover:bg-white">
                <span className="font-medium text-brand-text underline">{i.name}</span>
                <span className="block text-xs text-muted">{i.detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
