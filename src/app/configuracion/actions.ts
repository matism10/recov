"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DASHBOARD_METRICS } from "@/lib/dashboard-metrics";

export type LogoState = { ok?: boolean; error?: string };

// Fija (o quita, con null) el logo del club. set_club_logo valida que quien llama
// sea de la dirección y que la ruta sea de su club.
export async function setClubLogo(path: string | null): Promise<LogoState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_club_logo", { p_path: path });
  if (error) {
    return {
      error: error.code === "P0001" ? error.message : "No se pudo guardar el logo.",
    };
  }
  revalidatePath("/configuracion");
  revalidatePath("/", "layout"); // logo del sidebar
  return { ok: true };
}

export type CoverState = { ok?: boolean; error?: string };

// Fija (o quita, con null) la portada del club. set_club_cover valida que quien
// llama sea de la dirección y que la ruta sea de su club y exista.
export async function setClubCover(path: string | null): Promise<CoverState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_club_cover", { p_path: path });
  if (error) {
    return {
      error: error.code === "P0001" ? error.message : "No se pudo guardar la portada.",
    };
  }
  revalidatePath("/configuracion");
  revalidatePath("/", "layout"); // encabezado del club
  return { ok: true };
}

// Encuadre de la portada (object-position en %, 0–100). set_club_cover_position
// valida que quien llama sea de la dirección y que el club tenga portada.
export async function setClubCoverPosition(x: number, y: number): Promise<CoverState> {
  const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_club_cover_position", {
    p_x: clamp(x),
    p_y: clamp(y),
  });
  if (error) {
    return {
      error: error.code === "P0001" ? error.message : "No se pudo guardar el encuadre.",
    };
  }
  revalidatePath("/configuracion");
  revalidatePath("/", "layout"); // encabezado del club
  return { ok: true };
}

export type MetricsState = { ok?: boolean; error?: string };

// Elige qué métricas ve el staff en el Resumen, por separado en computador
// ("metrics") y en celular ("metrics_mobile"); "reset" vuelve a las de siempre en
// ambos. set_dashboard_metrics y set_dashboard_metrics_mobile validan que quien
// llama sea head coach y que las claves existan en el catálogo.
export async function setDashboardMetrics(
  _prevState: MetricsState,
  formData: FormData,
): Promise<MetricsState> {
  const reset = formData.get("decision") === "reset";
  const desktop = formData.getAll("metrics").map(String);
  const mobile = formData.getAll("metrics_mobile").map(String);
  const valid = (list: string[]) =>
    list.every((m) => (DASHBOARD_METRICS as readonly string[]).includes(m));
  if (!valid(desktop) || !valid(mobile)) return { error: "Elige métricas de la lista." };
  const ordered = (list: string[]) => DASHBOARD_METRICS.filter((m) => list.includes(m));

  const supabase = await createClient();
  for (const [fn, list] of [
    ["set_dashboard_metrics", desktop],
    ["set_dashboard_metrics_mobile", mobile],
  ] as const) {
    const { error } = await supabase.rpc(fn, { p_metrics: reset ? null : ordered(list) });
    if (error) {
      return {
        error:
          error.code === "42501"
            ? "Solo el head coach puede elegir las métricas del Resumen."
            : "No se pudieron guardar las métricas.",
      };
    }
  }
  revalidatePath("/configuracion");
  revalidatePath("/dashboard");
  return { ok: true };
}
