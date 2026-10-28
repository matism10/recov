import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveClubId, getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { ROLE_LABEL, isDirection, type UserRole } from "@/lib/roles";
import { textButton } from "@/app/ui";
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
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-8">
        <Link href="/configuracion" className={textButton}>
          ← Volver a configuración
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Grupo Sevens</h1>
        <p className="mt-1 text-sm text-muted">
          Quienes están en el grupo ven el selector Rugby 15 | Sevens y, en Sevens, el plantel es
          este grupo. Si alguien sale, conserva su posición de Sevens por si vuelve.
        </p>
      </header>
      <SevensGroupForm
        candidates={candidates}
        selected={((group ?? []) as { member_id: string }[]).map((g) => g.member_id)}
      />
    </main>
  );
}
