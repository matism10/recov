import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canManageInjuries, isStaff, type UserRole } from "@/lib/roles";
import { getSquad } from "@/lib/squad";
import { Squad } from "@/app/dashboard/squad";
import { cardClass, textButton } from "@/app/ui";

// Plantel completo del club: los mismos datos, acciones y reglas por rol que la
// lista del Resumen, pero con todos los jugadores confirmados.
export default async function SquadPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Desde 0005 hay dos relaciones profiles–clubs: hay que nombrar la FK.
  const { data: profile } = await supabase
    .from("profiles")
    .select("roles, status, clubs!profiles_club_id_fkey(name, kine_delegate_id)")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.status === "pendiente") redirect("/pendiente");
  if (profile?.status !== "confirmado") redirect("/dashboard");

  const club = Array.isArray(profile.clubs) ? profile.clubs[0] : profile.clubs;
  const roles = (profile.roles ?? []) as UserRole[];
  // Solo decide qué se muestra; las funciones de la base validan el permiso real.
  const canManage = canManageInjuries(roles, user.id, club?.kine_delegate_id);
  const { players, avatarUrls, phaseByPlayer } = await getSquad(supabase);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:max-w-6xl lg:px-8">
      <header className="mb-8">
        <Link href="/dashboard" className={textButton}>
          ← Volver al resumen
        </Link>
        <p className="mt-2 text-sm text-muted">{club?.name}</p>
        <h1 className="text-2xl font-semibold text-ink">Plantel</h1>
        <p className="mt-1 text-sm text-muted">
          {players.length === 1 ? "1 jugador" : `${players.length} jugadores`}
        </p>
      </header>

      {players.length > 0 ? (
        <Squad
          players={players}
          avatarUrls={avatarUrls}
          phaseByPlayer={phaseByPlayer}
          canManage={canManage}
          linkToProfile={isStaff(roles)}
        />
      ) : (
        <p className={`p-8 text-center text-muted ${cardClass}`}>
          Aún no hay jugadores registrados en tu club.
        </p>
      )}
    </main>
  );
}
