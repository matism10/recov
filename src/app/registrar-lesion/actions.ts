"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_INJURY_AGE_DAYS,
  addDays,
  parseIsoDate,
  todayInChile,
} from "@/lib/injuries";
import { filesInPlayerFolder, readReportFields } from "./report-fields";

export type ReportInjuryState = { error?: string; injuryId?: string };

export async function reportInjury(
  _prevState: ReportInjuryState,
  formData: FormData,
): Promise<ReportInjuryState> {
  const read = readReportFields(formData);
  if ("error" in read) return read;
  const { type, durationValue, durationUnit, description, files } = read.fields;

  const injuryDate = String(formData.get("injury_date") ?? "");
  const today = todayInChile();
  if (
    parseIsoDate(injuryDate) === null ||
    injuryDate > today ||
    injuryDate < addDays(today, -MAX_INJURY_AGE_DAYS)
  ) {
    return { error: "La fecha debe ser de hoy o de los últimos 12 meses." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión expiró. Vuelve a ingresar." };

  const { data: player } = await supabase
    .from("players")
    .select("id, club_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!player) return { error: "Tu cuenta no está asociada a un jugador del club." };

  if (!filesInPlayerFolder(files, player.club_id, player.id)) {
    return { error: "Uno de los documentos no es válido. Vuelve a adjuntarlo." };
  }

  const { data: injuryId, error } = await supabase.rpc("report_injury", {
    p_type: type,
    p_injury_date: injuryDate,
    p_duration_value: durationValue,
    p_duration_unit: durationUnit,
    p_description: description || null,
    p_files: files,
  });

  if (error) {
    // P0001: excepción propia de report_injury, con mensaje en español.
    return {
      error:
        error.code === "P0001"
          ? error.message
          : "No se pudo registrar la lesión. Intenta de nuevo.",
    };
  }

  revalidatePath("/dashboard");
  return { injuryId: injuryId as string };
}
