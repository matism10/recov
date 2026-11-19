// Carga del plantel por semana y bienestar del plantel (20261118120000). Ambas funciones
// exigen carga_ver en la base y respetan el formato; aquí solo se tipan y se leen.
import type { createClient } from "@/lib/supabase/server";
import type { Format } from "@/lib/sevens";
import type { WellnessItem } from "@/lib/wellness-scale";

type Client = Awaited<ReturnType<typeof createClient>>;

export type TeamLoadWeek = {
  week_start: string;
  in_progress: boolean;
  cancha: number;
  gimnasio: number;
  partido: number;
  total: number;
  responded: number;
  roster: number;
  avg_load: number | null; // por jugador que respondió
  prior_avg: number | null; // promedio de avg_load en las 4 semanas anteriores con datos
  prior_weeks: number;
};

export async function getTeamLoadWeekly(supabase: Client, format: Format, weeks = 6): Promise<TeamLoadWeek[] | null> {
  const { data, error } = await supabase.rpc("team_load_weekly", { p_weeks: weeks, p_format: format });
  if (error || !data) return null;
  return (data as TeamLoadWeek[]).map((w) => ({
    ...w,
    week_start: String(w.week_start),
    avg_load: w.avg_load === null ? null : Number(w.avg_load),
    prior_avg: w.prior_avg === null ? null : Number(w.prior_avg),
  }));
}

export type TeamWellness = {
  roster: number;
  recent_avg: number | null;
  recent_responded: number;
  weeks: { week_start: string; in_progress: boolean; avg_total: number | null; responded: number }[];
  lowest: {
    player_id: string;
    full_name: string;
    report_date: string;
    total: number;
    items: { key: WellnessItem; stored: number; shown: number }[];
  }[];
};

export async function getTeamWellness(supabase: Client, format: Format): Promise<TeamWellness | null> {
  const { data, error } = await supabase.rpc("team_wellness_summary", { p_format: format });
  if (error || !data) return null;
  return data as TeamWellness;
}

// "+12 %" / "−8 %" respecto de una referencia; null sin referencia.
export function pctVs(value: number | null, ref: number | null) {
  if (value === null || ref === null || ref <= 0) return null;
  return Math.round((value / ref - 1) * 100);
}
