// "Mi carga" del jugador (pestaña Carga de su ficha y /mi-carga): por responder, aviso de
// vuelta tras parón, la semana en curso, 6 semanas de carga, las sesiones de L a D y su
// bienestar. Solo presentación: las lecturas salen de src/lib/my-load.ts. Sin "riesgo de
// lesión": se dice "Carga alta" y "Bajo lo habitual".
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { addDays } from "@/lib/injuries";
import { WEEKDAY_LABELS } from "@/lib/events";
import { formatShortDate } from "@/lib/metrics";
import { FORMAT_LABEL, type Format } from "@/lib/sevens";
import { LOAD_KIND_COLOR, LOAD_KINDS } from "@/lib/gym";
import { RETURN_LEGEND, RETURN_PLAYER_TEXT, breakWeekStarts, causeText, weeksText } from "@/lib/return-break";
import {
  RPE_SCALE,
  WEEKDAYS,
  WELLNESS_ITEMS,
  WELLNESS_MAX,
  formatAvg,
  formatLoad,
  toShown,
  wellnessSeverity,
  type WeekLoad,
} from "@/lib/srpe";
import { comparableBaseline, deadlineText, type MyLoadScreen, type MySessionRow, type SessionKind } from "@/lib/my-load";
import { buttonPrimary, buttonSecondary } from "@/app/ui";
import { Card, CardHeader, ListRow, PageHeader, StatStrip, TableCard } from "@/app/ui-blocks";
import { InfoBox } from "@/app/info-box";
import { StackedBarChart } from "@/app/stacked-bar-chart";

const dayNum = (date: string) => Number(date.slice(8, 10));
const monthShort = (date: string) => formatShortDate(date).split(" ").slice(1).join(" ");

// "16 al 22 nov" (o "30 oct al 5 nov" si cruza de mes).
function weekRange(monday: string, sunday: string) {
  const sameMonth = monday.slice(0, 7) === sunday.slice(0, 7);
  return sameMonth
    ? `${dayNum(monday)} al ${dayNum(sunday)} ${monthShort(sunday)}`
    : `${dayNum(monday)} ${monthShort(monday)} al ${dayNum(sunday)} ${monthShort(sunday)}`;
}

const KIND_BADGE: Record<SessionKind, string> = {
  cancha: "bg-brand-soft text-brand-text",
  gimnasio: "bg-[#0369A1] text-white",
  partido: "bg-alerta-bg text-alerta-fg",
};
const KIND_LABEL: Record<SessionKind, string> = { cancha: "Cancha", gimnasio: "Gimnasio", partido: "Partido" };

// Siguiente día del check de bienestar: hoy si toca y aún no lo respondió; si no, el próximo.
function nextCheckLabel(days: number[], today: string, answeredToday: boolean) {
  for (let i = answeredToday ? 1 : 0; i <= 7; i++) {
    const iso = isoOf(addDays(today, i));
    if (!days.includes(iso)) continue;
    if (i === 0) return "hoy";
    if (i === 1) return "mañana";
    return WEEKDAYS[iso - 1].label.toLowerCase();
  }
  return null;
}
function isoOf(date: string) {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export function MyLoadScreenView({ data, format }: { data: MyLoadScreen; format: Format }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 lg:max-w-[1200px] lg:px-8 lg:py-10">
      <PageHeader
        back={{ fallback: "/dashboard" }}
        title="Mi carga"
        description={`Semana del ${weekRange(data.monday, data.sunday)} · ${FORMAT_LABEL[format]}`}
        actions={
          <div className="hidden items-center gap-2 lg:flex">
            <Link href="/ausencias/nueva" className={buttonSecondary}>
              Avisar una ausencia
            </Link>
            <Link href="/mi-plan/propia" className={buttonPrimary}>
              Registrar sesión por mi cuenta
            </Link>
          </div>
        }
      />
      <div className="space-y-4 xl:grid xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] xl:items-start xl:gap-6 xl:space-y-0">
        <div className="space-y-4">
          <PendingList data={data} />
          <ReturnCard data={data} />
          <ThisWeek data={data} />
          <HowToRead data={data} />
          <WeeksChart data={data} />
          <SessionsTable data={data} />
        </div>
        <WellnessCard data={data} />
      </div>
    </main>
  );
}

