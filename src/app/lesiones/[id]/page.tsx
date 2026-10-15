import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canManageInjuries, isStaff, type Availability, type UserRole } from "@/lib/roles";
import {
  OCCURRED_DURING_LABEL,
  SEVERITY_LABEL,
  durationLabel,
  formatDate,
  type DurationUnit,
  type InjurySeverity,
  type InjuryStatus,
  type OccurredDuring,
  type PhaseStatus,
} from "@/lib/injuries";
import { InjuryProgress } from "../injury-progress";
import { InjuryStatusBadge, buttonPrimary, cardClass, textButton } from "@/app/ui";
import { PhasesPanel } from "./phases-panel";
import { ReviewForm } from "./review-form";

const SIGNED_URL_SECONDS = 5 * 60;

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
      "id, type, severity, status, description, started_on, expected_return_on, doctor_estimate_value, doctor_estimate_unit, occurred_during, reviewed_by, reviewed_at, players(full_name, availability, user_id)",
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
  // Solo decide qué se muestra; review_injury valida el permiso real.
  const canManage = canManageInjuries(roles, user.id, club?.kine_delegate_id);
  const canSeeDocuments = !staff || canManage;

  const [{ data: documents }, { data: phases }, { data: reviewer }] =
    await Promise.all([
      // RLS: el jugador ve los suyos; del staff, solo quien tiene acceso a documentos médicos.
      supabase
        .from("documents")
        .select("id, file_name, storage_path, created_at")
        .eq("injury_id", id)
        .order("created_at"),
      // RLS: el staff ve las fases del club; el jugador, las de sus lesiones.
      supabase
        .from("injury_phases")
        .select("id, name, status, started_on, ended_on")
        .eq("injury_id", id)
        .is("archived_at", null)
        .order("position"),
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
  const inEvaluation = status === "en_evaluacion";
  const isOwnInjury = player?.user_id === user.id;
  const occurredDuring = injury.occurred_during as OccurredDuring | null;
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
        <Link href="/dashboard" className={textButton}>
          ← Volver
        </Link>
        {staff && player && (
          <p className="mt-2 text-sm text-muted">{player.full_name}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-ink">{injury.type}</h1>
          <InjuryStatusBadge status={status} />
        </div>
      </header>

      <div className="space-y-6">
        {inEvaluation && isOwnInjury && (
          <div className="space-y-3 rounded-xl border border-brand-strong bg-brand-soft p-5">
            <p className="text-sm text-ink">
              Agrega lo que te indicó el médico y tus documentos para que el
              kinesiólogo revise la lesión.
            </p>
            <Link href={`/lesiones/${injury.id}/completar`} className={buttonPrimary}>
              Sube tu diagnóstico
            </Link>
          </div>
        )}

        <section className={`space-y-4 p-5 ${cardClass}`}>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="inline text-muted">Ocurrió: </dt>
              <dd className="inline text-ink">{formatDate(injury.started_on)}</dd>
            </div>
            {occurredDuring && (
              <div>
                <dt className="inline text-muted">Ocurrió en: </dt>
                <dd className="inline text-ink">
                  {OCCURRED_DURING_LABEL[occurredDuring].toLowerCase()}
                </dd>
              </div>
            )}
            {!inEvaluation && (
              <div>
                <dt className="inline text-muted">Alta estimada: </dt>
                <dd className="inline text-ink">
                  {injury.expected_return_on
                    ? formatDate(injury.expected_return_on)
                    : "Sin definir"}
                  {doctorEstimate && (
                    <span className="text-muted">
                      {" "}
                      ({doctorEstimate} según el médico)
                    </span>
                  )}
                </dd>
              </div>
            )}
            <div>
              <dt className="inline text-muted">Gravedad: </dt>
              <dd className="inline text-ink">
                {severity ? SEVERITY_LABEL[severity] : "Por definir"}
              </dd>
            </div>
            <div>
              <dt className="inline text-muted">Revisión: </dt>
              <dd className="inline text-ink">
                {inEvaluation
                  ? "Esperando el diagnóstico del jugador"
                  : injury.reviewed_at
                    ? `Revisada el ${formatDate(injury.reviewed_at)}${
                        reviewer?.full_name ? ` por ${reviewer.full_name}` : ""
                      }`
                    : "Pendiente de revisión del kinesiólogo"}
              </dd>
            </div>
          </dl>
          {injury.description && (
            <p className="text-sm whitespace-pre-line text-ink">
              {injury.description}
            </p>
          )}
          {!inEvaluation && (
            <InjuryProgress
              startedOn={injury.started_on}
              expectedReturnOn={injury.expected_return_on}
            />
          )}
        </section>

        {canManage && (inEvaluation || status === "activa") && (
          <section className={`p-5 ${cardClass}`}>
            <h2 className="mb-4 font-medium text-ink">Revisión</h2>
            <ReviewForm
              injuryId={injury.id}
              status={status}
              startedOn={injury.started_on}
              expectedReturnOn={injury.expected_return_on}
              severity={severity}
              availability={(player?.availability ?? "disponible") as Availability}
            />
          </section>
        )}

        {(staff || isOwnInjury) && (
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted">Fases de recuperación</h2>
            <PhasesPanel
              injuryId={injury.id}
              phases={(phases ?? []).map((ph) => ({
                id: ph.id,
                name: ph.name,
                status: ph.status as PhaseStatus,
                started_on: ph.started_on ?? "",
                ended_on: ph.ended_on ?? "",
              }))}
              canEdit={canManage && status === "activa"}
              startedOn={injury.started_on}
              expectedReturnOn={injury.expected_return_on}
            />
          </section>
        )}

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">Documentos</h2>
          {!canSeeDocuments ? (
            <p className={`p-5 text-sm text-muted ${cardClass}`}>
              Los documentos médicos solo los ven el kinesiólogo y el head coach.
            </p>
          ) : documents && documents.length > 0 ? (
            <ul className="divide-y divide-line overflow-hidden rounded-xl bg-mist border border-line">
              {documents.map((d) => {
                const url = signedUrls.get(d.storage_path as string);
                return (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-4 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-ink">{d.file_name}</p>
                      <p className="text-xs text-muted">
                        Subido el {formatDate(d.created_at)}
                      </p>
                    </div>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center text-sm font-medium text-brand-text underline"
                      >
                        Ver
                      </a>
                    ) : (
                      <span className="text-sm text-muted">No disponible</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={`p-5 text-sm text-muted ${cardClass}`}>
              No hay documentos adjuntos.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
