"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  DESCRIPTION_MAX,
  DURATION_MAX,
  FILE_NAME_MAX,
  FILE_TYPES,
  INJURY_TYPE_MAX,
  INJURY_TYPE_MIN,
  MAX_FILES,
  MAX_INJURY_AGE_DAYS,
  MIN_FILES,
  addDays,
  parseIsoDate,
  todayInChile,
  type DurationUnit,
} from "@/lib/injuries";

export type ReportInjuryState = { error?: string; injuryId?: string };

type UploadedFile = { path: string; name: string };

const FILE_NAME_RE = new RegExp(
  `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(${Object.values(FILE_TYPES).join("|")})$`,
);

function parseFiles(raw: string): UploadedFile[] | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return null;
    const files: UploadedFile[] = [];
    for (const f of value) {
      if (typeof f?.path !== "string" || typeof f?.name !== "string") return null;
      files.push({ path: f.path, name: f.name.trim() });
    }
    return files;
  } catch {
    return null;
  }
}

export async function reportInjury(
  _prevState: ReportInjuryState,
  formData: FormData,
): Promise<ReportInjuryState> {
  const type = String(formData.get("type") ?? "").trim();
  const injuryDate = String(formData.get("injury_date") ?? "");
  const durationValue = Number(formData.get("duration_value"));
  const durationUnit = String(formData.get("duration_unit") ?? "") as DurationUnit;
  const description = String(formData.get("description") ?? "").trim();
  const files = parseFiles(String(formData.get("files") ?? ""));

  // Mismas reglas que report_injury, para responder con mensajes claros.
  if (type.length < INJURY_TYPE_MIN || type.length > INJURY_TYPE_MAX) {
    return {
      error: `Describe el tipo de lesión (${INJURY_TYPE_MIN} a ${INJURY_TYPE_MAX} caracteres).`,
    };
  }
  const today = todayInChile();
  if (
    parseIsoDate(injuryDate) === null ||
    injuryDate > today ||
    injuryDate < addDays(today, -MAX_INJURY_AGE_DAYS)
  ) {
    return { error: "La fecha debe ser de hoy o de los últimos 12 meses." };
  }
  if (
    !(durationUnit in DURATION_MAX) ||
    !Number.isInteger(durationValue) ||
    durationValue < 1 ||
    durationValue > DURATION_MAX[durationUnit]
  ) {
    return {
      error: `La duración debe ser de 1 a ${DURATION_MAX.semanas} semanas o de 1 a ${DURATION_MAX.meses} meses.`,
    };
  }
  if (description.length > DESCRIPTION_MAX) {
    return { error: `La descripción no puede superar los ${DESCRIPTION_MAX} caracteres.` };
  }
  if (!files || files.length < MIN_FILES || files.length > MAX_FILES) {
    return { error: `Adjunta entre ${MIN_FILES} y ${MAX_FILES} documentos.` };
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

  // Cada archivo debe estar en la carpeta del propio jugador, con el nombre que
  // genera el formulario. report_injury además verifica que exista en Storage.
  const folder = `${player.club_id}/${player.id}/`;
  for (const f of files) {
    if (
      !f.path.startsWith(folder) ||
      !FILE_NAME_RE.test(f.path.slice(folder.length)) ||
      !f.name ||
      f.name.length > FILE_NAME_MAX
    ) {
      return { error: "Uno de los documentos no es válido. Vuelve a adjuntarlo." };
    }
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
