"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MANUAL_AVAILABILITY, type ManualAvailability } from "@/lib/roles";
import {
  MAX_PHASES,
  PHASE_NAME_MAX,
  PHASE_NAME_MIN,
  SEVERITY_LABEL,
  addDays,
  parseIsoDate,
  type InjurySeverity,
  type PhaseDraft,
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

export type PhasesState = { ok?: boolean; error?: string };

const PHASE_STATUSES = ["pendiente", "en_curso", "completada"];

function parsePhases(raw: string): PhaseDraft[] | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return null;
    const phases: PhaseDraft[] = [];
    for (const p of value) {
      if (
        typeof p?.name !== "string" ||
        !PHASE_STATUSES.includes(p?.status) ||
        typeof p?.started_on !== "string" ||
        typeof p?.ended_on !== "string" ||
        (p.id !== undefined && (typeof p.id !== "string" || !UUID_RE.test(p.id)))
      ) {
        return null;
      }
      phases.push({
        id: p.id,
        name: p.name.trim(),
        status: p.status,
        started_on: p.started_on,
        ended_on: p.ended_on,
      });
    }
    return phases;
  } catch {
    return null;
  }
}

// Guarda la lista de fases. set_injury_phases verifica el permiso (kinesiólogo,
// delegado o head coach), que la lesión esté activa y el orden de los estados;
// las fases que se quitan quedan marcadas, no se borran.
export async function savePhases(
  _prevState: PhasesState,
  formData: FormData,
): Promise<PhasesState> {
  const id = String(formData.get("injury_id") ?? "");
  const phases = parsePhases(String(formData.get("phases") ?? ""));

  if (!UUID_RE.test(id)) return { error: "Lesión no válida." };
  if (!phases || phases.length < 1 || phases.length > MAX_PHASES) {
    return { error: `Define entre 1 y ${MAX_PHASES} fases.` };
  }
  for (const p of phases) {
    if (p.name.length < PHASE_NAME_MIN || p.name.length > PHASE_NAME_MAX) {
      return {
        error: `Cada fase necesita un nombre (${PHASE_NAME_MIN} a ${PHASE_NAME_MAX} caracteres).`,
      };
    }
    for (const d of [p.started_on, p.ended_on]) {
      if (d && parseIsoDate(d) === null) return { error: "Una de las fechas no es válida." };
    }
    if (p.started_on && p.ended_on && p.ended_on < p.started_on) {
      return { error: `“${p.name}” no puede terminar antes de empezar.` };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_injury_phases", {
    p_injury_id: id,
    p_phases: phases.map((p) => ({
      ...(p.id ? { id: p.id } : {}),
      name: p.name,
      status: p.status,
      started_on: p.started_on || null,
      ended_on: p.ended_on || null,
    })),
  });
  if (error) {
    return {
      error:
        error.code === "P0001" ? error.message : "No se pudieron guardar las fases.",
    };
  }

  revalidatePath(`/lesiones/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

// Completa la fase en curso e inicia la siguiente (advance_injury_phase).
export async function advancePhase(
  _prevState: PhasesState,
  formData: FormData,
): Promise<PhasesState> {
  const id = String(formData.get("injury_id") ?? "");
  if (!UUID_RE.test(id)) return { error: "Lesión no válida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("advance_injury_phase", { p_injury_id: id });
  if (error) {
    return {
      error: error.code === "P0001" ? error.message : "No se pudo avanzar la fase.",
    };
  }

  revalidatePath(`/lesiones/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
