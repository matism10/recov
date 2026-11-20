import { redirect } from "next/navigation";
import { getActiveClubId, getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { ROLE_LABEL, isDirection, type UserRole } from "@/lib/roles";
import { PageHeader } from "@/app/ui-blocks";
import { SevensGroupForm, type GroupCandidate } from "./group-form";

type MemberRow = {
  user_id: string;
  roles: UserRole[] | null;
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
};

// Grupo Sevens: la dirección elige qué jugadores y staff del plantel están en Sevens.
// Solo cuentas confirmadas (set_sevens_group lo valida); un jugador sin cuenta no entra.
export default async function SevensGroupPage() {
  const supabase = await getSupabase();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const clubId = await getActiveClubId(user.id);
  const [me, { data: members }, { data: group }] = await Promise.all([
    getProfile(user.id),
    supabase
      .from("club_members")
      .select("user_id, roles, profiles!club_members_user_id_fkey(full_name)")
      .eq("club_id", clubId)
      .eq("status", "confirmado"),
    supabase.from("sevens_group").select("member_id").eq("club_id", clubId).is("archived_at", null),
  ]);

  if (me?.status === "pendiente") redirect("/pendiente");
  if (!me || me.status !== "confirmado" || !isDirection((me.roles ?? []) as UserRole[])) {
    redirect("/dashboard");
  }
  if (me.club?.sport !== "rugby" || !me.club.has_sevens) redirect("/configuracion");

  const candidates: GroupCandidate[] = ((members ?? []) as MemberRow[])
    .map((m) => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      const roles = m.roles ?? [];
      return {
        id: m.user_id,
        name: profile?.full_name ?? "Sin nombre",
        player: roles.includes("jugador"),
        roleLabel: roles.filter((r) => r !== "jugador").map((r) => ROLE_LABEL[r]).join(", "),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 lg:max-w-[1080px] lg:px-8 lg:py-10">
      <PageHeader
        title="Grupo Sevens"
        back={{ fallback: "/configuracion", label: "← Volver a configuración" }}
        description="Quienes están en el grupo ven el selector Rugby 15 | Sevens y, en Sevens, el plantel es este grupo. Si alguien sale, conserva su posición de Sevens por si vuelve."
      />
      <SevensGroupForm
        candidates={candidates}
        selected={((group ?? []) as { member_id: string }[]).map((g) => g.member_id)}
      />
    </main>
  );
}
