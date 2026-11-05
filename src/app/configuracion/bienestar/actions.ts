"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type WellnessDaysState = { ok?: boolean; error?: string };

// Días del check de bienestar. set_wellness_days valida el rol (head coach, manager o
// preparador físico) y que haya de 1 a 7 días sin repetir.
export async function saveWellnessDays(days: number[]): Promise<WellnessDaysState> {
  const clean = [...new Set(days)].filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  if (clean.length === 0) return { error: "Elige al menos un día." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_wellness_days", { p_days: clean });
  if (error) {
    return {
      error:
        error.code === "42501"
          ? "Solo el head coach, el manager o el preparador físico eligen los días."
          : "No se pudieron guardar los días.",
    };
  }
  revalidatePath("/configuracion/bienestar");
  revalidatePath("/dashboard");
  revalidatePath("/bienestar");
  return { ok: true };
}
