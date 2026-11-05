"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { srpeErrorMessage, type WellnessItem } from "@/lib/srpe";

export type WellnessState = { ok?: boolean; error?: string };

// Guarda el check de bienestar. submit_wellness decide la fecha (hoy o, si hoy no toca
// y ayer sí, ayer) y corrige si ya había uno para esa fecha.
export async function submitWellness(values: Record<WellnessItem, number>): Promise<WellnessState> {
  const keys: WellnessItem[] = ["fatigue", "sleep", "soreness", "stress", "mood"];
  if (!keys.every((k) => Number.isInteger(values[k]) && values[k] >= 1 && values[k] <= 5)) {
    return { error: "Responde las 5 preguntas." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_wellness", {
    p_fatigue: values.fatigue,
    p_sleep: values.sleep,
    p_soreness: values.soreness,
    p_stress: values.stress,
    p_mood: values.mood,
  });
  if (error) return { error: srpeErrorMessage(error, "No se pudo enviar tu check. Intenta de nuevo.") };
  revalidatePath("/dashboard");
  revalidatePath("/bienestar");
  return { ok: true };
}