// 2. Por responder: una fila por esfuerzo pendiente (sin el check de bienestar).
function PendingList({ data }: { data: MyLoadScreen }) {
  if (data.pending.length === 0) return null;
  return (
    <section aria-label="Por responder" className="space-y-2">
      {data.pending.map((p) => (
        <Link
          key={p.key}
          href={p.href}
          className="flex min-h-14 items-center gap-3 rounded-xl border border-brand-line bg-brand-wash px-4 py-3 transition hover:bg-brand-soft/60 focus-visible:outline-2 focus-visible:outline-brand-strong"
        >
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[3px]" style={{ background: LOAD_KIND_COLOR[p.kind] }} />
          <span className="min-w-0 flex-1">
            <span className="block text-15 font-semibold text-ink">{p.title}</span>
            <span className="block text-13 text-muted">{p.detail}</span>
          </span>
          <span className="shrink-0 text-13 font-semibold text-brand-text">{deadlineText(p.deadline)}</span>
          <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted" />
        </Link>
      ))}
    </section>
  );
}

// 3. Vuelta tras parón: informativo, sin números de carga.
function ReturnCard({ data }: { data: MyLoadScreen }) {
  const flag = data.returnFlag;
  if (!flag) return null;
  return (
    <section className="rounded-xl bg-paron-bg px-4 py-3 text-paron-ink">
      <p className="text-15 font-semibold">
        Vuelves tras {weeksText(flag.weeks)} · {causeText(flag.cause)}
      </p>
      <p className="mt-1 text-sm">{RETURN_PLAYER_TEXT}</p>
      <p className="mt-1 text-13 text-paron-fg">
        {RETURN_LEGEND} · se va el {formatShortDate(addDays(flag.returned_on, 14))}
      </p>
    </section>
  );
}

