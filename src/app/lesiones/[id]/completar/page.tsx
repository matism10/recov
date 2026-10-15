import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/roles";
import { formatDate } from "@/lib/injuries";
import { InjuryForm } from "@/app/registrar-lesion/injury-form";
import { textButton } from "@/app/ui";

export default async function CompleteInjuryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
    redirect(`/lesiones/${id}`);
  }

  const { data: player } = await supabase
    .from("players")
    .select("id, club_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!player) redirect("/dashboard");

  // RLS: el jugador ve solo sus propias lesiones.
  const { data: injury } = await supabase
    .from("injuries")
    .select("id, type, status, started_on, player_id")
    .eq("id", id)
    .maybeSingle();
  if (!injury) notFound();
  if (injury.status !== "en_evaluacion" || injury.player_id !== player.id) {
    redirect(`/lesiones/${id}`);
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <header className="mb-6">
        <Link href={`/lesiones/${id}`} className={textButton}>
          ← Volver
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink">
          Sube tu diagnóstico
        </h1>
        <p className="mt-1 text-sm text-muted">
          El cuerpo médico registró “{injury.type}” el {formatDate(injury.started_on)}.
          Completa lo que te indicó el médico para que el kinesiólogo lo revise.
        </p>
      </header>
      <div className="rounded-xl bg-mist p-6 border border-line">
        <InjuryForm clubId={player.club_id} playerId={player.id} injuryId={injury.id} />
      </div>
    </main>
  );
}
