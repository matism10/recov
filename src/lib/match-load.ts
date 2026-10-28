// Nóminas y carga del plantel (migraciones 0027 y 0028). Tipos y etiquetas
// compartidos entre servidor y cliente. Los valores por deporte (duración, tope,
// cortes, puntos medios y etiquetas de los rangos) vienen de la base
// (public.sports y public.sport_load_scale): aquí no hay números fijos.
import type { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/roles";

type Client = Awaited<ReturnType<typeof createClient>>;

export type NominaMode = "exacto" | "rango" | "jugo";
export const NOMINA_MODES = ["exacto", "rango", "jugo"] as const satisfies readonly NominaMode[];

export const NOMINA_MODE_LABEL: Record<NominaMode, string> = {
  exacto: "Minutos exactos",
  rango: "Rango de minutos",
  jugo: "Jugó / no jugó",
};

export const NOMINA_MODE_HINT: Record<NominaMode, string> = {
  exacto: "Se anotan los minutos que jugó cada convocado.",
  rango: "Se elige un rango de minutos según el deporte del plantel.",
  jugo: "Solo se marca si cada convocado jugó o no.",
};

// Semáforo de carga (solo staff).
export type LoadStatus = "alta" | "normal" | "baja" | "sin_minutos" | "sin_partidos";

export const LOAD_STATUS_LABEL: Record<LoadStatus, string> = {
  alta: "Alta",
  normal: "Normal",
  baja: "Baja",
  sin_minutos: "Sin minutos",
  sin_partidos: "Sin partidos",
};

// Clases literales para que Tailwind las genere.
export const LOAD_STATUS_STYLE: Record<LoadStatus, string> = {
  alta: "bg-lesionado-bg text-lesionado-fg",
  normal: "bg-disponible-bg text-disponible-fg",
  baja: "bg-revision-bg text-revision-fg",
  sin_minutos: "bg-surface-2 text-muted",
  sin_partidos: "bg-surface-2 text-muted",
};

// Un rango de la escala del deporte (public.sport_load_scale).
export type LoadScaleRow = {
  bucket: number;
  label: string;
  min_from: number;
  min_to: number;
  midpoint: number;
};

export type LoadMatch = { event_id: string; starts_at: string; opponent: string | null };

// Valor de un jugador en un partido de la ventana.
export type LoadValue = {
  event_id: string;
  value: number | null; // minutos, punto medio o 1/0; null = cargado en otro modo
  bucket: number | null;
  played: boolean;
  convocado: boolean;
  loaded: boolean;
  other_mode: boolean;
};

export type PlayerLoad = {
  player_id: string;
  full_name: string;
  position: string | null;
  total: number;
  other_mode: number;
  played_count: number;
  status: LoadStatus | null;
  values: LoadValue[];
};

type LoadBase = {
  mode: NominaMode;
  sport: string;
  match_minutes: number;
  window_size: number;
  matches_count: number;
  scale: LoadScaleRow[];
  matches: LoadMatch[];
  reference: number | null; // promedio de los totales > 0 del plantel
  other_mode_count: number;
};

export type TeamLoad = LoadBase & { players: PlayerLoad[] };

export type MyCallup = {
  event_id: string;
  starts_at: string;
  opponent: string | null;
  location: string | null;
  slot: number | null; // puesto en la nómina (0029)
  mode: NominaMode | null;
  minutes: number | null;
  range_bucket: number | null;
  played: boolean | null;
  loaded: boolean;
};

export type MyLoad = LoadBase & {
  player: PlayerLoad | null;
  starters: number; // titulares del deporte: los puestos siguientes son la banca
  callups: MyCallup[];
};

export type LoadResult<T> = { ok: true; data: T } | { ok: false };

// Carga del plantel (staff). La función valida en la base que sea staff confirmado.
// format: el del evento o el activo ('15' por defecto); en '7' el plantel es el grupo Sevens.
export async function getTeamLoad(
  supabase: Client,
  matches = 4,
  format: "15" | "7" = "15",
): Promise<LoadResult<TeamLoad>> {
  const { data, error } = await supabase.rpc("team_match_load", { p_matches: matches, p_format: format });
  if (error || !data) {
    if (error) console.error("[match-load] team_match_load:", error.message);
    return { ok: false };
  }
  return { ok: true, data: data as TeamLoad };
}

// Carga propia del jugador autenticado (sin datos de otros ni semáforo).
export async function getMyLoad(supabase: Client, format: "15" | "7" = "15"): Promise<LoadResult<MyLoad>> {
  const { data, error } = await supabase.rpc("my_match_load", { p_format: format });
  if (error || !data) {
    if (error) console.error("[match-load] my_match_load:", error.message);
    return { ok: false };
  }
  return { ok: true, data: data as MyLoad };
}

// Escala de rangos del deporte del club en un formato (Sevens tiene la suya).
export async function getLoadScale(
  supabase: Client,
  sport: string,
  format: "15" | "7" = "15",
): Promise<LoadScaleRow[]> {
  const { data } = await supabase.rpc("format_load_scale", { p_sport: sport, p_format: format });
  return ((data ?? []) as LoadScaleRow[]).sort((a, b) => a.bucket - b.bucket);
}

// Arman la convocatoria y cargan la participación: head coach, manager y el
// delegado de nóminas. Igual que private.can_manage_nominas(); solo decide qué
// se muestra, el permiso real lo verifica la base.
export function canManageNominas(
  roles: readonly UserRole[],
  userId: string,
  nominaDelegateId: string | null | undefined,
) {
  return roles.includes("head_coach") || roles.includes("manager") || nominaDelegateId === userId;
}

// Total de la ventana para mostrar: "≈" en rango, "X de N" en jugó.
export function totalLabel(mode: NominaMode, total: number, matches: number) {
  if (mode === "jugo") return `${total} de ${matches}`;
  return `${mode === "rango" ? "≈" : ""}${Math.round(total)} min`;
}

// Etiqueta de la participación de un partido (lista "Mis partidos").
export function participationLabel(c: MyCallup, scale: LoadScaleRow[]) {
  if (!c.loaded) return null;
  if (c.mode === "exacto" && c.minutes !== null) return c.minutes > 0 ? `${c.minutes} min` : "No jugó";
  if (c.mode === "rango" && c.range_bucket !== null) {
    if (c.range_bucket === 0) return "No jugó";
    const row = scale.find((s) => s.bucket === c.range_bucket);
    return row ? `${row.label} min` : "Jugó";
  }
  return c.played ? "Jugó" : "No jugó";
}

// Racha: partidos seguidos jugados al final de la ventana (modo jugó).
export function playedStreak(values: LoadValue[]) {
  let n = 0;
  for (let i = values.length - 1; i >= 0 && values[i].played; i--) n++;
  return n;
}

// Titulares y banca de un deporte en un formato: el 15 sale de sports y los demás
// formatos de sport_format_config (Sevens: 7 + 5).
export async function getLineupSize(
  supabase: Client,
  sport: string,
  format: "15" | "7" = "15",
): Promise<{ starters: number; bench: number }> {
  const { data } =
    format === "15"
      ? await supabase.from("sports").select("starters, bench_size").eq("slug", sport).maybeSingle()
      : await supabase
          .from("sport_format_config")
          .select("starters, bench_size")
          .eq("sport", sport)
          .eq("format", format)
          .maybeSingle();
  return { starters: (data?.starters as number | undefined) ?? 0, bench: (data?.bench_size as number | undefined) ?? 0 };
}
