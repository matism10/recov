import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canManageInjuries, isStaff, type Availability, type UserRole } from "@/lib/roles";
import { getAvatarUrls } from "@/lib/avatars";
import { Avatar } from "@/app/avatar";
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
import {
  InjuryStatusBadge,
  PageTitle,
  SectionTitle,
  buttonPrimary,
  cardClass,
  textButton,
} from "@/app/ui";
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
      "id, player_id, type, severity, status, description, started_on, expected_return_on, doctor_estimate_value, doctor_estimate_unit, occurred_during, reviewed_by, reviewed_at, players(full_name, availability, user_id)",
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
  // Foto del jugador. RLS: solo fotos de perfiles visibles para quien consulta.
  const playerAvatarUrl = player?.user_id
    ? ((await getAvatarUrls(supabase, [player.user_id])).get(player.user_id) ?? null)
    : null;
  // Qué secciones se ven: las mismas condiciones de antes, para ubicar Documentos.
  const showReview = canManage && (inEvaluation || status === "activa");
  const showPhases = staff || isOwnInjury;
  const showBanner = inEvaluation && isOwnInjury;
  // Escritorio: Documentos en la fila del formulario de revisión si está visible;
  // si no, arriba, junto al primer bloque (como antes).
  const documentsRow = showReview ? (showBanner ? 3 : 2) : 1;
  const DOCUMENTS_ROW: Record<number, string> = {
    1: "lg:row-start-1",
    2: "lg:row-start-2",
    3: "lg:row-start-3",
  };
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
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:max-w-6xl lg:px-8">
      <header className="mb-6">
        <Link href="/dashboard" className={textButton}>
          ← Volver
        </Link>
        {/* Jugador destacado: enlaza a su ficha solo para el staff (la misma
            guarda de /jugadores/[id]); el jugador ve su propia lesión sin enlace. */}
        {player &&
          (staff ? (
            <Link
              href={`/jugadores/${injury.player_id}`}
              className="mt-3 inline-flex min-h-11 items-center gap-3 rounded-xl font-medium text-ink hover:underline"
            >
              <Avatar name={player.full_name} url={playerAvatarUrl} />
              {player.full_name}
            </Link>
          ) : (
            <div className="mt-3 flex min-h-11 items-center gap-3 font-medium text-ink">
              <Avatar name={player.full_name} url={playerAvatarUrl} />
              {player.full_name}
            </div>
          ))}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <PageTitle>{injury.type}</PageTitle>
          <InjuryStatusBadge status={status} />
        </div>
      </header>

      {/* Móvil: un bloque bajo otro, en el mismo orden de siempre. Escritorio:
          detalle, revisión y fases (2/3) y documentos al costado (1/3). */}
      <div className="grid gap-6 lg:grid-cols-3 lg:items-start lg:gap-8">
        {showBanner && (
          <div className="space-y-3 rounded-xl border border-brand-strong bg-brand-soft p-5 lg:col-span-2">
            <p className="text-sm text-ink">
              Agrega lo que te indicó el médico y tus documentos para que el
              kinesiólogo revise la lesión.
            </p>
            <Link href={`/lesiones/${injury.id}/completar`} className={buttonPrimary}>
              Sube tu diagnóstico
            </Link>
          </div>
        )}

        <section className={`space-y-4 p-5 lg:col-span-2 ${cardClass}`}>
          {/* Grilla de etiqueta y valor. */}
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Ocurrió</dt>
              <dd className="mt-0.5 text-ink">{formatDate(injury.started_on)}</dd>
            </div>
            {occurredDuring && (
              <div>
                <dt className="text-muted">Ocurrió en</dt>
                <dd className="mt-0.5 text-ink">{OCCURRED_DURING_LABEL[occurredDuring]}</dd>
              </div>
            )}
            {!inEvaluation && (
              <div>
                <dt className="text-muted">Alta estimada</dt>
                <dd className="mt-0.5 text-ink">
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
              <dt className="text-muted">Gravedad</dt>
              <dd className="mt-0.5 text-ink">
                {severity ? SEVERITY_LABEL[severity] : "Por definir"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Revisión</dt>
              <dd className="mt-0.5 text-ink">
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

        {showReview && (
          <section className={`p-5 lg:col-span-2 ${cardClass}`}>
            <SectionTitle className="mb-4">Revisión</SectionTitle>
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

        {showPhases && (
          <section className="lg:col-span-2">
            <SectionTitle className="mb-3">Fases de recuperación</SectionTitle>
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

        <section className={`lg:col-start-3 ${DOCUMENTS_ROW[documentsRow]}`}>
          <SectionTitle className="mb-3">Documentos</SectionTitle>
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
