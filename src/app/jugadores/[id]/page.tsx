import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  AVAILABILITY_LABEL,
  AVAILABILITY_STYLE,
  isStaff,
  type Availability,
  type UserRole,
} from "@/lib/roles";
import {
  INJURY_STATUS_LABEL,
  INJURY_STATUS_STYLE,
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
      "id, type, status, severity, started_on, expected_return_on, closed_on, occurred_during",
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
          .order("position")
      : { data: [] };

  const avatarUrl = (await getAvatarUrls(supabase, [player.user_id])).get(player.user_id);
  const availability = player.availability as Availability;
  const latestReturn = open
    .map((i) => i.expected_return_on as string | null)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-6">
        <Link href="/dashboard" className="text-sm text-slate-500 underline">
          ← Volver
        </Link>
        <div className="mt-3 flex items-center gap-4">
          <Avatar name={player.full_name} url={avatarUrl} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-900">{player.full_name}</h1>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${AVAILABILITY_STYLE[availability]}`}
              >
                {AVAILABILITY_LABEL[availability]}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {player.position && `${player.position} · `}
              {returnLabel(latestReturn ?? null)}
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        <section>
          <h2 className="mb-3 text-sm font-medium text-slate-500">Lesión actual</h2>
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
                    className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{i.type}</p>
                        <p className="text-sm text-slate-500">
                          Desde el {formatDate(i.started_on)}
                          {occurredDuring &&
                            ` · en ${OCCURRED_DURING_LABEL[occurredDuring].toLowerCase()}`}
                          {severity && ` · ${SEVERITY_LABEL[severity]}`}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${INJURY_STATUS_STYLE[status]}`}
                      >
                        {INJURY_STATUS_LABEL[status]}
                      </span>
                    </div>

                    {status === "en_evaluacion" ? (
                      <p className="text-sm text-slate-500">
                        Esperando el diagnóstico del jugador.
                      </p>
                    ) : (
                      <InjuryProgress
                        startedOn={i.started_on}
                        expectedReturnOn={i.expected_return_on}
                      />
                    )}

                    {injuryPhases.length > 0 && (
                      <ol className="space-y-2 border-l-2 border-slate-200 pl-5">
                        {injuryPhases.map((ph) => (
                          <li key={ph.id} className="relative text-sm">
                            <span className="absolute top-1.5 -left-[27px] size-3 rounded-full border-2 border-white bg-emerald-500" />
                            <span className="font-medium text-slate-900">{ph.name}</span>
                            <span className="text-slate-500">
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
                      className="inline-block text-sm font-medium text-emerald-700 underline"
                    >
                      Ver detalle de la lesión
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="rounded-2xl bg-white p-5 text-sm text-slate-500 ring-1 ring-slate-200">
              {availability === "disponible"
                ? "No tiene lesiones abiertas."
                : "Sin lesión registrada: la disponibilidad se cambió a mano."}
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-slate-500">Línea de tiempo</h2>
          {all.length > 0 ? (
            <ol className="space-y-4 border-l-2 border-slate-200 pl-5">
              {all.map((i) => {
                const status = i.status as InjuryStatus;
                return (
                  <li key={i.id} className="relative">
                    <span
                      className={`absolute top-1.5 -left-[27px] size-3 rounded-full border-2 border-white ${
                        OPEN_STATUSES.includes(status) ? "bg-amber-500" : "bg-slate-300"
                      }`}
                    />
                    <Link href={`/lesiones/${i.id}`} className="group block">
                      <p className="font-medium text-slate-900 group-hover:underline">
                        {i.type}
                      </p>
                      <p className="text-sm text-slate-500">
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
            <p className="rounded-2xl bg-white p-5 text-sm text-slate-500 ring-1 ring-slate-200">
              Sin lesiones registradas.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
