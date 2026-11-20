import Link from "next/link";
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
import { buttonPrimary } from "@/app/ui";
import { EmptyState, PageHeader } from "@/app/ui-blocks";
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
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 lg:max-w-[1080px] lg:px-8 lg:py-10">
      <PageHeader
        title="Asistencia a entrenamientos"
        description={`Del ${formatDayMonth(from)} al ${formatDayMonth(to)}`}
        back={{ fallback: "/dashboard", label: "← Volver al resumen" }}
      />

      <nav aria-label="Período" className="mb-5 inline-flex rounded-xl border border-line bg-mist p-1">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={p === "mes" ? "/asistencia" : "/asistencia?periodo=temporada"}
            aria-current={p === period ? "page" : undefined}
            replace
            className={`inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-medium transition ${
              p === period ? "bg-card text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {ATTENDANCE_PERIOD_LABEL[p]}
          </Link>
        ))}
      </nav>

      {!result.ok ? (
        <MetricsError />
      ) : result.data.length === 0 ? (
        <EmptyState
          title={
            period === "mes"
              ? "Todavía no hay listas guardadas en el último mes"
              : "Todavía no hay listas guardadas esta temporada"
          }
          action={
            staff ? (
              <Link href="/calendario" className={`text-sm ${buttonPrimary}`}>
                Ir al calendario
              </Link>
            ) : undefined
          }
        >
          {staff
            ? "Abre un entrenamiento en el calendario y toca “Pasar lista”: todos parten como presentes y solo marcas a quien faltó."
            : "El ranking aparece cuando el staff pase lista en los entrenamientos."}
        </EmptyState>
      ) : (
        <section className={metricCardClass}>
          <AttendanceList rows={result.data} highlightId={me?.id ?? null} />
        </section>
      )}

      <p className="mt-4 text-xs text-muted">Solo cuentan entrenamientos con lista guardada.</p>
    </main>
  );
}
