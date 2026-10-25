import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveClubId, getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { canManageInjuries, type UserRole } from "@/lib/roles";
import { MarkForm } from "../mark-form";
import { textButton } from "@/app/ui";

export default async function MarkInjuredPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  const supabase = await getSupabase();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // En paralelo: perfil (con el delegado del club) y el jugador. RLS: solo jugadores
  // del club; la dirección también ve pendientes, se filtran.
  const clubId = await getActiveClubId(user.id);
  const [me, { data: player }] = await Promise.all([
    getProfile(user.id),
    supabase
      .from("players")
      .select("id, full_name, position")
      .eq("id", playerId)
      .eq("club_id", clubId)
      .eq("status", "confirmado")
      .maybeSingle(),
  ]);

  if (me?.status === "pendiente") redirect("/pendiente");
  if (
    !me ||
    me.status !== "confirmado" ||
    !canManageInjuries((me.roles ?? []) as UserRole[], user.id, me.club?.kine_delegate_id)
  ) {
    redirect("/dashboard");
  }
  if (!player) redirect("/dashboard");

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <header className="mb-6">
        <Link href="/dashboard" className={textButton}>
          ← Volver
        </Link>
        <p className="mt-2 text-sm text-muted">
          {player.full_name}
          {player.position && ` · ${player.position}`}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">Marcar lesionado</h1>
        <p className="mt-1 text-sm text-muted">
          El jugador quedará “En revisión” hasta que el kinesiólogo revise la lesión.
        </p>
      </header>
      <div className="rounded-xl bg-mist p-6 border border-line">
        <MarkForm playerId={player.id} />
      </div>
    </main>
  );
}
