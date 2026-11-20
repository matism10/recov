// Bloques de la ficha del jugador. Solo presentación: usan los datos que la ficha ya
// carga y no consultan nada. Las alertas (bienestar bajo, carga alta, vuelta tras parón)
// siguen las reglas de siempre; aquí solo se muestran.
import Link from "next/link";
import {
  INJURY_STATUS_LABEL,
  OCCURRED_DURING_LABEL,
  PHASE_STATUS_LABEL,
  SEVERITY_LABEL,
  formatDate,
  type InjurySeverity,
  type InjuryStatus,
  type OccurredDuring,
  type PhaseStatus,
} from "@/lib/injuries";
import { InjuryProgress } from "@/app/lesiones/injury-progress";
import { InjuryStatusBadge, PhaseDot } from "@/app/ui";
import { Card, CardHeader, EmptyState } from "@/app/ui-blocks";
import { LOAD_KINDS, LOAD_KIND_COLOR, rangeLabel, type PlayerGymSummary } from "@/lib/gym";
import { chileDateTime } from "@/lib/events";
import {
  WELLNESS_ITEMS,
  WELLNESS_MAX,
  dayLabel,
  formatLoad,
  shownLabel,
  toShown,
  wellnessItemText,
  wellnessSeverity,
  type WeeklyLoad,
  type WellnessReport,
} from "@/lib/srpe";
import type { Availability } from "@/lib/roles";

export const OPEN_STATUSES: InjuryStatus[] = ["en_evaluacion", "activa"];

export type InjuryRow = {
  id: string;
  type: string;
  status: string;
  severity: string | null;
  started_on: string;
  expected_return_on: string | null;
  closed_on: string | null;
  occurred_during: string | null;
  reviewed_at: string | null;
};
export type PhaseRow = {
  id: string;
  injury_id: string;
  name: string;
  status: string;
  started_on: string | null;
  ended_on: string | null;
};

