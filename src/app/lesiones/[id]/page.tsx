import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isStaff, type UserRole } from "@/lib/roles";
import {
  INJURY_STATUS_LABEL,
  PHASE_STATUS_LABEL,
  SEVERITY_LABEL,
  durationLabel,
  formatDate,
  type DurationUnit,
  type InjurySeverity,
  type InjuryStatus,
  type PhaseStatus,
} from "@/lib/injuries";
import { InjuryProgress } from "../injury-progress";
import { ReviewForm } from "./review-form";

const SIGNED_URL_SECONDS = 5 * 60;

const STATUS_STYLE: Record<InjuryStatus, string> = {
  activa: "bg-amber-100 text-amber-800",
  cerrada: "bg-slate-100 text-slate-700",
};

export default async function InjuryPage({
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
    .select("roles, status, club_id")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.status === "pendiente") redirect("/pendiente");
  if (me?.status !== "confirmado") redirect("/dashboard");

  // RLS: el staff ve las lesiones del club; el jugador, solo las suyas.
  const { data: injury } = await supabase
    .from("injuries")
    .select(
      "id, type, severity, status, description, started_on, expected_return_on, doctor_estimate_value, doctor_estimate_unit, reviewed_by, reviewed_at, players(full_name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!injury) notFound();

  const roles = (me.roles ?? []) as UserRole[];
  const staff = isStaff(roles);

  const { data: club } = await supabase
    .from("clubs")
    .select("kine_delegate_id")
    .eq("id", me.club_id)
    .maybeSingle();
  // Solo decide qué se muestra; RLS (injuries_write) valida el permiso real.
  const hasKinePowers =
    roles.includes("kinesiologo") || club?.kine_delegate_id === user.id;
  const canSeeDocuments = !staff || hasKinePowers || roles.includes("head_coach");

  const [{ data: documents }, { data: phases }, { data: reviewer }] =
    await Promise.all([
      // RLS: el jugador ve los suyos; del staff, solo quien tiene acceso a documentos médicos.
      supabase
        .from("documents")
        .select("id, file_name, storage_path, created_at")
        .eq("injury_id", id)
        .order("created_at"),
      staff
        ? supabase
            .from("injury_phases")
            .select("id, name, status, started_on, ended_on")
            .eq("injury_id", id)
            .order("position")
        : Promise.resolve({ data: null }),
      injury.reviewed_by
        ? supabase
            .from("profiles")
            .select("full_name")
            .eq("id", injury.reviewed_by)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const signedUrls = new Map<string, string>();
  if (documents && documents.length > 0) {
    const { data: urls } = await supabase.storage
      .from("medical-docs")
      .createSignedUrls(
        documents.map((d) => d.storage_path as string),
        SIGNED_URL_SECONDS,
      );
    for (const u of urls ?? []) {
      if (u.path && u.signedUrl) signedUrls.set(u.path, u.signedUrl);
    }
  }

  const player = Array.isArray(injury.players) ? injury.players[0] : injury.players;
  const status = injury.status as InjuryStatus;
  const severity = injury.severity as InjurySeverity | null;
  const doctorEstimate =
    injury.doctor_estimate_value && injury.doctor_estimate_unit
      ? durationLabel(
          injury.doctor_estimate_value,
          injury.doctor_estimate_unit as DurationUnit,
        )
      : null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-6">
        <Link href="/dashboard" className="text-sm text-slate-500 underline">
          ← Volver
        </Link>
        {staff && player && (
          <p className="mt-2 text-sm text-slate-500">{player.full_name}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">{injury.type}</h1>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[status]}`}
          >
            {INJURY_STATUS_LABEL[status]}
          </span>
        </div>
      </header>

      <div className="space-y-6">
        <section className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="inline text-slate-500">Ocurrió: </dt>
              <dd className="inline text-slate-900">{formatDate(injury.started_on)}</dd>
            </div>
            <div>
              <dt className="inline text-slate-500">Alta estimada: </dt>
              <dd className="inline text-slate-900">
                {injury.expected_return_on
                  ? formatDate(injury.expected_return_on)
                  : "Sin definir"}
                {doctorEstimate && (
                  <span className="text-slate-500">
                    {" "}
                    ({doctorEstimate} según el médico)
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="inline text-slate-500">Gravedad: </dt>
              <dd className="inline text-slate-900">
                {severity ? SEVERITY_LABEL[severity] : "Por definir"}
              </dd>
            </div>
            <div>
              <dt className="inline text-slate-500">Revisión: </dt>
              <dd className="inline text-slate-900">
                {injury.reviewed_at
                  ? `Revisada el ${formatDate(injury.reviewed_at)}${
                      reviewer?.full_name ? ` por ${reviewer.full_name}` : ""
                    }`
                  : "Pendiente de revisión del kinesiólogo"}
              </dd>
            </div>
          </dl>
          {injury.description && (
            <p className="text-sm whitespace-pre-line text-slate-700">
              {injury.description}
            </p>
          )}
          <InjuryProgress
            startedOn={injury.started_on}
            expectedReturnOn={injury.expected_return_on}
          />
        </section>

        {hasKinePowers && (
          <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
            <h2 className="mb-4 font-medium text-slate-900">Revisión del kinesiólogo</h2>
            <ReviewForm
              injuryId={injury.id}
              startedOn={injury.started_on}
              expectedReturnOn={injury.expected_return_on}
              severity={severity}
              reviewed={!!injury.reviewed_at}
            />
          </section>
        )}

        {staff && (
          <section>
            <h2 className="mb-3 text-sm font-medium text-slate-500">Línea de tiempo</h2>
            {phases && phases.length > 0 ? (
              <ol className="space-y-3 border-l-2 border-slate-200 pl-5">
                {phases.map((ph) => (
                  <li key={ph.id} className="relative">
                    <span className="absolute top-1.5 -left-[27px] size-3 rounded-full border-2 border-white bg-emerald-500" />
                    <p className="font-medium text-slate-900">{ph.name}</p>
                    <p className="text-sm text-slate-500">
                      {PHASE_STATUS_LABEL[ph.status as PhaseStatus]}
                      {ph.started_on && ` · desde ${formatDate(ph.started_on)}`}
                      {ph.ended_on && ` · hasta ${formatDate(ph.ended_on)}`}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-2xl bg-white p-5 text-sm text-slate-500 ring-1 ring-slate-200">
                Sin fases registradas.
              </p>
            )}
          </section>
        )}

        <section>
          <h2 className="mb-3 text-sm font-medium text-slate-500">Documentos</h2>
          {!canSeeDocuments ? (
            <p className="rounded-2xl bg-white p-5 text-sm text-slate-500 ring-1 ring-slate-200">
              Los documentos médicos solo los ven el kinesiólogo y el head coach.
            </p>
          ) : documents && documents.length > 0 ? (
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
              {documents.map((d) => {
                const url = signedUrls.get(d.storage_path as string);
                return (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-4 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-slate-900">{d.file_name}</p>
                      <p className="text-xs text-slate-400">
                        Subido el {formatDate(d.created_at)}
                      </p>
                    </div>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-emerald-700 underline"
                      >
                        Ver
                      </a>
                    ) : (
                      <span className="text-sm text-slate-400">No disponible</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-2xl bg-white p-5 text-sm text-slate-500 ring-1 ring-slate-200">
              No hay documentos adjuntos.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
