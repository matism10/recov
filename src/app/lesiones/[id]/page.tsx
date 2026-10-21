import Link from "next/link";
import { Hourglass } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canManageInjuries, isStaff, type Availability, type UserRole } from "@/lib/roles";
import { getAvatarUrls } from "@/lib/avatars";
import { Avatar } from "@/app/avatar";
import { WhatsAppButton } from "@/app/whatsapp-button";
import {
  INJURY_STATUS_LABEL,
  OCCURRED_DURING_LABEL,
  SEVERITY_LABEL,
  durationLabel,
  formatDate,
  recoveryProgress,
  type DurationUnit,
  type InjurySeverity,
  type InjuryStatus,
  type OccurredDuring,
  type PhaseStatus,
} from "@/lib/injuries";
import {
  InjuryStatusBadge,
  PageTitle,
  SectionTitle,
  buttonPrimary,
  textButton,
} from "@/app/ui";
import { PhasesPanel } from "./phases-panel";
import { ReviewForm } from "./review-form";

const SIGNED_URL_SECONDS = 5 * 60;

// Bloques del detalle: superficie sin borde, separados por tono y aire.
const blockClass = "rounded-xl bg-mist";

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
  // Teléfono para contactar al jugador: solo el staff, y solo si lo dejó.
  // get_player_phone devuelve null a quien no corresponde (0030).
  const { data: phone } =
    staff && !isOwnInjury
      ? await supabase.rpc("get_player_phone", { p_player_id: injury.player_id })
      : { data: null };
  // Qué secciones se ven: las mismas condiciones de antes.
  const showReview = canManage && (inEvaluation || status === "activa");
  const showPhases = staff || isOwnInjury;
  const showBanner = inEvaluation && isOwnInjury;
  // El jugador ya envió su lesión y espera que el staff la revise.
  const awaitingReview = isOwnInjury && status === "activa" && !injury.reviewed_at;
  const occurredDuring = injury.occurred_during as OccurredDuring | null;
  const severity = injury.severity as InjurySeverity | null;
  const doctorEstimate =
    injury.doctor_estimate_value && injury.doctor_estimate_unit
      ? durationLabel(
          injury.doctor_estimate_value,
          injury.doctor_estimate_unit as DurationUnit,
        )
      : null;

  // Línea de estado del encabezado: "Activa · sin revisar", "En evaluación · …".
  const statusLine = inEvaluation
    ? `${INJURY_STATUS_LABEL[status]} · esperando el diagnóstico`
    : status === "activa"
      ? `${INJURY_STATUS_LABEL[status]} · ${injury.reviewed_at ? "revisada" : "sin revisar"}`
      : INJURY_STATUS_LABEL[status];
  const progress =
    !inEvaluation && injury.expected_return_on
      ? recoveryProgress(injury.started_on, injury.expected_return_on)
      : null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 lg:max-w-6xl lg:px-12 lg:py-12">
      <Link href="/dashboard" className={textButton}>
        ← Volver
      </Link>

      {awaitingReview && (
        <div
          role="status"
          className="mt-2 mb-4 flex items-start gap-3 rounded-xl border-l-4 border-revision bg-revision-bg p-4 lg:p-5"
        >
          <Hourglass aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-revision-fg" />
          <div className="min-w-0">
            <p className="font-bold text-revision-fg">Tu lesión está esperando revisión</p>
            <p className="mt-1 text-sm text-ink">
              Alguien del staff la va a revisar y confirmar. Cuando lo haga, aquí verás la
              gravedad, el alta estimada y las fases de tu recuperación.
            </p>
          </div>
        </div>
      )}

      {/* Móvil: un bloque bajo otro. Escritorio: resumen, datos y revisión a la
          izquierda; fases y documentos a la derecha. */}
      <div className="mt-2 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-10">
        <div className="min-w-0 space-y-6">
          {/* Encabezado en superficie 2: jugador (enlace a su ficha solo para el
              staff, la misma guarda de /jugadores/[id]), lesión y estado. */}
          <header className="space-y-3 rounded-xl bg-surface-2 p-5">
            {player &&
              (staff ? (
                <Link
                  href={`/jugadores/${injury.player_id}`}
                  className="flex w-fit max-w-full min-h-11 items-center gap-3 font-semibold text-ink hover:underline"
                >
                  <Avatar name={player.full_name} url={playerAvatarUrl} size="md" />
                  <span className="min-w-0 break-words">{player.full_name}</span>
                </Link>
              ) : (
                <div className="flex min-h-11 items-center gap-3 font-semibold text-ink">
                  <Avatar name={player.full_name} url={playerAvatarUrl} size="md" />
                  <span className="min-w-0 break-words">{player.full_name}</span>
                </div>
              ))}
            <PageTitle className="min-w-0 break-words">{injury.type}</PageTitle>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <InjuryStatusBadge status={status} />
              <p className="text-sm text-muted">{statusLine}</p>
            </div>
            {phone && player && (
              <WhatsAppButton phone={phone as string} name={player.full_name} />
            )}
          </header>

          {showBanner && (
            <div className="space-y-3 rounded-xl bg-brand-soft p-5">
              <p className="text-ink">
                Agrega lo que te indicó el médico y tus documentos para que el
                kinesiólogo revise la lesión.
              </p>
              <Link href={`/lesiones/${injury.id}/completar`} className={buttonPrimary}>
                Sube tu diagnóstico
              </Link>
            </div>
          )}

          {/* Cifra protagonista: el día de recuperación. */}
          {!inEvaluation &&
            (progress ? (
              <section aria-label="Avance hacia el alta" className="space-y-3">
                <p className="text-[44px] leading-[48px] font-bold tabular-nums text-ink">
                  Día {progress.day} de {progress.total}
                </p>
                <div
                  role="progressbar"
                  aria-valuenow={progress.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Avance hacia el alta"
                  className="h-2 overflow-hidden rounded-sm bg-surface-2"
                >
                  <div className="h-full bg-brand" style={{ width: `${progress.percent}%` }} />
                </div>
                <p className="flex flex-wrap justify-between gap-x-4 text-sm text-muted">
                  <span>
                    Alta estimada{" "}
                    <span className="font-semibold text-ink">
                      {formatDate(injury.expected_return_on as string)}
                    </span>
                  </span>
                  <span className="tabular-nums">{progress.percent}%</span>
                </p>
              </section>
            ) : (
              <p className="text-muted">Sin fecha estimada de alta</p>
            ))}

          {/* Grilla de datos: etiqueta 13, valor 16/600. */}
          <section className={`min-w-0 space-y-4 p-5 ${blockClass}`}>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-[13px] text-muted">Ocurrió</dt>
                <dd className="mt-0.5 font-semibold break-words text-ink">{formatDate(injury.started_on)}</dd>
              </div>
              {occurredDuring && (
                <div className="min-w-0">
                  <dt className="text-[13px] text-muted">Ocurrió en</dt>
                  <dd className="mt-0.5 font-semibold break-words text-ink">
                    {OCCURRED_DURING_LABEL[occurredDuring]}
                  </dd>
                </div>
              )}
              {!inEvaluation && (
                <div className="min-w-0">
                  <dt className="text-[13px] text-muted">Alta estimada</dt>
                  <dd className="mt-0.5 font-semibold break-words text-ink">
                    {injury.expected_return_on
                      ? formatDate(injury.expected_return_on)
                      : "Sin definir"}
                    {doctorEstimate && (
                      <span className="font-normal text-muted"> ({doctorEstimate} según el médico)</span>
                    )}
                  </dd>
                </div>
              )}
              <div className="min-w-0">
                <dt className="text-[13px] text-muted">Gravedad</dt>
                <dd className="mt-0.5 font-semibold break-words text-ink">
                  {severity ? SEVERITY_LABEL[severity] : "Por definir"}
                </dd>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-[13px] text-muted">Revisión</dt>
                <dd className="mt-0.5 font-semibold break-words text-ink">
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
              <p className="break-words whitespace-pre-line text-ink">{injury.description}</p>
            )}
          </section>

          {showReview && (
            <section className={`min-w-0 p-5 ${blockClass}`}>
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
        </div>

        <div className="min-w-0 space-y-6">
          {showPhases && (
            <section className="min-w-0">
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

          <section className="min-w-0">
            <SectionTitle className="mb-3">Documentos</SectionTitle>
            {!canSeeDocuments ? (
              <p className={`p-5 text-sm text-muted ${blockClass}`}>
                Los documentos médicos solo los ven el kinesiólogo y el head coach.
              </p>
            ) : documents && documents.length > 0 ? (
              <ul className="space-y-2">
                {documents.map((d) => {
                  const url = signedUrls.get(d.storage_path as string);
                  return (
                    <li
                      key={d.id}
                      className={`flex items-center justify-between gap-4 px-5 py-3 ${blockClass}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{d.file_name}</p>
                        <p className="text-sm text-muted">Subido el {formatDate(d.created_at)}</p>
                      </div>
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-text underline"
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
              <p className={`p-5 text-sm text-muted ${blockClass}`}>No hay documentos adjuntos.</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
