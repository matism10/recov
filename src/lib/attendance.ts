// Asistencia a entrenamientos (20261105120000): el staff pasa lista con
// set_event_attendance y todos los confirmados ven el ranking (attendance_ranking).
import type { createClient } from "@/lib/supabase/server";
import { addDays, todayInChile } from "@/lib/injuries";

type Client = Awaited<ReturnType<typeof createClient>>;

export type AttendanceRow = {
  player_id: string;
  full_name: string;
  attended: number;
  total: number;
};

export type AttendancePeriod = "mes" | "temporada";

export const ATTENDANCE_PERIOD_LABEL: Record<AttendancePeriod, string> = {
  mes: "Último mes",
  temporada: "Temporada",
};

// Último mes: los 30 días que terminan hoy. Temporada: desde el 1 de enero del año
// en curso. Fechas en hora de Chile, como la función.
export function attendanceRange(period: AttendancePeriod, today = todayInChile()) {
  return period === "temporada"
    ? { from: `${today.slice(0, 4)}-01-01`, to: today }
    : { from: addDays(today, -29), to: today };
}

export async function getAttendanceRanking(supabase: Client, period: AttendancePeriod) {
  const { from, to } = attendanceRange(period);
  const { data, error } = await supabase.rpc("attendance_ranking", { p_from: from, p_to: to });
  if (error) return { ok: false as const };
  return { ok: true as const, data: (data ?? []) as AttendanceRow[] };
}

export function attendancePercent(row: { attended: number; total: number }) {
  return row.total > 0 ? Math.round((row.attended / row.total) * 100) : 0;
}

// Barra: verde desde 85 %, ámbar de 70 a 84 % y rojo bajo 70 %.
// Clases literales: Tailwind solo genera las que aparecen escritas.
export function attendanceBarClass(percent: number) {
  if (percent >= 85) return "bg-disponible";
  if (percent >= 70) return "bg-revision";
  return "bg-lesionado";
}
