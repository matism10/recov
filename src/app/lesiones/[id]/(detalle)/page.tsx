import type { ReactNode } from "react";
import Link from "next/link";
import { BackLink } from "@/app/back-link";
import { Hourglass } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { getProfile, getSessionUser, getSupabase } from "@/lib/session";
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
  NoDocumentBadge,
  PageTitle,
  buttonPrimary,
} from "@/app/ui";
import { Card, CardHeader } from "@/app/ui-blocks";
import { BodyMapPair } from "@/app/body-map";
import { LATERALITY_LABEL, isBodyZone, isLaterality, zoneLabel } from "@/lib/body-zones";
import { OwnDocuments } from "../own-documents";
import { PhasesPanel } from "../phases-panel";
import { ReviewForm } from "../review-form";

function Fact({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? "sm:col-span-2 lg:col-span-4" : ""}`}>
      <dt className="text-13 text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold break-words text-ink">{children}</dd>
    </div>
  
  );
}

const SIGNED_URL_SECONDS = 5 * 60;

export default async function InjuryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabase();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // En paralelo: perfil (con el club y su delegado), la lesión, sus documentos y
  // sus fases. RLS decide qué devuelve cada una; nada se muestra antes de los
  // controles de acceso de abajo.
  const [me, { data: injury }, { data: documents }, { data: phases }] = await Promise.all([
    getProfile(user.id),
    // RLS: el staff ve las lesiones del club; el jugador, solo las suyas.
    supabase
      .from("injuries")
      .select(
        "id, club_id, player_id, type, body_zone, laterality, severity, status, description, started_on, expected_return_on, doctor_estimate_value, doctor_estimate_unit, occurred_during, reviewed_by, reviewed_at, players(full_name, availability, user_id)",
      )
      .eq("id", id)
      .maybeSingle(),
    // RLS: el jugador ve los suyos; del staff, solo quien tiene acceso a documentos médicos.
    supabase
      .from("documents")
      .select("id, file_name, storage_path, status, created_at")
      .eq("injury_id", id)
      .order("created_at"),
    // RLS: el staff ve las fases del club; el jugador, las de sus lesiones.
    supabase
      .from("injury_phases")
      .select("id, name, status, started_on, ended_on")
      .eq("injury_id", id)
      .is("archived_at", null)
      .order("position"),
  ]);

  if (me?.status === "pendiente") redirect("/pendiente");
  if (!me || me.status !== "confirmado") redirect("/dashboard");
  if (!injury) notFound();

  const roles = (me.roles ?? []) as UserRole[];
  const staff = isStaff(roles);
  // Solo decide qué se muestra; review_injury valida el permiso real.
  const canManage = canManageInjuries(roles, user.id, me.club?.kine_delegate_id);
  const canSeeDocuments = !staff || canManage;

  const player = Array.isArray(injury.players) ? injury.players[0] : injury.players;
  const isOwnInjury = player?.user_id === user.id;

  // Lo que depende de la lesión, en paralelo: quién la revisó, la foto del jugador,
  // su teléfono (solo staff y en lesión ajena; get_player_phone devuelve null a quien
  // no corresponde, 0030) y los enlaces de los documentos (vencen a los 5 minutos).
  const [{ data: reviewer }, playerAvatarUrl, { data: phone }, signedUrls] = await Promise.all([
    injury.reviewed_by
      ? supabase.from("profiles").select("full_name").eq("id", injury.reviewed_by).maybeSingle()
      : Promise.resolve({ data: null }),
    // Foto del jugador. RLS: solo fotos de perfiles visibles para quien consulta.
    player?.user_id
      ? getAvatarUrls(supabase, [player.user_id]).then((m) => m.get(player.user_id!) ?? null)
      : null,
    staff && !isOwnInjury
      ? supabase.rpc("get_player_phone", { p_player_id: injury.player_id })
      : Promise.resolve({ data: null }),
    (async () => {
      const urls = new Map<string, string>();
      if (!documents || documents.length === 0) return urls;
      const { data } = await supabase.storage.from("medical-docs").createSignedUrls(
        documents.map((d) => d.storage_path as string),
        SIGNED_URL_SECONDS,
      );
      for (const u of data ?? []) if (u.path && u.signedUrl) urls.set(u.path, u.signedUrl);
      return urls;
    })(),
  ]);

  const status = injury.status as InjuryStatus;
  const inEvaluation = status === "en_evaluacion";
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
  // Zona y lado (registro v2). Las lesiones antiguas no tienen zona.
  const zone =
    isBodyZone(injury.body_zone) && isLaterality(injury.laterality)
      ? { zone: injury.body_zone, laterality: injury.laterality }
      : null;
  // Kine, delegado y head coach ven si la lesión llegó sin documento (los ven por RLS).
  const missingDocument = canManage && !isOwnInjury && (documents?.length ?? 0) === 0;
  // El jugador puede cambiar sus documentos mientras nadie revisa la lesión.
  const documentsEditable = isOwnInjury && status === "activa" && !injury.reviewed_at;
  const progress =
    !inEvaluation && injury.expected_return_on
      ? recoveryProgress(injury.started_on, injury.expected_return_on)
      : null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 lg:max-w-[1080px] lg:px-8 lg:py-10">
      <BackLink fallback="/lesiones">← Volver</BackLink>

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

      {/* Encabezado en Card: jugador (enlace a su ficha solo para el staff, la misma
          guarda de /jugadores/[id]), lesión, estado, avance y franja de datos. */}
      <Card as="header" className="mt-2 space-y-4">
        {player &&
          (staff ? (
            <Link
              href={`/jugadores/${injury.player_id}`}
              className="flex w-fit max-w-full min-h-11 items-center gap-3 font-semibold text-brand-text hover:underline"
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
          {missingDocument && <NoDocumentBadge />}
        </div>
        {phone && player && <WhatsAppButton phone={phone as string} name={player.full_name} />}

        {!inEvaluation &&
          (progress ? (
            <section aria-label="Avance hacia el alta" className="space-y-2">
              <p className="text-2xl leading-8 font-bold tabular-nums text-ink">
                Día {progress.day} de {progress.total}
              </p>
              <div
                role="progressbar"
                aria-valuenow={progress.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Avance hacia el alta"
                className="h-2 overflow-hidden rounded-sm bg-line"
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

        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Desde">{formatDate(injury.started_on)}</Fact>
          {occurredDuring && <Fact label="Dónde ocurrió">{OCCURRED_DURING_LABEL[occurredDuring]}</Fact>}
          {zone && <Fact label="Zona">{zoneLabel(zone.zone, "no_aplica")}</Fact>}
          {zone && <Fact label="Lado">{LATERALITY_LABEL[zone.laterality]}</Fact>}
          <Fact label="Gravedad">{severity ? SEVERITY_LABEL[severity] : "Por definir"}</Fact>
          {!inEvaluation && (
            <Fact label="Duración indicada">
              {doctorEstimate ? `${doctorEstimate} según el médico` : "Sin definir"}
            </Fact>
          )}
          {injury.description && (
            <Fact label="Detalle" wide>
              <span className="font-normal whitespace-pre-line">{injury.description}</span>
            </Fact>
          )}
        </dl>
      </Card>

      {/* Móvil: un bloque bajo otro. Escritorio: revisión (o estado confirmado) a la
          izquierda; fases y documentos a la derecha. */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0 space-y-6">
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

          {showReview ? (
            <Card as="section" className="min-w-0">
              <CardHeader title="Revisión" />
              <ReviewForm
                injuryId={injury.id}
                status={status}
                startedOn={injury.started_on}
                expectedReturnOn={injury.expected_return_on}
                severity={severity}
                availability={(player?.availability ?? "disponible") as Availability}
                reviewed={!!injury.reviewed_at}
              />
            </Card>
          ) : (
            <Card as="section" className="min-w-0">
              <CardHeader title="Revisión" />
              <p className="text-ink">
                {inEvaluation
                  ? "Esperando el diagnóstico del jugador"
                  : injury.reviewed_at
                    ? `Revisada el ${formatDate(injury.reviewed_at)}${
                        reviewer?.full_name ? ` por ${reviewer.full_name}` : ""
                      }`
                    : "Pendiente de revisión del kinesiólogo"}
              </p>
            </Card>
          )}

          {zone && (
            <Card as="section">
              <CardHeader title="Zona de la lesión" />
              <BodyMapPair heat={[zone]} className="mx-auto max-w-sm" />
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          {showPhases && (
            <Card as="section" className="min-w-0">
              <CardHeader title="Fases de recuperación" />
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
            </Card>
          )}

          <Card as="section" className="min-w-0">
            <CardHeader title="Documentos" />
            {isOwnInjury ? (
              <OwnDocuments
                injuryId={injury.id}
                clubId={injury.club_id}
                playerId={injury.player_id}
                editable={documentsEditable}
                documents={(documents ?? []).map((d) => ({
                  id: d.id,
                  file_name: d.file_name,
                  created_at: d.created_at,
                  status: d.status,
                  url: signedUrls.get(d.storage_path as string) ?? null,
                }))}
              />
            ) : !canSeeDocuments ? (
              <p className="text-sm text-muted">
                Los documentos médicos solo los ven el kinesiólogo y el head coach.
              </p>
            ) : documents && documents.length > 0 ? (
              <ul className="divide-y divide-line">
                {documents.map((d) => {
                  const url = signedUrls.get(d.storage_path as string);
                  return (
                    <li key={d.id} className="flex min-h-14 items-center justify-between gap-4 py-2">
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
              <p className="text-sm text-muted">No hay documentos adjuntos.</p>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}
