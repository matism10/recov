"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
