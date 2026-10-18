import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  isStaff,
  type Availability,
  type UserRole,
} from "@/lib/roles";
import {
  INJURY_STATUS_LABEL,
  OCCURRED_DURING_LABEL,
  PHASE_STATUS_LABEL,
  SEVERITY_LABEL,
  formatDate,
  returnLabel,
  type InjurySeverity,
  type InjuryStatus,
  type OccurredDuring,
  type PhaseStatus,
} from "@/lib/injuries";
import { InjuryProgress } from "@/app/lesiones/injury-progress";
import { Avatar } from "@/app/avatar";
import { getAvatarUrls } from "@/lib/avatars";
import {
  AvailabilityBadge,
  InjuryStatusBadge,
  PageTitle,
  PhaseDot,
  SectionTitle,
  cardClass,
  textButton,
} from "@/app/ui";

const OPEN_STATUSES: InjuryStatus[] = ["en_evaluacion", "activa"];

// Ficha del jugador para el staff: lesión abierta, avance y línea de tiempo.
export default async function PlayerPage({
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
  // El jugador no ve lesiones de otros: la ficha es solo para el staff.
  if (me?.status !== "confirmado" || !isStaff((me.roles ?? []) as UserRole[])) {
    redirect("/dashboard");
  }

  // RLS: solo jugadores del club.
  const { data: player } = await supabase
    .from("players")
    .select("id, full_name, position, availability, user_id")
    .eq("id", id)
    .eq("status", "confirmado")
    .maybeSingle();
  if (!player) notFound();

  // RLS: el staff ve las lesiones del club.
  const { data: injuries } = await supabase
    .from("injuries")
    .select(
      "id, type, status, severity, started_on, expected_return_on, closed_on, occurred_during, reviewed_at",
    )
    .eq("player_id", id)
    .order("started_on", { ascending: false });

  const all = injuries ?? [];
  const open = all.filter((i) => OPEN_STATUSES.includes(i.status as InjuryStatus));

  const { data: phases } =
    open.length > 0
      ? await supabase
          .from("injury_phases")
          .select("id, injury_id, name, status, started_on, ended_on")
          .in(
            "injury_id",
            open.map((i) => i.id),
          )
          .is("archived_at", null)
          .order("position")
      : { data: [] };

  const avatarUrl = (await getAvatarUrls(supabase, [player.user_id])).get(player.user_id);
  const availability = player.availability as Availability;
  const latestReturn = open
    .map((i) => i.expected_return_on as string | null)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);
  // Una lesión activa que nadie ha revisado todavía no tiene un regreso confiable.
  const pendingReview = open.some((i) => i.status === "activa" && i.reviewed_at === null);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:max-w-6xl lg:px-8">
      <header className="mb-6">
        <Link href="/dashboard" className={textButton}>
          ← Volver
        </Link>
        <div className="mt-3 flex items-center gap-4">
          <Avatar name={player.full_name} url={avatarUrl} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <PageTitle>{player.full_name}</PageTitle>
              <AvailabilityBadge status={availability} />
            </div>
            <p className="mt-1 text-sm text-muted">
              {player.position && `${player.position} · `}
              {pendingReview ? "Lesión por revisar" : returnLabel(latestReturn ?? null)}
            </p>
          </div>
        </div>
      </header>

      {/* En escritorio: lesión actual a la izquierda y línea de tiempo a la derecha. */}
      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8 lg:space-y-0">
        <section>
          <SectionTitle className="mb-3">Lesión actual</SectionTitle>
          {open.length > 0 ? (
            <div className="space-y-3">
              {open.map((i) => {
                const status = i.status as InjuryStatus;
                const severity = i.severity as InjurySeverity | null;
                const occurredDuring = i.occurred_during as OccurredDuring | null;
                const injuryPhases = (phases ?? []).filter((ph) => ph.injury_id === i.id);
                return (
                  <article
                    key={i.id}
                    className={`space-y-4 p-5 ${cardClass}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink">{i.type}</p>
                        <p className="text-sm text-muted">
                          Desde el {formatDate(i.started_on)}
                          {occurredDuring &&
                            (occurredDuring === "externo"
                              ? " · fuera del club"
                              : ` · en ${OCCURRED_DURING_LABEL[occurredDuring].toLowerCase()}`)}
                          {severity && ` · ${SEVERITY_LABEL[severity]}`}
                        </p>
                      </div>
                      <InjuryStatusBadge status={status} />
                    </div>

                    {status === "en_evaluacion" ? (
                      <p className="text-sm text-muted">
                        Esperando el diagnóstico del jugador.
                      </p>
                    ) : (
                      <InjuryProgress
                        startedOn={i.started_on}
                        expectedReturnOn={i.expected_return_on}
                      />
                    )}

                    {injuryPhases.length > 0 && (
                      <ol className="space-y-3 border-l-2 border-line pl-5">
                        {injuryPhases.map((ph) => (
                          <li key={ph.id} className="relative text-sm">
                            <PhaseDot status={ph.status as PhaseStatus} />
                            <span className="font-medium text-ink">{ph.name}</span>
                            <span className="text-muted">
                              {" · "}
                              {PHASE_STATUS_LABEL[ph.status as PhaseStatus]}
                              {ph.started_on && ` · desde ${formatDate(ph.started_on)}`}
                              {ph.ended_on && ` · hasta ${formatDate(ph.ended_on)}`}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}

                    <Link
                      href={`/lesiones/${i.id}`}
                      className="inline-flex min-h-11 items-center text-sm font-medium text-brand-text underline"
                    >
                      Ver detalle de la lesión
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className={`p-5 text-sm text-muted ${cardClass}`}>
              {availability === "disponible"
                ? "No tiene lesiones abiertas."
                : "Sin lesión registrada: la disponibilidad se cambió a mano."}
            </p>
          )}
        </section>

        <section>
          <SectionTitle className="mb-3">Línea de tiempo</SectionTitle>
          {all.length > 0 ? (
            <ol className="space-y-4 border-l-2 border-line pl-5">
              {all.map((i) => {
                const status = i.status as InjuryStatus;
                return (
                  <li key={i.id} className="relative">
                    <PhaseDot
                      status={
                        OPEN_STATUSES.includes(status)
                          ? "en_curso"
                          : status === "cerrada"
                            ? "completada"
                            : "pendiente"
                      }
                    />
                    <Link href={`/lesiones/${i.id}`} className="group block">
                      <p className="font-medium text-ink group-hover:underline">
                        {i.type}
                      </p>
                      <p className="text-sm text-muted">
                        {formatDate(i.started_on)}
                        {i.closed_on && ` – ${formatDate(i.closed_on)}`}
                        {" · "}
                        {INJURY_STATUS_LABEL[status]}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className={`p-5 text-sm text-muted ${cardClass}`}>
              Sin lesiones registradas.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
