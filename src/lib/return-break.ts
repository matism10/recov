// Vuelta tras parón (20261110130000). Solo informativo: se calcula al leer, sin tablas nuevas.
// Parón = 10 días o más sin actividad con evidencia (ausencia declarada, "No fui", ausente en la
// lista o lesión); la vuelta es la primera actividad posterior y el aviso dura 14 días. Si el
// plantel entero estuvo en parón declarado, o 60 % o más vuelve junto, hay un solo aviso de
// equipo. Umbrales provisorios en la base (private.break_days, return_window_days,
// team_break_share). En la interfaz no se habla de riesgo de lesión.
import type { createClient } from "@/lib/supabase/server";
import type { Format } from "@/lib/sevens";
import { weekStart } from "@/lib/events";

type Client = Awaited<ReturnType<typeof createClient>>;

export type ReturnCause = "lesion" | "vacaciones" | "viaje_trabajo" | "estudios" | "salud" | "otro" | "ausencia";

export const RETURN_LEGEND = "Solo informativo";

// "tras lesión", "tras vacaciones"...
export function causeText(cause: string | null | undefined) {
  switch (cause) {
    case "lesion":
      return "tras lesión";
    case "vacaciones":
      return "tras vacaciones";
    case "viaje_trabajo":
      return "tras un viaje o trabajo";
    case "estudios":
      return "tras estudios";
    case "salud":
      return "tras una ausencia por salud";
    default:
      return "tras una ausencia";
  }
}

// "1 semana", "3 semanas".
export function weeksText(weeks: number) {
  return `${weeks} ${weeks === 1 ? "semana" : "semanas"}`;
}

export type PlayerReturnFlag = {
  returned_on: string;
  last_active_on: string;
  gap_days: number;
  weeks: number;
  cause: ReturnCause;
  squad_break: boolean;
  in_team: boolean;
  baseline: number | null;
  current_load: number;
};

// Ficha (staff con carga_ver o el propio jugador): null si no hay vuelta vigente.
export async function getPlayerReturnFlag(supabase: Client, playerId: string, format: Format) {
  const { data, error } = await supabase.rpc("player_return_flag", { p_player_id: playerId, p_format: format });
  if (error || !data || data.length === 0) return null;
  return data[0] as PlayerReturnFlag;
}

export type TeamReturnSummary = {
  window_days: number;
  break_days: number;
  team: {
    count: number;
    roster: number;
    share: number;
    weeks: number;
    squad_break: boolean;
    returned_from: string;
    returned_to: string;
  } | null;
  individual: { player_id: string; full_name: string; returned_on: string; weeks: number; cause: ReturnCause }[];
};

// Métricas (staff con carga_ver). Si falla, null.
export async function getTeamReturnSummary(supabase: Client, format: Format) {
  const { data, error } = await supabase.rpc("team_return_summary", { p_format: format });
  if (error || !data) return null;
  return data as TeamReturnSummary;
}

// Semanas (lunes, YYYY-MM-DD) enteras dentro del parón: entre la semana de la última actividad
// y la de la vuelta, sin contarlas. Se marcan con "Parón" en el gráfico semanal.
export function breakWeekStarts(flag: Pick<PlayerReturnFlag, "last_active_on" | "returned_on">) {
  const first = weekStart(flag.last_active_on);
  const last = weekStart(flag.returned_on);
  const out = new Set<string>();
  for (let d = addWeek(first); d < last; d = addWeek(d)) out.add(d);
  return out;
}

function addWeek(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}