// 4. Esta semana: número grande, comparación con el promedio, barra apilada y 4 números.
function ThisWeek({ data }: { data: MyLoadScreen }) {
  const w = data.weekly;
  if (!w) {
    return (
      <Card as="section">
        <p className="text-sm text-muted">No se pudo cargar tu carga semanal.</p>
      </Card>
    );
  }
  const baseline = comparableBaseline(w);
  const flag = data.returnFlag;
  const current = w.weeks[w.weeks.length - 1];
  const sessions = w.current_sessions;
  const minutes = sessions.reduce((n, s) => n + s.minutes, 0);
  const avgRpe = sessions.length > 0 ? sessions.reduce((n, s) => n + s.rpe, 0) / sessions.length : null;
  const pct = baseline ? Math.round((w.current_load / baseline) * 100) : null;

  const stats = [
    { label: "Sesiones", value: sessions.length },
    { label: "Minutos", value: formatLoad(minutes) },
    {
      label: "Esfuerzo promedio",
      value: avgRpe === null ? "—" : formatAvg(avgRpe),
      context: avgRpe === null ? undefined : RPE_SCALE[Math.round(avgRpe)].label,
    },
    ...(data.gym ? [{ label: "Mi físico", value: `${data.gym.done} de ${data.gym.total}`, context: "sesiones de gimnasio" }] : []),
  ];

  return (
    <section aria-label="Esta semana" className="space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-sans text-base font-bold text-ink">Esta semana</h2>
          {!flag && baseline && (
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                w.high_load ? "bg-alerta-bg text-alerta-fg" : "bg-brand-soft text-brand-text"
              }`}
            >
              {w.high_load ? "Carga alta" : "Dentro de lo habitual"}
            </span>
          )}
        </div>

        {flag ? (
          <dl className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <dt className="text-13 text-muted">Esta semana</dt>
              <dd className="font-display text-4xl font-extrabold text-ink tabular-nums">{formatLoad(w.current_load)}</dd>
            </div>
            <div>
              <dt className="text-13 text-muted">Tu promedio antes del parón</dt>
              <dd className="font-display text-4xl font-extrabold text-paron-fg tabular-nums">
                {flag.baseline !== null ? formatLoad(flag.baseline) : "—"}
              </dd>
            </div>
          </dl>
        ) : (
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-5xl leading-none font-extrabold text-ink tabular-nums">
              {formatLoad(w.current_load)}
            </span>
            {baseline ? (
              <span className="text-15 text-muted">de tu promedio {formatLoad(baseline)}</span>
            ) : (
              <span className="text-13 text-muted">Se compara con tu promedio cuando tengas 3 semanas con datos.</span>
            )}
          </div>
        )}

        {!flag && baseline && current && (
          <div className="mt-4">
            <div
              role="img"
              aria-label={`${pct} % de tu promedio`}
              className="flex h-3 overflow-hidden rounded-full bg-fill-soft"
            >
              {LOAD_KINDS.map((k) =>
                current[k] > 0 ? (
                  <span
                    key={k}
                    style={{
                      width: `${Math.min(100, (current[k] / baseline) * 100)}%`,
                      background: LOAD_KIND_COLOR[k],
                      maxWidth: "100%",
                    }}
                  />
                ) : null,
              )}
            </div>
            <p className="mt-1.5 text-13 text-muted">
              {pct} % de tu promedio{pct! > 100 ? " (la barra llega al tope)" : ""}
            </p>
          </div>
        )}
      </Card>
      <StatStrip items={stats} />
    </section>
  );
}

// 5. Carga por semana: 6 semanas apiladas (cancha, gimnasio, partido), promedio y parón.
function WeeksChart({ data }: { data: MyLoadScreen }) {
  const w = data.weekly;
  if (!w) return null;
  const hasData = w.weeks.some((x) => x.sessions > 0);
  const baseline = data.returnFlag?.baseline ?? comparableBaseline(w);
  const breaks = data.returnFlag ? breakWeekStarts(data.returnFlag) : new Set<string>();
  const total = w.weeks.reduce((n, x) => n + x.load, 0);
  const gym = w.weeks.reduce((n, x) => n + (x.gimnasio ?? 0), 0);
  const gymShare = total > 0 && gym > 0 ? Math.round((gym / total) * 100) : null;
  const lastIndex = w.weeks.length - 1;
  const vs = (n: number) => {
    if (!baseline || baseline <= 0) return null;
    const p = Math.round(((n - baseline) / baseline) * 100);
    return p >= 0 ? `+${p} % sobre tu promedio` : `${Math.abs(p)} % bajo tu promedio`;
  };

  return (
    <Card as="section" aria-label="Carga por semana">
      <CardHeader title="Carga por semana" subtitle="Últimas 6 semanas" className="mb-0" />
      <InfoBox topic="mi_carga" />
      <div className="mt-3">
        {hasData ? (
          <StackedBarChart
            label="Tu carga de las últimas 6 semanas"
            height={230}
            allLabels
            showTotals
            formatValue={formatLoad}
            reference={baseline ? { value: baseline, label: `Tu promedio · ${formatLoad(baseline)}` } : null}
            series={[
              { key: "cancha", label: "Cancha", fill: "fill-brand-mid", swatch: "bg-brand-mid" },
              { key: "gimnasio", label: "Gimnasio", fill: "fill-brand-text", swatch: "bg-brand-text" },
              { key: "partido", label: "Partido", fill: "fill-alerta", swatch: "bg-alerta" },
            ]}
            columns={w.weeks.map((x: WeekLoad, i) => {
              const label = formatShortDate(x.week_start);
              const isBreak = breaks.has(x.week_start);
              const current = i === lastIndex;
              if (isBreak) {
                return { label, values: null, hatched: "Parón", tip: { title: `Semana del ${label}`, lines: ["Parón: no cuenta para tu promedio"] } };
              }
              if (x.sessions === 0) {
                return { label, values: null, dashed: current, tip: { title: `Semana del ${label}${current ? " (en curso)" : ""}`, lines: ["Sin sesiones"] } };
              }
              const compare = vs(x.load);
              return {
                label,
                dashed: current,
                values: { cancha: x.cancha, gimnasio: x.gimnasio, partido: x.partido },
                tip: {
                  title: `Semana del ${label}${current ? " (en curso)" : ""}`,
                  lines: [
                    `${formatLoad(x.load)}${compare ? ` · ${compare}` : ""}`,
                    `Cancha ${formatLoad(x.cancha)} · Gimnasio ${formatLoad(x.gimnasio)} · Partido ${formatLoad(x.partido)}`,
                    `${x.sessions} ${x.sessions === 1 ? "sesión" : "sesiones"}${x.estimated ? " · con minutos estimados" : ""}`,
                  ],
                },
              };
            })}
          />
        ) : (
          <p className="text-sm text-muted">Aún no respondes el esfuerzo de ninguna sesión.</p>
        )}
      </div>
      <div className="mt-3 space-y-1 rounded-xl bg-fill-soft px-4 py-3 text-13 text-body">
        <p>
          Carga = esfuerzo × minutos.
          {gymShare !== null && ` El gimnasio es el ${gymShare} % de tu carga de las últimas ${w.weeks.length} semanas.`}
        </p>
        {breaks.size > 0 && <p>Las semanas de parón no cuentan para tu promedio: se compara con lo que hacías antes.</p>}
      </div>
    </Card>
  );
}

// "90 min · 6 Duro"
function sessionDetail(s: MySessionRow) {
  if (s.state === "absent") return "No fui";
  if (s.state === "done") {
    return `${s.minutes} min${s.estimated ? " est." : ""} · ${s.rpe} ${RPE_SCALE[s.rpe!].label}`;
  }
  if (s.state === "gymDone") return "Hecha · sin esfuerzo";
  if (s.state === "missed") return s.kind === "gimnasio" ? "No hecha" : "Sin respuesta";
  return s.minutes ? `${s.minutes} min${s.estimated ? " est." : ""}` : "";
}

// 6. Sesiones de la semana (L a D): del plan, de cancha, partidos y por su cuenta.
function SessionsTable({ data }: { data: MyLoadScreen }) {
  const columns = "lg:grid-cols-[56px_minmax(0,1fr)_80px_130px_104px]";
  return (
    <TableCard
      columns={columns}
      header={<CardHeader title="Sesiones de la semana" className="mb-0" />}
      head={
        <>
          <span>Día</span>
          <span>Sesión</span>
          <span>Minutos</span>
          <span>Esfuerzo</span>
          <span className="text-right">Carga</span>
        </>
      }
      footer={
        <Link href="/mi-plan/propia" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-text hover:underline">
          <Plus aria-hidden="true" className="size-4" />
          Registrar una sesión por mi cuenta
        </Link>
      }
    >
      {data.sessions.length === 0 && (
        <li className="px-4 py-6 text-sm text-muted lg:px-5">Aún no hay sesiones esta semana.</li>
      )}
      {data.sessions.map((s) => {
        const iso = isoOf(s.date);
        const faded = s.state === "absent" || s.state === "missed";
        return (
          <ListRow key={`${s.kind}-${s.key}`} columns={columns} className="min-h-16">
            <span
              className={`flex size-11 shrink-0 flex-col items-center justify-center rounded-lg text-xs leading-tight font-bold ${KIND_BADGE[s.kind]}`}
              aria-label={`${WEEKDAYS[iso - 1].label} ${dayNum(s.date)}, ${KIND_LABEL[s.kind]}`}
            >
              <span aria-hidden="true">{WEEKDAY_LABELS[iso - 1]}</span>
              <span aria-hidden="true" className="text-13 font-semibold">
                {dayNum(s.date)}
              </span>
            </span>
            <span className="min-w-0 flex-1 lg:flex-none">
              <span className={`block truncate text-15 font-semibold ${faded ? "text-muted" : "text-ink"}`}>{s.title}</span>
              {/* Celular: minutos y esfuerzo bajo el título. */}
              <span className="block text-13 text-muted lg:hidden">{sessionDetail(s)}</span>
            </span>
            <span className="hidden text-sm text-ink tabular-nums lg:block">
              {s.minutes ? `${s.minutes}${s.estimated ? " est." : ""}` : "—"}
            </span>
            <span className="hidden text-sm text-ink lg:block">
              {s.state === "done" ? `${s.rpe} · ${RPE_SCALE[s.rpe!].label}` : s.state === "absent" ? "No fui" : "—"}
            </span>
            <span className="ml-auto shrink-0 text-right lg:ml-0">
              {s.state === "done" ? (
                <span className="font-display font-bold text-ink tabular-nums">{formatLoad(s.load!)}</span>
              ) : s.state === "pending" ? (
                <Link
                  href={s.href!}
                  className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-ink transition hover:bg-brand-hover"
                >
                  Responder
                </Link>
              ) : s.state === "upcoming" ? (
                <span className="rounded-full bg-fill-soft px-2.5 py-1 text-xs font-medium text-muted">{s.when}</span>
              ) : (
                <span className="text-13 text-muted">{s.state === "absent" ? "Sin carga" : "—"}</span>
              )}
            </span>
          </ListRow>
        );
      })}
    </TableCard>
  );
}

// 7. Mi bienestar: último total /25, mini barras de los últimos 6 checks y los 5 ítems.
function WellnessCard({ data }: { data: MyLoadScreen }) {
  const reports = data.wellness;
  const last = reports?.[0];
  const answeredToday = last?.report_date === data.today;
  const next = nextCheckLabel(data.wellnessDays, data.today, answeredToday);
  const bars = [...(reports ?? [])].reverse();
  return (
    <Card as="section" aria-label="Mi bienestar" className="xl:sticky xl:top-6">
      <CardHeader title="Mi bienestar" subtitle="Check de bienestar · 25 = mejor" action={{ label: "Responder", href: "/bienestar" }} />
      {!reports ? (
        <p className="text-sm text-muted">No se pudo cargar tu bienestar.</p>
      ) : !last ? (
        <p className="text-sm text-muted">Aún no respondes el check de bienestar.</p>
      ) : (
        <>
          <div className="flex items-end justify-between gap-4">
            <p className="font-display text-5xl leading-none font-extrabold whitespace-nowrap text-ink tabular-nums">
              {last.total}
              <span className="text-base font-semibold text-muted"> / {WELLNESS_MAX}</span>
            </p>
            <div aria-hidden="true" className="flex h-14 items-end gap-1.5">
              {bars.map((r, i) => (
                <span
                  key={r.report_date}
                  title={`${formatShortDate(r.report_date)} · ${r.total} / ${WELLNESS_MAX}`}
                  className={`block w-3.5 rounded-sm ${i === bars.length - 1 ? "bg-brand-strong" : "bg-brand-mid"}`}
                  style={{ height: `${Math.max(8, (r.total / WELLNESS_MAX) * 100)}%` }}
                />
              ))}
            </div>
          </div>
          <p className="mt-1 text-13 text-muted">Último check: {formatShortDate(last.report_date)}</p>
          <ul className="mt-4 divide-y divide-line">
            {WELLNESS_ITEMS.map((q) => {
              const shown = toShown(q.key, last[q.key]);
              const low = wellnessSeverity(last[q.key]) === "mal";
              return (
                <li key={q.key} className="flex min-h-11 items-center gap-3 py-2">
                  <span className={`min-w-0 flex-1 text-sm ${low ? "font-semibold text-alerta-fg" : "text-ink"}`}>
                    {q.title}
                    {low && <span> · {q.inverted ? "alto" : "bajo"}</span>}
                  </span>
                  <span aria-hidden="true" className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span
                        key={n}
                        className={`size-2.5 rounded-full ${n <= shown ? (low ? "bg-alerta" : "bg-brand-strong") : "bg-line-strong"}`}
                      />
                    ))}
                  </span>
                  <span className={`w-12 text-right text-13 tabular-nums ${low ? "text-alerta-fg" : "text-muted"}`}>{shown} de 5</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {next && <p className="mt-3 border-t border-line pt-3 text-13 text-muted">Próximo check: {next}</p>}
    </Card>
  );
}

// "¿Qué significa este número?": explica la carga con las propias sesiones del jugador.
function HowToRead({ data }: { data: MyLoadScreen }) {
  const w = data.weekly;
  if (!w) return null;
  const baseline = comparableBaseline(w);
  const sessions = w.current_sessions;
  return (
    <section aria-label="Cómo entender tu carga" className="rounded-xl border border-brand-line bg-brand-wash p-4 lg:p-5">
      <h2 className="font-sans text-base font-bold text-ink">¿Qué significa tu {formatLoad(w.current_load)}?</h2>
      <p className="mt-2 text-sm text-ink">
        Es cuánto trabajó tu cuerpo esta semana. Cada sesión vale <strong>lo duro que fue (0 a 10) × los minutos</strong> que
        duró, y la carga de la semana es la suma de todas.
      </p>
      {sessions.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-ink">
          {sessions.slice(0, 4).map((s) => (
            <li key={s.event_id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-muted">
                {s.type === "gimnasio" ? "Gimnasio" : s.kind === "partido" ? "Partido" : "Entrenamiento"}: {s.rpe} × {s.minutes} min
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{formatLoad(s.load)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">
          Por ejemplo, un entrenamiento de 90 minutos que te costó 6 (Duro) vale 6 × 90 = 540.
        </p>
      )}
      <ul className="mt-3 space-y-1.5 border-t border-brand-line pt-3 text-sm text-ink">
        <li>
          <strong>No es una nota:</strong> no hay un número bueno ni malo. Lo que importa es compararlo con{" "}
          {baseline ? `tu promedio (${formatLoad(baseline)})` : "tu promedio, que aparece cuando tengas 3 semanas con datos"}.
        </li>
        <li>
          <strong>Cerca de tu promedio:</strong> semana habitual. <strong>Mucho más alto:</strong> semana exigente; cuida el
          descanso, el sueño y avisa si algo te molesta. <strong>Más bajo:</strong> semana liviana, o faltaste a sesiones.
        </li>
        <li>Para que sea justo, responde lo duro que fue cada sesión el mismo día: así tu carga refleja lo que realmente hiciste.</li>
      </ul>
    </section>
  );
}
