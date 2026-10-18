import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import {
  INJURED_AVAILABILITY,
  canManageInjuries,
  isStaff,
  type Availability,
  type UserRole,
} from "@/lib/roles";
import {
  formatDate,
  formatDayMonth,
  returnLabel,
  type InjuryStatus,
} from "@/lib/injuries";
import { InjuryProgress } from "@/app/lesiones/injury-progress";
import { Avatar } from "@/app/avatar";
import { getSquad } from "@/lib/squad";
import {
  AvailabilityBadge,
  InjuryStatusBadge,
  PageTitle,
  SectionTitle,
  buttonPrimary,
  buttonSecondary,
  cardClass,
  chipClass,
  textButton,
} from "@/app/ui";
import { SummarySquad } from "./squad-browser";
import { NextMatch } from "./next-match";
import { MetricsStrip } from "./metrics-strip";

// Jugadores disponibles que muestra el Resumen; el resto está en /plantel.
const RESUMEN_AVAILABLE = 10;

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

  // Plantel confirmado y activo, con fotos (también la propia, para el acceso a
  // /perfil) y la fase en curso de cada jugador.
  const { players, avatarUrls, phaseByPlayer } = await getSquad(supabase, [user.id]);
  const myAvatarUrl = avatarUrls.get(user.id) ?? null;
  // En el Resumen, solo los primeros disponibles; el plantel completo está en /plantel.
  const availablePlayers = players
    .filter((p) => p.availability === "disponible")
    .slice(0, RESUMEN_AVAILABLE);

  const club = Array.isArray(profile.clubs) ? profile.clubs[0] : profile.clubs;
  const roles = (profile.roles ?? []) as UserRole[];
  // Kinesiólogo, delegado y head coach: cambian disponibilidad y gestionan lesiones.
  // Solo decide qué se muestra; las funciones de la base validan el permiso real.
  const canManage = canManageInjuries(roles, user.id, club?.kine_delegate_id);

  // Próximo partido: la competencia no cancelada más cercana. RLS: eventos del club.
  const { data: nextMatch } = await supabase
    .from("events")
    .select("id, starts_at, opponent")
    .eq("type", "competencia")
    .is("cancelled_at", null)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(1)
    .maybeSingle();

  const staff = isStaff(roles);
  const isPlayer = roles.includes("jugador");
  // Estado propio (rol jugador): su fila del plantel que ya trae getSquad, y la
  // fase en curso de squad_current_phases. Sin consultas nuevas.
  const me = isPlayer ? players.find((p) => p.user_id === user.id) : undefined;
  const myStatus = me?.availability as Availability | undefined;
  const myPhase = me && myStatus === "lesionado" ? phaseByPlayer.get(me.id) : undefined;

  // "Lesiones activas" (staff): jugadores en Lesionado o Reintegro, con el inicio y
  // la fecha de regreso de su lesión abierta. RLS: el staff ve las lesiones del club.
  const injuredPlayers = players.filter((p) =>
    (INJURED_AVAILABILITY as readonly string[]).includes(p.availability),
  );
  const openByPlayer = new Map<
    string,
    { type: string; startedOn: string; expectedReturnOn: string | null }
  >();
  if (staff && injuredPlayers.length > 0) {
    const { data: open } = await supabase
      .from("injuries")
      .select("player_id, type, started_on, expected_return_on")
      .in("status", ["en_evaluacion", "activa"])
      .in(
        "player_id",
        injuredPlayers.map((p) => p.id),
      );
    // Si tiene más de una lesión abierta, manda la que termina más tarde.
    for (const i of open ?? []) {
      const current = openByPlayer.get(i.player_id)?.expectedReturnOn;
      if (!current || (i.expected_return_on && i.expected_return_on > current)) {
        openByPlayer.set(i.player_id, {
          type: i.type,
          startedOn: i.started_on,
          expectedReturnOn: i.expected_return_on,
        });
      }
    }
  }

  // "Mis lesiones" (jugador). RLS: el jugador ve solo las suyas; se filtra por
  // si además es staff.
  let injuries = null;
  if (isPlayer) {
    ({ data: injuries } = await supabase
      .from("injuries")
      .select(
        "id, type, status, started_on, expected_return_on, closed_on, players!inner(user_id)",
      )
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
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:max-w-6xl lg:px-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <PageTitle>Disponibilidad del plantel</PageTitle>
          {myStatus && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink">
              Tu estado
              <AvailabilityBadge status={myStatus} />
              {myPhase && <span className="text-muted">· {myPhase}</span>}
            </p>
          )}
          <Link
            href="/perfil"
            // En celular el perfil ya está en el avatar del encabezado móvil.
            className="-mx-2 mt-1 hidden min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-medium text-ink transition hover:bg-mist lg:inline-flex"
          >
            <Avatar name={profile.full_name ?? ""} url={myAvatarUrl} />
            <span>
              <span className="sr-only">Tu perfil: </span>
              {profile.full_name?.split(" ")[0]}
            </span>
          </Link>
        </div>
        {/* Escritorio: próximo partido arriba a la derecha. */}
        {nextMatch && <NextMatch match={nextMatch} className="hidden lg:inline-flex" />}
      </header>

      {/* Franja de métricas: solo staff. En celular, disponibles y lesionados, justo
          bajo el título. */}
      {staff && <MetricsStrip supabase={supabase} />}

      {/* Celular: el próximo partido a lo ancho. */}
      {nextMatch && <NextMatch match={nextMatch} stacked className="mb-6 flex w-full lg:hidden" />}

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
            <SectionTitle>
              Por revisar
              {toReview.length > 0 && (
                <span className={`ml-1.5 ${chipClass}`}>
                  {toReview.length}
                </span>
              )}
            </SectionTitle>
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
          <SectionTitle className="mb-3">Lesiones activas</SectionTitle>
          {injuredPlayers.length > 0 ? (
            <>
              <ul className="divide-y divide-line overflow-hidden rounded-xl bg-mist border border-line lg:hidden">
                {injuredPlayers.map((p) => {
                  const status = p.availability as Availability;
                  const injury = openByPlayer.get(p.id);
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/jugadores/${p.id}`}
                        className="block space-y-3 px-5 py-4 transition hover:bg-white"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar name={p.full_name} url={p.user_id ? avatarUrls.get(p.user_id) : null} />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-ink">{p.full_name}</p>
                            {injury && <p className="text-sm text-ink">{injury.type}</p>}
                            <p className="text-sm text-muted">
                              {returnLabel(injury?.expectedReturnOn ?? null)}
                            </p>
                          </div>
                          <AvailabilityBadge status={status} />
                          <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted" />
                        </div>
                        {injury?.expectedReturnOn && (
                          <InjuryProgress
                            startedOn={injury.startedOn}
                            expectedReturnOn={injury.expectedReturnOn}
                          />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {/* En escritorio, la misma lista como tabla. */}
              <div className="hidden overflow-x-auto rounded-xl border border-line bg-mist lg:block">
                <table className="w-full text-left">
                  <thead className="text-sm text-muted">
                    <tr className="border-b border-line">
                      <th scope="col" className="py-3 pr-3 pl-5 font-medium">
                        Jugador
                      </th>
                      <th scope="col" className="px-3 py-3 font-medium">
                        Fase en curso
                      </th>
                      <th scope="col" className="px-3 py-3 font-medium">
                        Regreso estimado
                      </th>
                      <th scope="col" className="px-3 py-3 font-medium">
                        Progreso
                      </th>
                      <th scope="col" className="py-3 pl-3 font-medium">
                        Estado
                      </th>
                      {/* Columna del chevron: decorativa. */}
                      <td aria-hidden="true" className="w-10 pr-5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {injuredPlayers.map((p) => {
                      const injury = openByPlayer.get(p.id);
                      return (
                        // Fila clicable: el único enlace (el nombre) se extiende sobre toda la fila.
                        <tr key={p.id} className="relative transition hover:bg-white">
                          <td className="py-3 pr-3 pl-5">
                            <Link
                              href={`/jugadores/${p.id}`}
                              className="flex min-h-11 items-center gap-3 after:absolute after:inset-0 after:content-['']"
                            >
                              <Avatar name={p.full_name} url={p.user_id ? avatarUrls.get(p.user_id) : null} />
                              <span>
                                <span className="block font-medium text-ink">{p.full_name}</span>
                                {injury && (
                                  <span className="block text-sm text-ink">{injury.type}</span>
                                )}
                              </span>
                            </Link>
                          </td>
                          <td className="px-3 py-3 text-sm text-muted">
                            {phaseByPlayer.get(p.id)}
                          </td>
                          <td className="px-3 py-3 text-sm text-muted">
                            {returnLabel(injury?.expectedReturnOn ?? null)}
                          </td>
                          <td className="w-56 px-3 py-3">
                            {injury?.expectedReturnOn && (
                              <InjuryProgress
                                startedOn={injury.startedOn}
                                expectedReturnOn={injury.expectedReturnOn}
                              />
                            )}
                          </td>
                          <td className="py-3 pl-3">
                            <AvailabilityBadge status={p.availability as Availability} />
                          </td>
                          <td aria-hidden="true" className="w-10 py-3 pr-5">
                            <ChevronRight className="size-5 text-muted" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
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
            <SectionTitle>Mis lesiones</SectionTitle>
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
                        <InjuryStatusBadge status={i.status as InjuryStatus} />
                      </div>
                      {i.status === "cerrada" && i.closed_on ? (
                        // Cerrada: la fecha de alta en vez de la barra al 100 %.
                        <p className="text-sm text-muted">Alta el {formatDayMonth(i.closed_on)}</p>
                      ) : (
                        i.status !== "en_evaluacion" && (
                          <InjuryProgress
                            startedOn={i.started_on}
                            expectedReturnOn={i.expected_return_on}
                          />
                        )
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

      <section>
        <SectionTitle className="mb-3">Plantel</SectionTitle>
        {players.length === 0 ? (
          <p className={`p-8 text-center text-muted ${cardClass}`}>
            Aún no hay jugadores registrados en tu club.
          </p>
        ) : (
          // Sin búsqueda: los primeros disponibles. Al escribir: todo el plantel.
          <SummarySquad
            players={players}
            shown={availablePlayers}
            emptyText="No hay jugadores disponibles."
            avatarUrls={avatarUrls}
            phaseByPlayer={phaseByPlayer}
            canManage={canManage}
            linkToProfile={staff}
          />
        )}
        {players.length > 0 && (
          <Link href="/plantel" className={`mt-4 text-sm ${buttonSecondary}`}>
            Ver plantel completo
          </Link>
        )}
      </section>
    </main>
  );
}
