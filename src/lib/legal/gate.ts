// Qué pantalla legal bloqueante corresponde a la cuenta (null = ninguna). Se calcula con
// el perfil que ya trae getProfile: sin consultas nuevas.
import { can } from "@/lib/permissions";
import type { MyProfile } from "@/lib/session";
import { LEGAL_VERSION } from "./content";

export type PendingLegal = "terms" | "guardian";

// Rutas que siguen abiertas aunque haya algo pendiente (los textos legales, la propia
// pantalla de aceptación y el acceso a la cuenta).
const EXEMPT_PREFIXES = ["/terminos", "/privacidad", "/aceptar-terminos", "/login", "/recuperar", "/restablecer", "/inicio"];

export function isLegalExempt(pathname: string): boolean {
  return EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function pendingLegal(
  profile: Pick<MyProfile, "terms_accepted_at" | "terms_version" | "status" | "roles" | "club">,
): PendingLegal | null {
  if (!profile.terms_accepted_at || profile.terms_version !== LEGAL_VERSION) return "terms";
  if (
    profile.status === "confirmado" &&
    profile.club &&
    profile.club.guardian_declared_at == null &&
    can(profile.roles ?? [], "staff_gestionar")
  ) {
    return "guardian";
  }
  return null;
}
