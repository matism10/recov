"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClubId } from "@/lib/session";
import {
  MAX_INJURY_AGE_DAYS,
  OCCURRED_DURING,
  addDays,
  parseIsoDate,
  todayInChile,
  type OccurredDuring,
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

  const occurredDuring = String(formData.get("occurred_during") ?? "");
  if (!OCCURRED_DURING.includes(occurredDuring as OccurredDuring)) {
    return { error: "Indica si la lesión fue en entrenamiento, en competencia o externa al club." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión expiró. Vuelve a ingresar." };

  // Ficha del plantel activo (con varios planteles hay una por plantel).
  const { data: player } = await supabase
    .from("players")
    .select("id, club_id")
    .eq("user_id", user.id)
    .eq("club_id", await getActiveClubId(user.id))
    .maybeSingle();
  if (!player) return { error: "Tu cuenta no está asociada a un jugador de este plantel." };

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
    p_occurred_during: occurredDuring,
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
