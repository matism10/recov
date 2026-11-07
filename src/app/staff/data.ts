// Staff del plantel activo con sus permisos (lista y detalle de /staff).
import type { SupabaseClient } from "@supabase/supabase-js";
import { isStaff, type UserRole } from "@/lib/roles";
import type { Permission } from "@/lib/permissions";

export type StaffRow = {
  id: string;
  full_name: string | null;
  roles: UserRole[];
  isPrincipal: boolean;
  perms: Permission[];
  defaults: Permission[];
  overrides: Record<string, boolean>;
};

type MemberRow = {
  user_id: string;
  roles: UserRole[] | null;
  is_principal: boolean;
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
};

type PermRow = {
  user_id: string;
  is_principal: boolean;
  perms: Permission[];
  defaults: Permission[];
  overrides: Record<string, boolean>;
};

// RLS: la dirección ve el staff confirmado de su club; staff_permissions exige
// gestionar el staff (si falla, la lista sale sin permisos).
export async function loadStaff(supabase: SupabaseClient, clubId: string): Promise<StaffRow[]> {
  const [{ data: members }, { data: permRows }] = await Promise.all([
    supabase
      .from("club_members")
      .select("user_id, roles, is_principal, profiles!club_members_user_id_fkey(full_name)")
      .eq("club_id", clubId)
      .eq("status", "confirmado"),
    supabase.rpc("staff_permissions", { p_club_id: clubId }),
  ]);
  const byId = new Map(((permRows ?? []) as PermRow[]).map((r) => [r.user_id, r]));
  return ((members ?? []) as unknown as MemberRow[])
    .map((m): StaffRow => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      const p = byId.get(m.user_id);
      return {
        id: m.user_id,
        full_name: profile?.full_name ?? null,
        roles: m.roles ?? [],
        isPrincipal: m.is_principal,
        perms: p?.perms ?? [],
        defaults: p?.defaults ?? [],
        overrides: p?.overrides ?? {},
      };
    })
    .filter((p) => isStaff(p.roles))
    .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "es"));
}

// "co": head coach que no es el principal. "Personalizado": tiene ajustes vigentes.
export function isCoHeadCoach(p: StaffRow) {
  return p.roles.includes("head_coach") && !p.isPrincipal;
}
export function extraCount(p: StaffRow) {
  return p.perms.filter((k) => !p.defaults.includes(k)).length;
}
export function removedCount(p: StaffRow) {
  return p.defaults.filter((k) => !p.perms.includes(k)).length;
}
export function isCustomized(p: StaffRow) {
  return Object.keys(p.overrides).length > 0;
}
