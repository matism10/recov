import { redirect } from "next/navigation";
import { getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { canManageInjuries, isStaff, type UserRole } from "@/lib/roles";
import { getSquad } from "@/lib/squad";
import { SquadViews } from "./squad-views";
import { PageTitle, cardClass } from "@/app/ui";

// Plantel completo del club: los mismos datos, acciones y reglas por rol que la
// lista del Resumen, pero con todos los jugadores confirmados, con búsqueda y
// filtros por posición y disponibilidad, o en una cancha con sus posiciones.
export default async function SquadPage() {
  const supabase = await getSupabase();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // En paralelo: el perfil (y con su deporte, el orden de las posiciones para el
  // filtro) y el plantel. RLS: sin perfil confirmado, el plantel llega vacío, y la
  // página redirige antes de mostrar nada.
  const [{ profile, positions }, { players, avatarUrls, phaseByPlayer }] = await Promise.all([
    getProfile(user.id).then(async (profile) => {
      if (profile?.status !== "confirmado") return { profile, positions: null };
      const { data: positions } = await supabase
        .from("positions")
        .select("name")
        .eq("sport", profile.club?.sport ?? "")
        .order("sort");
      return { profile, positions };
    }),
    getSquad(supabase),
  ]);

  if (profile?.status === "pendiente") redirect("/pendiente");
  if (!profile || profile.status !== "confirmado") redirect("/dashboard");

  const club = profile.club;
  const roles = (profile.roles ?? []) as UserRole[];
  // Solo decide qué se muestra; las funciones de la base validan el permiso real.
  const canManage = canManageInjuries(roles, user.id, club?.kine_delegate_id);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:max-w-6xl lg:px-8">
      <header className="mb-8">
        <PageTitle>
          Plantel
        </PageTitle>
        <p className="mt-1 text-sm text-muted">
          {players.length === 1 ? "1 jugador" : `${players.length} jugadores`}
        </p>
      </header>

      {players.length > 0 ? (
        <SquadViews
          sport={club?.sport ?? null}
          positions={(positions ?? []).map((p) => p.name as string)}
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
