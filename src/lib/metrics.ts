// Métricas del plantel (funciones dash_* de la migración 0020).
// Las funciones validan en la base que quien llama sea staff confirmado y toman
// el club de su perfil; aquí solo se tipan los resultados y se registran errores.
import type { createClient } from "@/lib/supabase/server";

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

export async function getDashSummary(supabase: Client): Promise<MetricsResult<DashSummary>> {
  const { data, error } = await supabase.rpc("dash_summary");
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
): Promise<MetricsResult<AvailabilityWeek[]>> {
  const { data, error } = await supabase.rpc("dash_availability_series", { p_weeks: weeks });
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