// "Bienestar bajo": misma regla que wellness_flags, sobre los últimos checks de la ficha
// (el más reciente, de los últimos 7 días): total 4 o más puntos bajo el promedio de los 4
// anteriores (al menos 3 previos) o algún ítem en el peor valor (1).
export function isWellnessLow(reports: WellnessReport[] | null, todayChile: string) {
  const last = reports?.[0];
  if (!reports || !last) return false;
  const limit = new Date(`${todayChile}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() - 6);
  if (last.report_date < limit.toISOString().slice(0, 10)) return false;
  const prior = reports.slice(1, 5);
  const baseline = prior.length >= 3 ? prior.reduce((n, r) => n + r.total, 0) / prior.length : null;
  const worst = Math.min(last.fatigue, last.sleep, last.soreness, last.stress, last.mood);
  return (baseline !== null && last.total <= baseline - 4) || worst === 1;
}

export const todayInChile = () => chileDateTime(new Date()).date;

// ---------------------------------------------------------------------------
// Lesiones
// ---------------------------------------------------------------------------
function injurySubtitle(i: InjuryRow) {
  const severity = i.severity as InjurySeverity | null;
  const occurredDuring = i.occurred_during as OccurredDuring | null;
  return (
    <>
      Desde el {formatDate(i.started_on)}
      {occurredDuring &&
        (occurredDuring === "externo" ? " · fuera del club" : ` · en ${OCCURRED_DURING_LABEL[occurredDuring].toLowerCase()}`)}
      {severity && ` · ${SEVERITY_LABEL[severity]}`}
    </>
  );
}

function noInjuryText(availability: Availability) {
  return availability === "disponible"
    ? "No tiene lesiones actuales."
    : "Sin lesión registrada: la disponibilidad se cambió a mano.";
}

// Resumen: la lesión actual en pocas líneas (tipo, estado, avance y fase en curso).
export function InjuryCompact({
  open,
  phases,
  availability,
  moreHref,
}: {
  open: InjuryRow[];
  phases: PhaseRow[];
  availability: Availability;
  moreHref: string;
}) {
  if (open.length === 0) {
    return <EmptyState title="Sin lesiones actuales">{noInjuryText(availability)}</EmptyState>;
  }
  return (
    <Card>
      <CardHeader title="Lesión actual" action={{ label: "Ver lesiones", href: moreHref }} />
      <ul className="space-y-4">
        {open.map((i) => {
          const status = i.status as InjuryStatus;
          const current = phases.find((ph) => ph.injury_id === i.id && ph.status === "en_curso");
          return (
            <li key={i.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-15 font-semibold text-ink">{i.type}</p>
                  <p className="text-13 text-muted">{injurySubtitle(i)}</p>
                </div>
                <InjuryStatusBadge status={status} />
              </div>
              {status === "en_evaluacion" ? (
                <p className="text-13 text-muted">Esperando el diagnóstico del jugador.</p>
              ) : (
                <InjuryProgress startedOn={i.started_on} expectedReturnOn={i.expected_return_on} />
              )}
              {current && (
                <p className="text-13 text-muted">
                  Fase en curso: <span className="font-medium text-ink">{current.name}</span>
                </p>
              )}
              <Link
                href={`/lesiones/${i.id}`}
                className="inline-flex min-h-11 items-center text-sm font-medium text-brand-text underline"
              >
                Ver detalle de la lesión
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// Pestaña Lesiones: la lesión actual completa, con avance y fases.
export function InjuryFull({
  open,
  phases,
  availability,
}: {
  open: InjuryRow[];
  phases: PhaseRow[];
  availability: Availability;
}) {
  if (open.length === 0) {
    return <EmptyState title="Sin lesiones actuales">{noInjuryText(availability)}</EmptyState>;
  }
  return (
    <div className="space-y-3">
      {open.map((i) => {
        const status = i.status as InjuryStatus;
        const injuryPhases = phases.filter((ph) => ph.injury_id === i.id);
        return (
          <Card key={i.id} as="article" className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-15 font-semibold text-ink">{i.type}</p>
                <p className="text-13 text-muted">{injurySubtitle(i)}</p>
              </div>
              <InjuryStatusBadge status={status} />
            </div>

            {status === "en_evaluacion" ? (
              <p className="text-sm text-muted">Esperando el diagnóstico del jugador.</p>
            ) : (
              <InjuryProgress startedOn={i.started_on} expectedReturnOn={i.expected_return_on} />
            )}

            {injuryPhases.length > 0 && (
              <ol className="space-y-3 border-l-2 border-line pl-5">
                {injuryPhases.map((ph) => (
                  <li key={ph.id} className="relative text-sm">
                    <PhaseDot status={ph.status as PhaseStatus} />
                    <span className="font-medium text-ink">{ph.name}</span>
                    <span className="text-muted">
                      {" · "}
                      {PHASE_STATUS_LABEL[ph.status as PhaseStatus]}
                      {ph.started_on && ` · desde ${formatDate(ph.started_on)}`}
                      {ph.ended_on && ` · hasta ${formatDate(ph.ended_on)}`}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            <Link
              href={`/lesiones/${i.id}`}
              className="inline-flex min-h-11 items-center text-sm font-medium text-brand-text underline"
            >
              Ver detalle de la lesión
            </Link>
          </Card>
        );
      })}
    </div>
  );
}

export function InjuryTimeline({ all }: { all: InjuryRow[] }) {
  if (all.length === 0) return <EmptyState title="Sin lesiones registradas" />;
  return (
    <Card>
      <CardHeader title="Línea de tiempo" />
      <ol className="space-y-4 border-l-2 border-line pl-5">
        {all.map((i) => {
          const status = i.status as InjuryStatus;
          return (
            <li key={i.id} className="relative">
              <PhaseDot
                status={OPEN_STATUSES.includes(status) ? "en_curso" : status === "cerrada" ? "completada" : "pendiente"}
              />
              <Link href={`/lesiones/${i.id}`} className="group block">
                <p className="font-medium text-ink group-hover:underline">{i.type}</p>
                <p className="text-sm text-muted">
                  {formatDate(i.started_on)}
                  {i.closed_on && ` – ${formatDate(i.closed_on)}`}
                  {" · "}
                  {INJURY_STATUS_LABEL[status]}
                </p>
              </Link>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Bienestar: último check
// ---------------------------------------------------------------------------
export function WellnessLatest({ reports, moreHref }: { reports: WellnessReport[] | null; moreHref: string }) {
  const r = reports?.[0];
  if (!reports) return <EmptyState title="No se pudo cargar el bienestar" />;
  if (!r) return <EmptyState title="Sin check de bienestar">Aún no responde el check de bienestar.</EmptyState>;
  const bad = WELLNESS_ITEMS.filter((q) => wellnessSeverity(r[q.key]) === "mal");
  return (
    <Card>
      <CardHeader
        title="Último check de bienestar"
        subtitle={dayLabel(r.report_date)}
        action={{ label: "Ver historial", href: moreHref }}
      />
      <p className="mb-3 text-13 text-muted">
        Bienestar{" "}
        <span className="font-display text-2xl font-bold text-ink tabular-nums">{r.total}</span>
        <span className="font-semibold"> / {WELLNESS_MAX}</span>
      </p>
      <dl className="grid grid-cols-5 gap-2 text-center">
        {WELLNESS_ITEMS.map((q) => {
          const stored = r[q.key];
          const shown = toShown(q.key, stored);
          const label = shownLabel(q.key, shown);
          return (
            <div
              key={q.key}
              title={`${q.title} ${shown}${label ? ` · ${label}` : ""}`}
              className={`flex flex-col-reverse rounded-lg px-1 py-1.5 ${
                wellnessSeverity(stored) === "mal" ? "bg-alerta-bg text-alerta-fg" : "bg-mist text-ink"
              }`}
            >
              <dt className="truncate text-xs">{q.short}</dt>
              <dd className="font-display font-bold tabular-nums">
                {shown}
                {label && <span className="sr-only"> · {label}</span>}
              </dd>
            </div>
          );
        })}
      </dl>
      {bad.length > 0 && (
        <p className="mt-3 text-13 text-alerta-fg">{bad.map((q) => wellnessItemText(q.key, r[q.key])).join(", ")}</p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Carga · 6 semanas (versión mini)
// ---------------------------------------------------------------------------
const MINI_PX = 56;

export function LoadMini({ data, moreHref }: { data: WeeklyLoad | null; moreHref: string }) {
  if (!data) return <EmptyState title="No se pudo cargar la carga semanal" />;
  const weeks = data.weeks;
  const hasData = weeks.some((w) => w.sessions > 0);
  const max = Math.max(1, ...weeks.map((w) => w.load));
  const comparable = data.prior_weeks >= 3 && data.baseline !== null && data.baseline > 0;
  const pct = data.pct_over;
  return (
    <Card>
      <CardHeader title="Carga · 6 semanas" action={{ label: "Ver detalle", href: moreHref }} />
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2">
        <span className="font-display text-3xl font-bold text-ink tabular-nums">{formatLoad(data.current_load)}</span>
        <span className="text-13 text-muted">esta semana</span>
        {comparable && pct !== null && (
          <span className={`text-13 font-semibold ${data.high_load ? "text-alerta-fg" : "text-muted"}`}>
            {pct >= 0 ? `+${pct} % sobre su promedio` : `${Math.abs(pct)} % bajo su promedio`}
          </span>
        )}
      </div>
      {hasData ? (
        <>
          <ol className="flex items-end gap-2" style={{ height: MINI_PX + 16 }} aria-label="Carga de las últimas 6 semanas">
            {weeks.map((w, i) => {
              const current = i === weeks.length - 1;
              const h = Math.max(w.load > 0 ? 4 : 2, Math.round((w.load / max) * MINI_PX));
              return (
                <li key={w.week_start} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="sr-only">
                    {current ? "Semana actual" : `Semana del ${dayLabel(w.week_start)}`}: {formatLoad(w.load)}
                  </span>
                  <div
                    aria-hidden="true"
                    className={`flex w-full flex-col-reverse gap-px overflow-hidden rounded-md ${
                      current && data.high_load ? "ring-2 ring-alerta ring-offset-1" : ""
                    } ${w.load === 0 ? "bg-line-strong" : ""}`}
                    style={{ height: h }}
                  >
                    {w.load > 0 &&
                      LOAD_KINDS.map((k) =>
                        w[k] > 0 ? (
                          <div key={k} style={{ height: `${(w[k] / w.load) * 100}%`, background: LOAD_KIND_COLOR[k] }} />
                        ) : null,
                      )}
                  </div>
                  <span aria-hidden="true" className="text-xs text-muted">
                    {current ? "Actual" : `S-${weeks.length - 1 - i}`}
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <p className="text-sm text-muted">Aún no responde el esfuerzo de ninguna sesión.</p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Gimnasio (versión compacta)
// ---------------------------------------------------------------------------
export function GymCompact({ data, moreHref }: { data: PlayerGymSummary | null; moreHref: string }) {
  if (!data) return <EmptyState title="No se pudo cargar el gimnasio" />;
  const current = data.weeks.at(-1);
  if (data.plans.length === 0) {
    return <EmptyState title="Sin plan de gimnasio">No tiene un plan de gimnasio vigente.</EmptyState>;
  }
  return (
    <Card>
      <CardHeader title="Gimnasio" action={{ label: "Ver detalle", href: moreHref }} />
      <ul className="space-y-2">
        {data.plans.map((p) => (
          <li key={p.id}>
            <p className="text-15 font-semibold text-ink">{p.name}</p>
            <p className="text-13 text-muted">{rangeLabel(p.starts_on, p.ends_on)}</p>
          </li>
        ))}
      </ul>
      {current && current.assigned > 0 && (
        <p className="mt-3 text-13 text-muted">
          Esta semana: <span className="font-semibold text-ink">{current.done} de {current.assigned}</span> sesiones
        </p>
      )}
    </Card>
  );
}
