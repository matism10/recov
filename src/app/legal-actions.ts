"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LEGAL_VERSION } from "@/lib/legal/content";

export type LegalState = { error?: string };

function safeNext(value: FormDataEntryValue | null): string | null {
  const v = String(value ?? "");
  return v.startsWith("/") && !v.startsWith("//") ? v : null;
}

// Cuentas existentes: acepta la versión vigente de los términos y la privacidad.
export async function acceptTermsAction(_prev: LegalState, formData: FormData): Promise<LegalState> {
  if (formData.get("consent") !== "on") return { error: "Marca la casilla para continuar." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_terms", { p_version: LEGAL_VERSION });
  if (error) return { error: "No pudimos guardar tu aceptación. Intenta de nuevo." };
  revalidatePath("/", "layout");
  const next = safeNext(formData.get("next"));
  if (next) redirect(next);
  return {};
}

// Head coach y manager: declaración de autorización de apoderados del plantel activo.
export async function declareGuardianAction(_prev: LegalState, formData: FormData): Promise<LegalState> {
  if (formData.get("consent") !== "on") return { error: "Marca la casilla para continuar." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("declare_guardian_authorization");
  if (error) return { error: "No pudimos guardar la declaración. Intenta de nuevo." };
  revalidatePath("/", "layout");
  return {};
}
