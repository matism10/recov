import Link from "next/link";
import { ListChecks } from "lucide-react";
import {
  ATTENDANCE_PERIOD_LABEL,
  attendanceRange,
  getAttendanceRanking,
  type AttendancePeriod,
} from "@/lib/attendance";
import { isStaff } from "@/lib/roles";
import { formatDayMonth } from "@/lib/injuries";
import { AttendanceList } from "@/app/attendance-ranking";
import { MetricsError, metricCardClass } from "@/app/metrics";
import { PageTitle, buttonPrimary, textButton } from "@/app/ui";
import { requireMember } from "@/app/calendario/member";

const PERIODS: AttendancePeriod[] = ["mes", "temporada"];

// Asistencia a entrenamientos de todo el plantel (todos los confirmados). Se llega
// desde la tarjeta del Resumen; no está en el menú.
//   ?periodo=temporada  desde el 1 de enero hasta hoy (por defecto, el último mes)
export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { periodo } = await searchParams;
  const period: AttendancePeriod = periodo === "temporada" ? "temporada" : "mes";
  const { supabase, roles, userId, clubId } = await requireMember();
  const [result, { data: me }] = await Promise.all([
    getAttendanceRanking(supabase, period),
    supabase.from("players").select("id").eq("user_id", userId).eq("club_id", clubId).maybeSingle(),
  ]);
  const staff = isStaff(roles);
  const { from, to } = attendanceRange(period);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <header className="mb-6">
        <Link href="/dashboard" className={textButton}>
          ← Volver al resumen
        </Link>
        <PageTitle className="mt-2">Asistencia a entrenamientos</PageTitle>
        <p className="mt-1 text-sm text-muted">
          Del {formatDayMonth(from)} al {formatDayMonth(to)}
        </p>
      </header>

      <nav aria-label="Período" className="mb-5 inline-flex rounded-xl border border-line bg-mist p-1">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={p === "mes" ? "/asistencia" : "/asistencia?periodo=temporada"}
            aria-current={p === period ? "page" : undefined}
            replace
            className={`inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-medium transition ${
              p === period ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {ATTENDANCE_PERIOD_LABEL[p]}
          </Link>
        ))}
      </nav>

      {!result.ok ? (
        <MetricsError />
      ) : result.data.length === 0 ? (
        <div className={`space-y-3 ${metricCardClass}`}>
          <p className="flex items-start gap-2 text-sm text-ink">
            <ListChecks aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-strong" />
            {period === "mes"
              ? "Todavía no hay listas guardadas en el último mes."
              : "Todavía no hay listas guardadas esta temporada."}
          </p>
          {staff ? (
            <>
              <p className="text-sm text-muted">
                Abre un entrenamiento en el calendario y toca “Pasar lista”: todos parten como presentes y
                solo marcas a quien faltó.
              </p>
              <Link href="/calendario" className={`text-sm ${buttonPrimary}`}>
                Ir al calendario
              </Link>
            </>
          ) : (
            <p className="text-sm text-muted">El ranking aparece cuando el staff pase lista en los entrenamientos.</p>
          )}
        </div>
      ) : (
        <section className={metricCardClass}>
          <AttendanceList rows={result.data} highlightId={me?.id ?? null} />
        </section>
      )}

      <p className="mt-4 text-xs text-muted">Solo cuentan entrenamientos con lista guardada.</p>
    </main>
  );
}
