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

export type MetricsState = { ok?: boolean; error?: string };

// Elige qué métricas ve el staff en el Resumen ("reset" vuelve a las de siempre).
// set_dashboard_metrics valida que quien llama sea head coach y que las claves
// existan en el catálogo.
export async function setDashboardMetrics(
  _prevState: MetricsState,
  formData: FormData,
): Promise<MetricsState> {
  const reset = formData.get("decision") === "reset";
  const chosen = formData.getAll("metrics").map(String);
  if (!chosen.every((m) => (DASHBOARD_METRICS as readonly string[]).includes(m))) {
    return { error: "Elige métricas de la lista." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_dashboard_metrics", {
    p_metrics: reset ? null : DASHBOARD_METRICS.filter((m) => chosen.includes(m)),
  });
  if (error) {
    return {
      error:
        error.code === "42501"
          ? "Solo el head coach puede elegir las métricas del Resumen."
          : "No se pudieron guardar las métricas.",
    };
  }
  revalidatePath("/configuracion");
  revalidatePath("/dashboard");
  return { ok: true };
}
