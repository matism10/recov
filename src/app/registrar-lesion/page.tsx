import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/roles";
import { InjuryForm } from "./injury-form";

export default async function ReportInjuryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("roles, status")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.status === "pendiente") redirect("/pendiente");
  if (me?.status !== "confirmado" || !((me.roles ?? []) as UserRole[]).includes("jugador")) {
    redirect("/dashboard");
  }

  // RLS: el jugador confirmado ve su propia ficha del plantel.
  const { data: player } = await supabase
    .from("players")
    .select("id, club_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!player) redirect("/dashboard");

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <header className="mb-6">
        <Link href="/dashboard" className="text-sm text-slate-500 underline">
          ← Volver
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Registrar lesión
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          El kinesiólogo del club revisará tu reporte y tus documentos.
        </p>
      </header>
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <InjuryForm clubId={player.club_id} playerId={player.id} />
      </div>
    </main>
  );
}
