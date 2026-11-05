"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { gymErrorMessage, planPayload, type DraftPlan } from "@/lib/gym";

export type PlanActionState = { id?: string; error?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Guarda el plan completo (save_gym_plan) y, si se pide, lo publica. La base valida
// permisos (head coach o preparador físico), rangos y que tests, posiciones y jugadores
// sean del plantel. Si guarda pero no publica, devuelve el id con el error.
export async function savePlan(plan: DraftPlan, publish: boolean): Promise<PlanActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_gym_plan", { p_plan: planPayload(plan) });
  if (error || !data) return { error: gymErrorMessage(error ?? { message: "" }, "No se pudo guardar el plan. Intenta de nuevo.") };
  const id = data as string;
  if (publish) {
    const { error: pubError } = await supabase.rpc("publish_gym_plan", { p_plan_id: id });
    if (pubError) {
      revalidatePath("/planes");
      return { id, error: gymErrorMessage(pubError, "El borrador se guardó, pero no se pudo publicar.") };
    }
  }
  revalidatePath("/planes");
  revalidatePath(`/planes/${id}`);
  revalidatePath("/dashboard");
  return { id };
}

export async function archivePlan(planId: string): Promise<PlanActionState> {
  if (!UUID_RE.test(planId)) return { error: "Datos no válidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_gym_plan", { p_plan_id: planId });
  if (error) return { error: gymErrorMessage(error, "No se pudo archivar el plan.") };
  revalidatePath("/planes");
  revalidatePath(`/planes/${planId}`);
  revalidatePath("/dashboard");
  return { id: planId };
}
