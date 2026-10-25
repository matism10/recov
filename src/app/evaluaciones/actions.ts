"use server";

import { revalidatePath } from "next/cache";
import { getActiveClubId, getSessionUser, getSupabase } from "@/lib/session";
import { isUuid } from "@/lib/active-club";
import { parseIsoDate } from "@/lib/injuries";
import { SUGGESTED_TESTS, evaluationErrorMessage, parseValue, type DisplayFormat } from "@/lib/evaluations";

export type EvalState = { ok?: boolean; error?: string; saved?: number };

function done(state: EvalState = { ok: true }) {
  revalidatePath("/evaluaciones", "layout");
  revalidatePath("/jugadores", "layout");
  return state;
}

async function activeClub() {
  const user = await getSessionUser();
  return user ? getActiveClubId(user.id) : null;
}

// Copia los tests sugeridos al catálogo del plantel (los que ya existen se saltan).
export async function addSuggestedTests(): Promise<EvalState> {
  const supabase = await getSupabase();
  const clubId = await activeClub();
  if (!clubId) return { error: "Tu sesión expiró. Inicia sesión de nuevo." };
  const { data: existing } = await supabase
    .from("test_definitions")
    .select("name")
    .eq("club_id", clubId)
    .is("archived_at", null);
  const taken = new Set((existing ?? []).map((t) => (t.name as string).toLowerCase()));
  for (const t of SUGGESTED_TESTS) {
    if (taken.has(t.name.toLowerCase())) continue;
    const { error } = await supabase.rpc("create_test_definition", {
      p_club: clubId,
      p_name: t.name,
      p_unit: t.unit,
      p_higher_is_better: t.higher_is_better,
      p_display_format: t.display_format,
    });
    if (error) return { error: evaluationErrorMessage(error, "No pudimos agregar los tests. Intenta de nuevo.") };
  }
  return done();
}

// Test propio del plantel.
export async function createTest(_prev: EvalState, formData: FormData): Promise<EvalState> {
  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const better = String(formData.get("better") ?? "");
  const format = String(formData.get("format") ?? "number") as DisplayFormat;
  if (name.length < 2 || name.length > 60) return { error: "El nombre debe tener entre 2 y 60 caracteres." };
  if (format !== "number" && format !== "mmss") return { error: "Elige cómo se anota el resultado." };
  if (format === "number" && (unit.length < 1 || unit.length > 12)) {
    return { error: "Indica la unidad (hasta 12 caracteres), por ejemplo kg o cm." };
  }
  if (better !== "mas" && better !== "menos") return { error: "Elige si es mejor un valor más alto o más bajo." };

  const supabase = await getSupabase();
  const clubId = await activeClub();
  if (!clubId) return { error: "Tu sesión expiró. Inicia sesión de nuevo." };
  const { error } = await supabase.rpc("create_test_definition", {
    p_club: clubId,
    p_name: name,
    p_unit: format === "mmss" ? "mm:ss" : unit,
    p_higher_is_better: better === "mas",
    p_display_format: format,
  });
  if (error) {
    if (error.code === "23505") return { error: "Ya existe un test con ese nombre. Usa otro nombre." };
    return { error: evaluationErrorMessage(error, "No pudimos crear el test. Intenta de nuevo.") };
  }
  return done();
}

export async function archiveTest(testId: string): Promise<EvalState> {
  if (!isUuid(testId)) return { error: "Test no válido." };
  const supabase = await getSupabase();
  const { error } = await supabase.rpc("archive_test_definition", { p_test: testId });
  if (error) return { error: evaluationErrorMessage(error, "No pudimos archivar el test. Intenta de nuevo.") };
  return done();
}

// Guarda un lote de resultados: todo o nada (lo valida record_test_results).
export async function recordResults(_prev: EvalState, formData: FormData): Promise<EvalState> {
  const testId = String(formData.get("test_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const format = String(formData.get("format") ?? "number") as DisplayFormat;
  if (!isUuid(testId)) return { error: "Elige un test." };
  if (parseIsoDate(date) === null) return { error: "Elige una fecha válida." };

  const rows: { player_id: string; value: number }[] = [];
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("v:") || typeof raw !== "string" || !raw.trim()) continue;
    const playerId = key.slice(2);
    if (!isUuid(playerId)) continue;
    const value = parseValue(raw, format);
    if (value === null) {
      return { error: format === "mmss" ? "Revisa los tiempos: usa minutos y segundos, por ejemplo 4:35." : "Revisa los valores: usa solo números mayores que 0." };
    }
    rows.push({ player_id: playerId, value });
  }
  if (rows.length === 0) return { error: "Anota al menos un resultado." };
  if (rows.length > 100) return { error: "Guarda hasta 100 resultados a la vez." };

  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc("record_test_results", {
    p_test: testId,
    p_measured_on: date,
    p_results: rows,
  });
  if (error) return { error: evaluationErrorMessage(error, "No pudimos guardar los resultados. Intenta de nuevo.") };
  return done({ ok: true, saved: (data as number) ?? rows.length });
}

export async function voidResult(resultId: string): Promise<EvalState> {
  if (!isUuid(resultId)) return { error: "Resultado no válido." };
  const supabase = await getSupabase();
  const { error } = await supabase.rpc("void_test_result", { p_result: resultId });
  if (error) return { error: evaluationErrorMessage(error, "No pudimos anular el resultado. Intenta de nuevo.") };
  return done();
}
