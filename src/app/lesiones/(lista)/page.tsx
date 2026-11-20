import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveClubId, getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { canManageInjuries, isStaff, type Availability, type UserRole } from "@/lib/roles";
import { isBodyZone, isLaterality, zoneLabel } from "@/lib/body-zones";
import { formatDate, recoveryProgress, returnLabel, todayInChile, type InjuryStatus } from "@/lib/injuries";
import { getAvatarUrls } from "@/lib/avatars";
import { formatPlayerIds } from "@/lib/format";
import { InjuryStatusBadge, buttonPrimary, buttonSecondary } from "@/app/ui";
import { EmptyState, PageHeader, PlayerCard, PlayerCardList } from "@/app/ui-blocks";
import { REGISTRAR_LESION_HREF } from "@/app/nav-items";
import { CurrentInjuries, type CurrentItem } from "./injury-lists";

const OPEN_STATUSES: InjuryStatus[] = ["en_evaluacion", "activa"];
const PAST_STATUSES: InjuryStatus[] = ["cerrada", "descartada"];

// Historial: se muestran las 20 más recientes y "Ver más" suma otras 20.
const HISTORY_PAGE = 20;
const HISTORY_MAX = 600;

type InjuryRow = {
  id: string;
  type: string;
  status: InjuryStatus;
  started_on: string;
  expected_return_on: string | null;
  closed_on: string | null;
  body_zone: string | null;
  laterality: string | null;
  reviewed_at: string | null;
  // Conteo embebido (RLS: solo cuenta para quien puede ver documentos).
  documents: { count: number }[] | null;
  players: PlayerRef | PlayerRef[] | null;
};

// Título de la lesión: zona y lado si los tiene (registro v2); si no, el tipo libre.
function injuryTitle(i: InjuryRow) {
  return isBodyZone(i.body_zone) && isLaterality(i.laterality) ? zoneLabel(i.body_zone, i.laterality) : i.type;
}

type PlayerRef = { full_name: string; user_id: string | null; availability: Availability };

