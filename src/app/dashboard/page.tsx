import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import {
  ROLE_LABEL,
  INJURED_AVAILABILITY,
  canManageInjuries,
  isDirection,
  isStaff,
  type Availability,
  type UserRole,
} from "@/lib/roles";
import {
  formatDate,
  returnLabel,
  type InjuryStatus,
} from "@/lib/injuries";
import { InjuryProgress } from "@/app/lesiones/injury-progress";
import { Avatar } from "@/app/avatar";
import { getAvatarUrls } from "@/lib/avatars";
import {
  AvailabilityBadge,
  InjuryStatusBadge,
  buttonPrimary,
  buttonSecondary,
  cardClass,
  chipClass,
  textButton,
} from "@/app/ui";
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
        <h1 className="text-xl font-semibold text-ink">
          Tu cuenta aún no está asociada a un club
        </h1>
        <p className="max-w-md text-muted">
          Pide a la dirección de tu club que te agregue a Recov.
        </p>
        <form action={signOut}>
          <button className={textButton}>
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
    .select("id, full_name, position, availability, user_id")
    .eq("active", true)
    .eq("status", "confirmado")
    .order("full_name");
  // Foto de perfil de los jugadores con cuenta.
  const avatarUrls = await getAvatarUrls(
    supabase,
    (players ?? []).map((p) => p.user_id),
  );
  // Fase de recuperación en curso de cada jugador: solo el nombre, visible para
  // todo el club (los jugadores no ven el resto de la lesión de sus compañeros).
  const { data: currentPhases } = await supabase.rpc("squad_current_phases");
  const phaseByPlayer = new Map(
    ((currentPhases ?? []) as { player_id: string; phase_name: string }[]).map((p) => [
      p.player_id,
      p.phase_name,
    ]),
  );

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
          <p className="text-sm text-muted">{club?.name}</p>
          <h1 className="text-2xl font-semibold text-ink">
            Disponibilidad del plantel
          </h1>
          <p className="mt-1 text-sm text-muted">
            {profile.full_name} · {roles.map((r) => ROLE_LABEL[r]).join(", ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-4">
          {isDirection(roles) && (
            <Link
              href="/registros"
              className="inline-flex min-h-11 items-center text-sm font-medium text-brand-text underline"
            >
              Registros pendientes
              {pendingCount > 0 && (
                <span className={`ml-1.5 ${chipClass}`}>
                  {pendingCount}
                </span>
              )}
            </Link>
          )}
          {isDirection(roles) && (
            <Link
              href="/staff"
              className="inline-flex min-h-11 items-center text-sm font-medium text-brand-text underline"
            >
              Staff
            </Link>
          )}
          <form action={signOut}>
            <button className={textButton}>
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>

      {myPendingInjury && (
        <div className="mb-8 space-y-3 rounded-xl border border-brand-strong bg-brand-soft p-5">
          <div>
            <p className="font-medium text-ink">
              Tienes una lesión en evaluación: sube tu diagnóstico
            </p>
            <p className="mt-1 text-sm text-ink">
              Agrega lo que te indicó el médico y tus documentos para que el kinesiólogo
              la revise.
            </p>
          </div>
          <Link href={`/lesiones/${myPendingInjury.id}/completar`} className={buttonPrimary}>
            Sube tu diagnóstico
          </Link>
        </div>
      )}

      {canManage && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium text-muted">
              Por revisar
              {toReview.length > 0 && (
                <span className={`ml-1.5 ${chipClass}`}>
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
                    <h3 className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
                      {group.title} ({group.items.length})
                    </h3>
                    <ul className="divide-y divide-line overflow-hidden rounded-xl bg-mist border border-line">
                      {group.items.map((i) => {
                        const player = Array.isArray(i.players) ? i.players[0] : i.players;
                        return (
                          <li key={i.id}>
                            <Link
                              href={`/lesiones/${i.id}`}
                              className="flex items-center justify-between gap-4 px-5 py-3 transition hover:bg-white"
                            >
                              <div>
                                <p className="font-medium text-ink">
                                  {player ? `${player.full_name} · ${i.type}` : i.type}
                                </p>
                                <p className="text-sm text-muted">
                                  Desde el {formatDate(i.started_on)}
                                </p>
                              </div>
                              <span className="text-sm font-medium text-brand-text underline">
                                Revisa
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
            <p className={`p-5 text-sm text-muted ${cardClass}`}>
              No hay lesiones por revisar.
            </p>
          )}
        </section>
      )}

      {staff && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-muted">Lesiones activas</h2>
          {injuredPlayers.length > 0 ? (
            <ul className="divide-y divide-line overflow-hidden rounded-xl bg-mist border border-line">
              {injuredPlayers.map((p) => {
                const status = p.availability as Availability;
                return (
                  <li key={p.id}>
                    <Link
                      href={`/jugadores/${p.id}`}
                      className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-white"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={p.full_name} url={avatarUrls.get(p.user_id)} />
                        <div>
                          <p className="font-medium text-ink">{p.full_name}</p>
                          <p className="text-sm text-muted">
                            {returnLabel(returnByPlayer.get(p.id) ?? null)}
                          </p>
                        </div>
                      </div>
                      <AvailabilityBadge status={status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={`p-5 text-sm text-muted ${cardClass}`}>
              No hay jugadores lesionados ni en reintegro.
            </p>
          )}
        </section>
      )}

      {isPlayer && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium text-muted">Mis lesiones</h2>
            <Link
              href="/registrar-lesion"
              className={`text-sm ${buttonPrimary}`}
            >
              Registra una lesión
            </Link>
          </div>
          {injuries && injuries.length > 0 ? (
            <ul className="divide-y divide-line overflow-hidden rounded-xl bg-mist border border-line">
              {injuries.map((i) => {
                return (
                  <li key={i.id}>
                    <Link
                      href={`/lesiones/${i.id}`}
                      className="block space-y-2 px-5 py-4 transition hover:bg-white"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-ink">{i.type}</p>
                          <p className="text-sm text-muted">
                            Desde el {formatDate(i.started_on)}
                          </p>
                        </div>
                        <InjuryStatusBadge status={i.status as InjuryStatus} outline />
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
            <p className={`p-5 text-sm text-muted ${cardClass}`}>
              No has registrado lesiones.
            </p>
          )}
        </section>
      )}

      <h2 className="mb-3 text-sm font-medium text-muted">Plantel</h2>
      {players && players.length > 0 ? (
        <ul className="divide-y divide-line overflow-hidden rounded-xl bg-mist border border-line">
          {players.map((p) => {
            const status = p.availability as Availability;
            return (
              <li
                key={p.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={p.full_name} url={avatarUrls.get(p.user_id)} />
                  <div>
                    <p className="font-medium text-ink">{p.full_name}</p>
                    {(p.position || phaseByPlayer.has(p.id)) && (
                      <p className="text-sm text-muted">
                        {[p.position, phaseByPlayer.has(p.id) && `Fase: ${phaseByPlayer.get(p.id)}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
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
                      className={`text-sm ${buttonSecondary}`}
                    >
                      Marca lesionado
                    </Link>
                  </div>
                ) : (
                  <AvailabilityBadge status={status} />
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={`p-8 text-center text-muted ${cardClass}`}>
          Aún no hay jugadores registrados en tu club.
        </p>
      )}
    </main>
  );
}
