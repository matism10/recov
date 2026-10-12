"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MANUAL_AVAILABILITY, type ManualAvailability } from "@/lib/roles";
import {
  SEVERITY_LABEL,
  addDays,
  parseIsoDate,
  type InjurySeverity,
} from "@/lib/injuries";

export type ReviewInjuryState = { ok?: boolean; error?: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Tope razonable para la fecha de alta, contado desde la lesión.
const MAX_RECOVERY_DAYS = 3 * 365;
const DECISIONS = ["confirmar", "descartar", "cerrar"] as const;
type Decision = (typeof DECISIONS)[number];

// Confirmar, descartar o dar de alta. review_injury verifica el permiso
// (kinesiólogo, delegado o head coach), el estado de la lesión y actualiza la
// disponibilidad del jugador en la misma transacción.
export async function reviewInjury(
  _prevState: ReviewInjuryState,
  formData: FormData,
): Promise<ReviewInjuryState> {
  const id = String(formData.get("injury_id") ?? "");
  const decision = String(formData.get("decision") ?? "") as Decision;

  if (!UUID_RE.test(id)) return { error: "Lesión no válida." };
  if (!DECISIONS.includes(decision)) return { error: "Acción no válida." };

  const supabase = await createClient();
  let params: Record<string, string> = {};

  if (decision === "confirmar") {
    const severity = String(formData.get("severity") ?? "");
    const expectedReturnOn = String(formData.get("expected_return_on") ?? "");
    const availability = String(formData.get("availability") ?? "");

    if (!(severity in SEVERITY_LABEL)) return { error: "Indica la gravedad." };
    if (!MANUAL_AVAILABILITY.includes(availability as ManualAvailability)) {
      return { error: "Indica la disponibilidad del jugador." };
    }
    if (parseIsoDate(expectedReturnOn) === null) {
      return { error: "Ingresa una fecha estimada de alta válida." };
    }

    const { data: injury } = await supabase
      .from("injuries")
      .select("started_on")
      .eq("id", id)
      .maybeSingle();
    if (!injury) return { error: "Lesión no encontrada." };
    if (
      expectedReturnOn < injury.started_on ||
      expectedReturnOn > addDays(injury.started_on, MAX_RECOVERY_DAYS)
    ) {
      return {
        error: "La fecha de alta no puede ser anterior a la lesión ni a más de 3 años.",
      };
    }

    params = {
      p_severity: severity as InjurySeverity,
      p_expected_return_on: expectedReturnOn,
      p_availability: availability as ManualAvailability,
    };
  }

  const { error } = await supabase.rpc("review_injury", {
    p_injury_id: id,
    p_decision: decision,
    ...params,
  });

  if (error) {
    // P0001: excepción propia de review_injury, con mensaje en español.
    return {
      error:
        error.code === "P0001"
          ? error.message
          : "No se pudieron guardar los cambios. Intenta de nuevo.",
    };
  }

  revalidatePath(`/lesiones/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
