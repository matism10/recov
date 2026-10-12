"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  filesInPlayerFolder,
  readReportFields,
} from "@/app/registrar-lesion/report-fields";
import type { ReportInjuryState } from "@/app/registrar-lesion/actions";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function completeInjuryReport(
  _prevState: ReportInjuryState,
  formData: FormData,
): Promise<ReportInjuryState> {
  const injuryId = String(formData.get("injury_id") ?? "");
  if (!UUID_RE.test(injuryId)) return { error: "Lesión no válida." };

  const read = readReportFields(formData);
  if ("error" in read) return read;
  const { type, durationValue, durationUnit, description, files } = read.fields;

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

  // complete_injury_report verifica que la lesión sea del jugador y siga en evaluación.
  const { error } = await supabase.rpc("complete_injury_report", {
    p_injury_id: injuryId,
    p_type: type,
    p_duration_value: durationValue,
    p_duration_unit: durationUnit,
    p_description: description || null,
    p_files: files,
  });

  if (error) {
    // P0001: excepción propia de complete_injury_report, con mensaje en español.
    return {
      error:
        error.code === "P0001"
          ? error.message
          : "No se pudo enviar el diagnóstico. Intenta de nuevo.",
    };
  }

  revalidatePath(`/lesiones/${injuryId}`);
  revalidatePath("/dashboard");
  return { injuryId };
}