// Lesiones del club para el staff; para el jugador, solo las suyas (lo decide RLS).
export default async function InjuriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { historial, tab: tabParam } = await searchParams;
  const tab = (Array.isArray(tabParam) ? tabParam[0] : tabParam) === "historial" ? "historial" : "actuales";
  const requested = Number(Array.isArray(historial) ? historial[0] : historial);
  const historyLimit = Number.isInteger(requested)
    ? Math.min(Math.max(requested, HISTORY_PAGE), HISTORY_MAX)
    : HISTORY_PAGE;

  const supabase = await getSupabase();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // RLS: el staff ve las lesiones del club; el jugador, solo las suyas. Actuales
  // completas; del historial, las más recientes (con el total para el título).
  const columns =
    "id, type, status, started_on, expected_return_on, closed_on, body_zone, laterality, reviewed_at, documents(count), players(full_name, user_id, availability)";
  // Solo las del plantel activo (RLS trae las de todos los planteles de la cuenta).
  // En Sevens, solo las lesiones de los jugadores del grupo Sevens.
  const [clubId, sevensIds] = await Promise.all([getActiveClubId(user.id), formatPlayerIds(user.id)]);
  let openQuery = supabase
    .from("injuries")
    .select(columns)
    .eq("club_id", clubId)
    .in("status", OPEN_STATUSES);
  let pastQuery = supabase
    .from("injuries")
    .select(columns, { count: "exact" })
    .eq("club_id", clubId)
    .in("status", PAST_STATUSES);
  if (sevensIds) {
    openQuery = openQuery.in("player_id", sevensIds);
    pastQuery = pastQuery.in("player_id", sevensIds);
  }
  const [me, { data: openRows }, { data: pastRows, count: pastTotal }] = await Promise.all([
    getProfile(user.id),
    openQuery.order("started_on", { ascending: false }),
    pastQuery.order("started_on", { ascending: false }).range(0, historyLimit - 1),
  ]);

  if (me?.status === "pendiente") redirect("/pendiente");
  if (me?.status !== "confirmado") redirect("/dashboard");
  const staff = isStaff((me.roles ?? []) as UserRole[]);
  // "Sin documento": solo para quien ve documentos (kine, delegado y head coach).
  const canManage = canManageInjuries((me.roles ?? []) as UserRole[], user.id, me.club?.kine_delegate_id);

  const open = (openRows ?? []) as InjuryRow[];
  const past = (pastRows ?? []) as InjuryRow[];
  const pastCount = pastTotal ?? past.length;
  const playerOf = (i: InjuryRow) => (Array.isArray(i.players) ? i.players[0] : i.players);
  // Foto de cada jugador, solo para el staff y solo de la pestaña visible (el jugador
  // ve sus propias lesiones, sin avatar ni nombre). RLS: solo fotos visibles para quien consulta.
  const shown = tab === "actuales" ? open : past;
  const avatarUrls = staff
    ? await getAvatarUrls(
        supabase,
        shown.map((i) => playerOf(i)?.user_id),
      )
    : new Map<string, string>();

  // Actuales: por revisar (en evaluación o activas sin revisar) y en recuperación,
  // estas últimas por fecha de regreso (hoy y vencidas primero, sin fecha al final).
  const toReview = (i: InjuryRow) => i.status === "en_evaluacion" || !i.reviewed_at;
  const byReturn = (a: InjuryRow, b: InjuryRow) =>
    (a.expected_return_on ?? "9999-12-31").localeCompare(b.expected_return_on ?? "9999-12-31");
  const ordered = [...open.filter(toReview), ...open.filter((i) => !toReview(i)).sort(byReturn)];
  const currentItems: CurrentItem[] = ordered.map((i) => {
    const player = playerOf(i);
    const review = toReview(i);
    const title = injuryTitle(i);
    // Sin el año si es el actual: la línea es corta y se corta en el celular.
    const since = `desde el ${formatDate(i.started_on).replace(new RegExp(` ${todayInChile().slice(0, 4)}$`), "")}`;
    const detail = review ? since : returnLabel(i.expected_return_on);
    const noDocument = review && canManage && staff && (i.documents?.[0]?.count ?? 0) === 0;
    return {
      id: i.id,
      name: staff && player ? player.full_name : title,
      photoUrl: staff && player?.user_id ? (avatarUrls.get(player.user_id) ?? null) : null,
      group: review ? "revisar" : "recuperacion",
      // Con "sin documento" a la vista, la línea no alcanza para la zona.
      secondary: staff && !noDocument ? `${title} · ${detail}` : detail.charAt(0).toUpperCase() + detail.slice(1),
      noDocument,
      progress:
        i.status === "activa" && i.expected_return_on
          ? recoveryProgress(i.started_on, i.expected_return_on).percent
          : undefined,
      availability: player?.availability ?? "disponible",
      reviewBadge: review ? (i.status === "en_evaluacion" ? "Esperando" : canManage ? "Revisar" : "Sin revisar") : undefined,
    };
  });

  const tabs = [
    { id: "actuales", label: `Actuales (${open.length})`, href: "/lesiones?tab=actuales" },
    { id: "historial", label: `Historial (${pastCount})`, href: "/lesiones?tab=historial" },
  ];

  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 lg:px-8 lg:py-10">
      <PageHeader
        title={staff ? "Lesiones" : "Mis lesiones"}
        description={staff ? "Lesiones del plantel, actuales y pasadas." : "Tus lesiones, actuales y pasadas."}
        actions={
          <>
            <nav aria-label="Lesiones" className="flex w-full gap-1 rounded-xl bg-mist p-1 sm:w-auto">
              {tabs.map((t) => (
                <Link
                  key={t.id}
                  href={t.href}
                  aria-current={t.id === tab ? "page" : undefined}
                  className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-4 text-sm font-medium whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-brand-strong ${
                    t.id === tab ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
            {!staff && (
              <Link href={REGISTRAR_LESION_HREF} className={`${buttonPrimary} w-full sm:w-auto`}>
                Registrar lesión
              </Link>
            )}
          </>
        }
      />

      {tab === "actuales" ? (
        currentItems.length > 0 ? (
          <CurrentInjuries items={currentItems} showPlayer={staff} withFilters={staff} />
        ) : (
          <EmptyState title="No hay lesiones actuales" />
        )
      ) : past.length > 0 ? (
        <>
          <PlayerCardList className="lg:grid lg:grid-cols-2">
            {past.map((i) => {
              const player = playerOf(i);
              const title = injuryTitle(i);
              const when = `${i.status === "cerrada" ? "Alta el" : "Descartada el"} ${formatDate(i.closed_on ?? i.started_on)}`;
              return (
                <PlayerCard
                  key={i.id}
                  href={`/lesiones/${i.id}`}
                  name={staff && player ? player.full_name : title}
                  photoUrl={staff && player?.user_id ? avatarUrls.get(player.user_id) : null}
                  showAvatar={staff}
                  secondary={staff ? `${title} · ${when}` : when}
                  badge={<InjuryStatusBadge status={i.status} />}
                />
              );
            })}
          </PlayerCardList>
          {past.length < pastCount && past.length < HISTORY_MAX && (
            <Link
              href={`/lesiones?tab=historial&historial=${past.length + HISTORY_PAGE}`}
              scroll={false}
              className={`mt-3 w-full text-sm sm:w-auto ${buttonSecondary}`}
            >
              Ver más ({pastCount - past.length} más)
            </Link>
          )}
        </>
      ) : (
        <EmptyState title="Aún no hay lesiones en el historial" />
      )}
    </main>
  );
}
