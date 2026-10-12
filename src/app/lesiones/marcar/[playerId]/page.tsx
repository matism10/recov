import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canManageInjuries, type UserRole } from "@/lib/roles";
import { MarkForm } from "../mark-form";

export default async function MarkInjuredPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Desde 0005 hay dos relaciones profiles–clubs: hay que nombrar la FK.
  const { data: me } = await supabase
    .from("profiles")
    .select("roles, status, clubs!profiles_club_id_fkey(kine_delegate_id)")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.status === "pendiente") redirect("/pendiente");
  const club = Array.isArray(me?.clubs) ? me.clubs[0] : me?.clubs;
  if (
    me?.status !== "confirmado" ||
    !canManageInjuries((me.roles ?? []) as UserRole[], user.id, club?.kine_delegate_id)
  ) {
    redirect("/dashboard");
  }

  // RLS: solo jugadores del club; la dirección también ve pendientes, se filtran.
  const { data: player } = await supabase
    .from("players")
    .select("id, full_name, position")
    .eq("id", playerId)
    .eq("status", "confirmado")
    .maybeSingle();
  if (!player) redirect("/dashboard");

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <header className="mb-6">
        <Link href="/dashboard" className="text-sm text-slate-500 underline">
          ← Volver
        </Link>
        <p className="mt-2 text-sm text-slate-500">
          {player.full_name}
          {player.position && ` · ${player.position}`}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Marcar lesionado</h1>
        <p className="mt-1 text-sm text-slate-500">
          El jugador quedará “En revisión” hasta que el kinesiólogo revise la lesión.
        </p>
      </header>
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <MarkForm playerId={player.id} />
      </div>
    </main>
  );
}
