"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SEVERITY_LABEL, addDays, parseIsoDate } from "@/lib/injuries";

export type ReviewInjuryState = { ok?: boolean; error?: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Tope razonable para la fecha de alta, contado desde la lesión.
const MAX_RECOVERY_DAYS = 3 * 365;

export async function reviewInjury(
  _prevState: ReviewInjuryState,
  formData: FormData,
): Promise<ReviewInjuryState> {
  const id = String(formData.get("injury_id") ?? "");
  const expectedReturnOn = String(formData.get("expected_return_on") ?? "");
  const severity = String(formData.get("severity") ?? "");
  const markReviewed = formData.get("mark_reviewed") === "on";

  if (!UUID_RE.test(id)) return { error: "Lesión no válida." };
  if (severity && !(severity in SEVERITY_LABEL)) {
    return { error: "Gravedad no válida." };
  }
  if (parseIsoDate(expectedReturnOn) === null) {
    return { error: "Ingresa una fecha estimada de alta válida." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión expiró. Vuelve a ingresar." };

  const { data: injury } = await supabase
    .from("injuries")
    .select("started_on, reviewed_at")
    .eq("id", id)
    .maybeSingle();
  if (!injury) return { error: "Lesión no encontrada." };

  if (
    expectedReturnOn <= injury.started_on ||
    expectedReturnOn > addDays(injury.started_on, MAX_RECOVERY_DAYS)
  ) {
    return {
      error: "La fecha de alta debe ser posterior a la lesión y dentro de 3 años.",
    };
  }

  // Lo que indicó el médico (doctor_estimate_*) no se modifica.
  const changes: Record<string, string | null> = {
    expected_return_on: expectedReturnOn,
    severity: severity || null,
  };
  if (markReviewed && !injury.reviewed_at) {
    changes.reviewed_by = user.id;
    changes.reviewed_at = new Date().toISOString();
  }

  // RLS (injuries_write): solo el kinesiólogo o su delegado. Si no tiene
  // permiso, el update no afecta filas en vez de dar error.
  const { data: updated, error } = await supabase
    .from("injuries")
    .update(changes)
    .eq("id", id)
    .select("id");

  if (error) return { error: "No se pudieron guardar los cambios. Intenta de nuevo." };
  if (!updated || updated.length === 0) {
    return { error: "No tienes permiso para editar esta lesión." };
  }

  revalidatePath(`/lesiones/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
