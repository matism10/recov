import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile, getSessionUser, getSupabase } from "@/lib/session";
import type { UserRole } from "@/lib/roles";
import { InjuryForm } from "./injury-form";
import { textButton } from "@/app/ui";

export default async function ReportInjuryPage() {
  const supabase = await getSupabase();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // En paralelo: perfil y ficha propia (RLS: el jugador confirmado ve la suya).
  const [me, { data: player }] = await Promise.all([
    getProfile(user.id),
    supabase.from("players").select("id, club_id").eq("user_id", user.id).maybeSingle(),
  ]);

  if (me?.status === "pendiente") redirect("/pendiente");
  if (me?.status !== "confirmado" || !((me.roles ?? []) as UserRole[]).includes("jugador")) {
    redirect("/dashboard");
  }
  if (!player) redirect("/dashboard");

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <header className="mb-6">
        <Link href="/dashboard" className={textButton}>
          ← Volver
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink">
          Registrar lesión
        </h1>
        <p className="mt-1 text-sm text-muted">
          El kinesiólogo del club revisará tu reporte y tus documentos.
        </p>
      </header>
      <div className="rounded-xl bg-mist p-6 border border-line">
        <InjuryForm clubId={player.club_id} playerId={player.id} />
      </div>
    </main>
  );
}
