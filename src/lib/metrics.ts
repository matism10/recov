// Métricas del plantel (funciones dash_* de la migración 0020).
// Las funciones validan en la base que quien llama sea staff confirmado y toman
// el club de su perfil; aquí solo se tipan los resultados y se registran errores.
import type { createClient } from "@/lib/supabase/server";
import type { Availability } from "@/lib/roles";
import type { Format } from "@/lib/sevens";

// Desde 0046 cada función recibe el formato: en Sevens cuenta solo el grupo Sevens.

type Client = Awaited<ReturnType<typeof createClient>>;

export type DashSummary = {
  total: number;
  disponibles: number;
  en_revision: number;
  lesionados: number;
  reintegro: number;
};

export type AvailabilityWeek = {
  week_start: string; // YYYY-MM-DD, lunes de la semana
  disponible: number;
  en_revision: number;
  lesionado: number;
  reintegro: number;
};

export type MetricsResult<T> = { ok: true; data: T } | { ok: false };

export async function getDashSummary(
  supabase: Client,
  format: Format = "15",
): Promise<MetricsResult<DashSummary>> {
  const { data, error } = await supabase.rpc("dash_summary", { p_format: format });
  if (error) {
    console.error("[metrics] dash_summary:", error.message);
    return { ok: false };
  }
  const row = (data ?? [])[0];
  return {
    ok: true,
    data: {
      total: Number(row?.total ?? 0),
      disponibles: Number(row?.disponibles ?? 0),
      en_revision: Number(row?.en_revision ?? 0),
      lesionados: Number(row?.lesionados ?? 0),
      reintegro: Number(row?.reintegro ?? 0),
    },
  };
}

export async function getAvailabilitySeries(
  supabase: Client,
  weeks = 12,
  format: Format = "15",
): Promise<MetricsResult<AvailabilityWeek[]>> {
  const { data, error } = await supabase.rpc("dash_availability_series", { p_weeks: weeks, p_format: format });
  if (error) {
    console.error("[metrics] dash_availability_series:", error.message);
    return { ok: false };
  }
  return {
    ok: true,
    data: ((data ?? []) as AvailabilityWeek[]).map((w) => ({
      week_start: String(w.week_start),
      disponible: Number(w.disponible),
      en_revision: Number(w.en_revision),
      lesionado: Number(w.lesionado),
      reintegro: Number(w.reintegro),
    })),
  };
}

export type WeekCount = { week_start: string; injuries_count: number };
export type PlaceKey = "entrenamiento" | "competencia" | "externo" | "sin_dato";
export type PlaceCount = { place_key: PlaceKey; injuries_count: number };
export type PositionCount = { position_name: string; injuries_count: number; players_count: number };
export type RecurringPlayer = {
  player_id: string;
  full_name: string;
  position_name: string;
  injuries_count: number;
  last_injury_on: string; // YYYY-MM-DD
};
export type UpcomingReturn = {
  injury_id: string;
  player_id: string;
  full_name: string;
  position_name: string;
  return_on: string; // YYYY-MM-DD
  days_left: number; // negativo si ya venció
};

// Llama a una función dash_* y tipa sus filas; si falla, lo registra.
async function rpcRows<T>(
  supabase: Client,
  fn: string,
  map: (row: Record<string, unknown>) => T,
  args?: Record<string, unknown>,
): Promise<MetricsResult<T[]>> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    console.error(`[metrics] ${fn}:`, error.message);
    return { ok: false };
  }
  return { ok: true, data: ((data ?? []) as Record<string, unknown>[]).map(map) };
}

export function getInjuriesByWeek(supabase: Client, weeks = 12, format: Format = "15") {
  return rpcRows<WeekCount>(
    supabase,
    "dash_injuries_by_week",
    (r) => ({ week_start: String(r.week_start), injuries_count: Number(r.injuries_count) }),
    { p_weeks: weeks, p_format: format },
  );
}

export function getInjuriesByPlace(supabase: Client, format: Format = "15") {
  return rpcRows<PlaceCount>(supabase, "dash_injuries_by_place", (r) => ({
    place_key: r.place_key as PlaceKey,
    injuries_count: Number(r.injuries_count),
  }), { p_format: format });
}

export function getInjuriesByPosition(supabase: Client, format: Format = "15") {
  return rpcRows<PositionCount>(supabase, "dash_injuries_by_position", (r) => ({
    position_name: String(r.position_name),
    injuries_count: Number(r.injuries_count),
    players_count: Number(r.players_count),
  }), { p_format: format });
}

export function getRecurringPlayers(supabase: Client, format: Format = "15") {
  return rpcRows<RecurringPlayer>(supabase, "dash_recurring_players", (r) => ({
    player_id: String(r.player_id),
    full_name: String(r.full_name),
    position_name: String(r.position_name),
    injuries_count: Number(r.injuries_count),
    last_injury_on: String(r.last_injury_on),
  }), { p_format: format });
}

export function getUpcomingReturns(supabase: Client, format: Format = "15") {
  return rpcRows<UpcomingReturn>(supabase, "dash_upcoming_returns", (r) => ({
    injury_id: String(r.injury_id),
    player_id: String(r.player_id),
    full_name: String(r.full_name),
    position_name: String(r.position_name),
    return_on: String(r.return_on),
    days_left: Number(r.days_left),
  }), { p_format: format });
}

export type PlayerStatus = { id: string; availability: Availability; user_id: string | null };

// Disponibilidad y cuenta de los jugadores de las listas (para el estado y la foto).
// Solo lectura bajo la RLS de players: el staff ve el plantel de su club.
export async function getPlayersStatus(
  supabase: Client,
  ids: string[],
): Promise<MetricsResult<Map<string, PlayerStatus>>> {
  if (ids.length === 0) return { ok: true, data: new Map() };
  const { data, error } = await supabase
    .from("players")
    .select("id, availability, user_id")
    .in("id", ids);
  if (error) {
    console.error("[metrics] players:", error.message);
    return { ok: false };
  }
  return {
    ok: true,
    data: new Map(((data ?? []) as PlayerStatus[]).map((p) => [p.id, p])),
  };
}

// "2026-07-27" → "27 jul". La fecha se arma con sus partes locales (año, mes,
// día) para que la zona horaria no la corra un día.
const shortDate = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" });
export function formatShortDate(isoDate: string) {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  return shortDate.format(new Date(year, month - 1, day));
}

// Plazo hasta el alta estimada, con los mismos cortes que returnLabel de /dashboard:
// menos de 14 días se cuenta en días; desde 14, en semanas.
export function deadlineLabel(daysLeft: number) {
  if (daysLeft < 0) {
    const days = -daysLeft;
    return `Vencida hace ${days === 1 ? "1 día" : `${days} días`}`;
  }
  if (daysLeft === 0) return "Hoy";
  if (daysLeft < 14) return `En ${daysLeft === 1 ? "1 día" : `${daysLeft} días`}`;
  return `En ${Math.round(daysLeft / 7)} semanas`;
}
