// Planteles de la cuenta para el selector del encabezado (ClubHeader).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MyProfile } from "@/lib/session";
import { clubLogoUrl } from "@/lib/club-logo";
import { ROLE_LABEL, type UserRole } from "@/lib/roles";

export type ClubOption = {
  clubId: string;
  name: string;
  logoUrl: string | null;
  // Rol en ese plantel ("Head coach", "Jugador"…); vacío si está pendiente.
  roleLabel: string;
  active: boolean;
  pending: boolean;
};

// Solo los planteles confirmados o pendientes (los rechazados no se muestran).
export function clubOptions(supabase: SupabaseClient, profile: MyProfile): ClubOption[] {
  return profile.memberships
    .filter((m) => m.status === "confirmado" || m.status === "pendiente")
    .map((m) => ({
      clubId: m.club_id,
      name: m.club?.name ?? "Plantel",
      logoUrl: clubLogoUrl(supabase, m.club?.logo_path),
      roleLabel: (m.roles as UserRole[]).map((r) => ROLE_LABEL[r]).filter(Boolean).join(", "),
      active: m.club_id === profile.club_id && profile.status === "confirmado",
      pending: m.status === "pendiente",
    }));
}
