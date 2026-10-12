import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import {
  AVAILABILITY_LABEL,
  AVAILABILITY_STYLE,
  ROLE_LABEL,
  INJURED_AVAILABILITY,
  canManageInjuries,
  isDirection,
  isStaff,
  type Availability,
  type UserRole,
} from "@/lib/roles";
import {
  INJURY_STATUS_LABEL,
  INJURY_STATUS_STYLE,
  formatDate,
  returnLabel,
  type InjuryStatus,
} from "@/lib/injuries";
import { InjuryProgress } from "@/app/lesiones/injury-progress";
import { AvailabilitySelect } from "./availability-select";

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
    .select("full_name, roles, status, clubs!profiles_club_id_fkey(name, kine_delegate_id)")
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
  // Kinesiólogo, delegado y head coach: cambian disponibilidad y gestionan lesiones.
  // Solo decide qué se muestra; las funciones de la base validan el permiso real.
  const canManage = canManageInjuries(roles, user.id, club?.kine_delegate_id);

  // RLS: solo la dirección ve perfiles pendientes; para el resto el conteo es 0.
  let pendingCount = 0;
  if (isDirection(roles)) {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendiente");
    pendingCount = count ?? 0;
  }

  const staff = isStaff(roles);
  const isPlayer = roles.includes("jugador");

  // "Lesiones activas" (staff): jugadores en Lesionado o Reintegro, con la fecha
  // de regreso de su lesión abierta. RLS: el staff ve las lesiones del club.
  const injuredPlayers = (players ?? []).filter((p) =>
    (INJURED_AVAILABILITY as readonly string[]).includes(p.availability),
  );
  const returnByPlayer = new Map<string, string | null>();
  if (staff && injuredPlayers.length > 0) {
    const { data: open } = await supabase
      .from("injuries")
      .select("player_id, expected_return_on")
      .in("status", ["en_evaluacion", "activa"])
      .in(
        "player_id",
        injuredPlayers.map((p) => p.id),
      );
    // Si tiene más de una lesión abierta, manda la que termina más tarde.
    for (const i of open ?? []) {
      const current = returnByPlayer.get(i.player_id);
      if (!current || (i.expected_return_on && i.expected_return_on > current)) {
        returnByPlayer.set(i.player_id, i.expected_return_on);
      }
    }
  }

  // "Mis lesiones" (jugador). RLS: el jugador ve solo las suyas; se filtra por
  // si además es staff.
  let injuries = null;
  if (isPlayer) {
    ({ data: injuries } = await supabase
      .from("injuries")
      .select("id, type, status, started_on, expected_return_on, players!inner(user_id)")
      .eq("players.user_id", user.id)
      .order("started_on", { ascending: false }));
  }

  // Bandeja "Por revisar": lesiones esperando el diagnóstico del jugador y
  // diagnósticos que el jugador ya subió y nadie ha revisado.
  let toReview: {
    id: string;
    type: string;
    status: string;
    started_on: string;
    players: { full_name: string } | { full_name: string }[] | null;
  }[] = [];
  if (canManage) {
    const { data } = await supabase
      .from("injuries")
      .select("id, type, status, started_on, players(full_name)")
      .or("status.eq.en_evaluacion,and(status.eq.activa,reviewed_at.is.null)")
      .order("started_on");
    toReview = data ?? [];
  }
  const awaitingDiagnosis = toReview.filter((i) => i.status === "en_evaluacion");
  const diagnosisToReview = toReview.filter((i) => i.status === "activa");

  // RLS: el jugador ve solo sus lesiones; se filtra por si además es staff.
  let myPendingInjury: { id: string } | null = null;
  if (isPlayer) {
    const { data } = await supabase
      .from("injuries")
      .select("id, players!inner(user_id)")
      .eq("status", "en_evaluacion")
      .eq("players.user_id", user.id)
      .limit(1)
      .maybeSingle();
    myPendingInjury = data;
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

      {myPendingInjury && (
        <Link
          href={`/lesiones/${myPendingInjury.id}/completar`}
          className="mb-8 block rounded-2xl bg-sky-50 p-5 ring-1 ring-sky-200 transition hover:bg-sky-100"
        >
          <p className="font-medium text-sky-900">
            Tienes una lesión en evaluación: sube tu diagnóstico
          </p>
          <p className="mt-1 text-sm text-sky-800">
            Agrega lo que te indicó el médico y tus documentos para que el kinesiólogo
            la revise.
          </p>
        </Link>
      )}

      {canManage && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium text-slate-500">
              Por revisar
              {toReview.length > 0 && (
                <span className="ml-1.5 inline-block rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-800">
                  {toReview.length}
                </span>
              )}
            </h2>
          </div>
          {toReview.length > 0 ? (
            <div className="space-y-3">
              {[
                { title: "Diagnóstico por revisar", items: diagnosisToReview },
                { title: "Esperando el diagnóstico del jugador", items: awaitingDiagnosis },
              ]
                .filter((group) => group.items.length > 0)
                .map((group) => (
                  <div key={group.title}>
                    <h3 className="mb-2 text-xs font-medium tracking-wide text-slate-400 uppercase">
                      {group.title} ({group.items.length})
                    </h3>
                    <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
                      {group.items.map((i) => {
                        const player = Array.isArray(i.players) ? i.players[0] : i.players;
                        return (
                          <li key={i.id}>
                            <Link
                              href={`/lesiones/${i.id}`}
                              className="flex items-center justify-between gap-4 px-5 py-3 transition hover:bg-slate-50"
                            >
                              <div>
                                <p className="font-medium text-slate-900">
                                  {player ? `${player.full_name} · ${i.type}` : i.type}
                                </p>
                                <p className="text-sm text-slate-500">
                                  Desde el {formatDate(i.started_on)}
                                </p>
                              </div>
                              <span className="text-sm font-medium text-emerald-700">
                                Revisar
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-white p-5 text-sm text-slate-500 ring-1 ring-slate-200">
              No hay lesiones por revisar.
            </p>
          )}
        </section>
      )}

      {staff && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-slate-500">Lesiones activas</h2>
          {injuredPlayers.length > 0 ? (
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
              {injuredPlayers.map((p) => {
                const status = p.availability as Availability;
                return (
                  <li key={p.id}>
                    <Link
                      href={`/jugadores/${p.id}`}
                      className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-50"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{p.full_name}</p>
                        <p className="text-sm text-slate-500">
                          {returnLabel(returnByPlayer.get(p.id) ?? null)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${AVAILABILITY_STYLE[status]}`}
                      >
                        {AVAILABILITY_LABEL[status]}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-2xl bg-white p-5 text-sm text-slate-500 ring-1 ring-slate-200">
              No hay jugadores lesionados ni en reintegro.
            </p>
          )}
        </section>
      )}

      {isPlayer && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium text-slate-500">Mis lesiones</h2>
            <Link
              href="/registrar-lesion"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Registrar lesión
            </Link>
          </div>
          {injuries && injuries.length > 0 ? (
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
              {injuries.map((i) => {
                return (
                  <li key={i.id}>
                    <Link
                      href={`/lesiones/${i.id}`}
                      className="block space-y-2 px-5 py-4 transition hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-slate-900">{i.type}</p>
                          <p className="text-sm text-slate-500">
                            Desde el {formatDate(i.started_on)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${INJURY_STATUS_STYLE[i.status as InjuryStatus]}`}
                        >
                          {INJURY_STATUS_LABEL[i.status as InjuryStatus]}
                        </span>
                      </div>
                      {i.status !== "en_evaluacion" && (
                        <InjuryProgress
                          startedOn={i.started_on}
                          expectedReturnOn={i.expected_return_on}
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-2xl bg-white p-5 text-sm text-slate-500 ring-1 ring-slate-200">
              No has registrado lesiones.
            </p>
          )}
        </section>
      )}

      <h2 className="mb-3 text-sm font-medium text-slate-500">Plantel</h2>
      {players && players.length > 0 ? (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          {players.map((p) => {
            const status = p.availability as Availability;
            return (
              <li
                key={p.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div>
                  <p className="font-medium text-slate-900">{p.full_name}</p>
                  {p.position && (
                    <p className="text-sm text-slate-500">{p.position}</p>
                  )}
                </div>
                {/* "En revisión" no se cambia a mano: lo resuelve la revisión de la lesión. */}
                {canManage && status !== "en_revision" ? (
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <AvailabilitySelect
                      playerId={p.id}
                      playerName={p.full_name}
                      value={status}
                    />
                    <Link
                      href={`/lesiones/marcar/${p.id}`}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Marcar lesionado
                    </Link>
                  </div>
                ) : (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${AVAILABILITY_STYLE[status]}`}
                  >
                    {AVAILABILITY_LABEL[status]}
                  </span>
                )}
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
