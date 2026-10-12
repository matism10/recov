// Validación del reporte del jugador, compartida por report_injury (registrar
// lesión) y complete_injury_report (completar una lesión en evaluación).
import {
  DESCRIPTION_MAX,
  DURATION_MAX,
  FILE_NAME_MAX,
  FILE_TYPES,
  INJURY_TYPE_MAX,
  INJURY_TYPE_MIN,
  MAX_FILES,
  MIN_FILES,
  type DurationUnit,
} from "@/lib/injuries";

export type UploadedFile = { path: string; name: string };

export type ReportFields = {
  type: string;
  durationValue: number;
  durationUnit: DurationUnit;
  description: string;
  files: UploadedFile[];
};

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

// Mismas reglas que las funciones de la base, para responder con mensajes claros.
export function readReportFields(
  formData: FormData,
): { error: string } | { fields: ReportFields } {
  const type = String(formData.get("type") ?? "").trim();
  const durationValue = Number(formData.get("duration_value"));
  const durationUnit = String(formData.get("duration_unit") ?? "") as DurationUnit;
  const description = String(formData.get("description") ?? "").trim();
  const files = parseFiles(String(formData.get("files") ?? ""));

  if (type.length < INJURY_TYPE_MIN || type.length > INJURY_TYPE_MAX) {
    return {
      error: `Describe el tipo de lesión (${INJURY_TYPE_MIN} a ${INJURY_TYPE_MAX} caracteres).`,
    };
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

  return { fields: { type, durationValue, durationUnit, description, files } };
}

// Cada archivo debe estar en la carpeta del propio jugador, con el nombre que
// genera el formulario. La base además verifica que exista en Storage.
export function filesInPlayerFolder(
  files: UploadedFile[],
  clubId: string,
  playerId: string,
) {
  const folder = `${clubId}/${playerId}/`;
  return files.every(
    (f) =>
      f.path.startsWith(folder) &&
      FILE_NAME_RE.test(f.path.slice(folder.length)) &&
      f.name &&
      f.name.length <= FILE_NAME_MAX,
  );
}
