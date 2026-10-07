import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import {
  AVAILABILITY_LABEL,
  AVAILABILITY_STYLE,
  ROLE_LABEL,
  isDirection,
  type Availability,
  type UserRole,
} from "@/lib/roles";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS: solo devuelve el perfil y el club del propio usuario.
  // Desde 0005 hay dos relaciones profiles–clubs (club_id y kine_delegate_id):
  // hay que nombrar la FK o PostgREST responde PGRST201 y profile queda null.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, roles, status, clubs!profiles_club_id_fkey(name)")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.status === "pendiente") redirect("/pendiente");

  // Sin perfil o rechazado: no tiene acceso a los datos del club.
  if (!profile || profile.status !== "confirmado") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-semibold text-slate-900">
          Tu cuenta aún no está asociada a un club
        </h1>
        <p className="max-w-md text-slate-500">
          Pide a la dirección de tu club que te agregue a Recov.
        </p>
        <form action={signOut}>
          <button className="text-sm text-slate-500 underline">
            Cerrar sesión
          </button>
        </form>
      </main>
    );
  }

  // RLS: solo jugadores del club del usuario. La dirección también ve los
  // pendientes, así que se filtra el plantel confirmado.
  const { data: players } = await supabase
    .from("players")
    .select("id, full_name, position, availability")
    .eq("active", true)
    .eq("status", "confirmado")
    .order("full_name");

  const club = Array.isArray(profile.clubs) ? profile.clubs[0] : profile.clubs;
  const roles = (profile.roles ?? []) as UserRole[];

  // RLS: solo la dirección ve perfiles pendientes; para el resto el conteo es 0.
  let pendingCount = 0;
  if (isDirection(roles)) {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendiente");
    pendingCount = count ?? 0;
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{club?.name}</p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Disponibilidad del plantel
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {profile.full_name} · {roles.map((r) => ROLE_LABEL[r]).join(", ")}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {isDirection(roles) && (
            <Link
              href="/registros"
              className="text-sm font-medium text-emerald-700 underline"
            >
              Registros pendientes
              {pendingCount > 0 && (
                <span className="ml-1.5 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                  {pendingCount}
                </span>
              )}
            </Link>
          )}
          <form action={signOut}>
            <button className="text-sm text-slate-500 underline">
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>

      {players && players.length > 0 ? (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          {players.map((p) => {
            const status = p.availability as Availability;
            return (
              <li
                key={p.id}
                className="flex items-center justify-between px-5 py-4"
              >
                <div>
                  <p className="font-medium text-slate-900">{p.full_name}</p>
                  {p.position && (
                    <p className="text-sm text-slate-500">{p.position}</p>
                  )}
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${AVAILABILITY_STYLE[status]}`}
                >
                  {AVAILABILITY_LABEL[status]}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl bg-white p-8 text-center text-slate-500 ring-1 ring-slate-200">
          Aún no hay jugadores registrados en tu club.
        </p>
      )}
    </main>
  );
}
