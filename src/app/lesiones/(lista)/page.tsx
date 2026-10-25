import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getActiveClubId, getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { isStaff, type UserRole } from "@/lib/roles";
import { formatDate, type InjuryStatus } from "@/lib/injuries";
import { getAvatarUrls } from "@/lib/avatars";
import { Avatar } from "@/app/avatar";
import { InjuryProgress } from "../injury-progress";
import { InjuryStatusBadge, PageTitle, SectionTitle, buttonSecondary, cardClass } from "@/app/ui";

const OPEN_STATUSES: InjuryStatus[] = ["en_evaluacion", "activa"];
const PAST_STATUSES: InjuryStatus[] = ["cerrada", "descartada"];

// Historial: se muestran las 30 más recientes y "Ver más" suma otras 30.
const HISTORY_PAGE = 30;
const HISTORY_MAX = 600;

type InjuryRow = {
  id: string;
  type: string;
  status: InjuryStatus;
  started_on: string;
  expected_return_on: string | null;
  closed_on: string | null;
  players: PlayerRef | PlayerRef[] | null;
};

type PlayerRef = { full_name: string; user_id: string | null };

// Lesiones del club para el staff; para el jugador, solo las suyas (lo decide RLS).
export default async function InjuriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { historial } = await searchParams;
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
    "id, type, status, started_on, expected_return_on, closed_on, players(full_name, user_id)";
  // Solo las del plantel activo (RLS trae las de todos los planteles de la cuenta).
  const clubId = await getActiveClubId(user.id);
  const [me, { data: openRows }, { data: pastRows, count: pastTotal }] = await Promise.all([
    getProfile(user.id),
    supabase
      .from("injuries")
      .select(columns)
      .eq("club_id", clubId)
      .in("status", OPEN_STATUSES)
      .order("started_on", { ascending: false }),
    supabase
      .from("injuries")
      .select(columns, { count: "exact" })
      .eq("club_id", clubId)
      .in("status", PAST_STATUSES)
      .order("started_on", { ascending: false })
      .range(0, historyLimit - 1),
  ]);

  if (me?.status === "pendiente") redirect("/pendiente");
  if (me?.status !== "confirmado") redirect("/dashboard");
  const staff = isStaff((me.roles ?? []) as UserRole[]);

  const open = (openRows ?? []) as InjuryRow[];
  const past = (pastRows ?? []) as InjuryRow[];
  const injuries = [...open, ...past];
  const pastCount = pastTotal ?? past.length;
  const playerOf = (i: InjuryRow) => (Array.isArray(i.players) ? i.players[0] : i.players);
  // Foto de cada jugador, solo para el staff (el jugador ve sus propias lesiones,
  // sin avatar ni nombre). RLS: solo fotos de perfiles visibles para quien consulta.
  const avatarUrls = staff
    ? await getAvatarUrls(
        supabase,
        injuries.map((i) => playerOf(i)?.user_id),
      )
    : new Map<string, string>();

  const sections = [
    { title: "Actuales", items: open, total: open.length, empty: "No hay lesiones actuales." },
    {
      title: "Historial",
      items: past,
      total: pastCount,
      empty: "Aún no hay lesiones cerradas o descartadas.",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:max-w-6xl lg:px-8">
      <header className="mb-8">
        <PageTitle>Lesiones</PageTitle>
        <p className="mt-1 text-sm text-muted">
          {staff ? "Lesiones del plantel, actuales y pasadas." : "Tus lesiones, actuales y pasadas."}
        </p>
      </header>

      <div className="space-y-8">
        {sections.map((s) => (
          <section key={s.title}>
            <SectionTitle className="mb-3">
              {s.title} ({s.total})
            </SectionTitle>
            {s.items.length > 0 ? (
              <ul className="divide-y divide-line overflow-hidden rounded-xl bg-mist border border-line">
                {s.items.map((i) => {
                  const player = playerOf(i);
                  // Staff: jugador arriba y lesión debajo. Jugador: la lesión es el título.
                  const showPlayer = staff && player;
                  return (
                    <li key={i.id}>
                      <Link
                        href={`/lesiones/${i.id}`}
                        className="block min-h-11 space-y-2 px-5 py-4 transition hover:bg-white"
                      >
                        <div className="flex items-center gap-3">
                          {showPlayer && (
                            <Avatar
                              name={player.full_name}
                              url={player.user_id ? avatarUrls.get(player.user_id) : null}
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-ink">
                              {showPlayer ? player.full_name : i.type}
                            </p>
                            {showPlayer && <p className="text-sm text-ink">{i.type}</p>}
                            <p className="text-sm text-muted">
                              Desde el {formatDate(i.started_on)}
                              {i.closed_on && ` · hasta el ${formatDate(i.closed_on)}`}
                            </p>
                          </div>
                          <InjuryStatusBadge status={i.status} />
                          <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted" />
                        </div>
                        {i.status === "activa" && (
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
              <p className={`p-5 text-sm text-muted ${cardClass}`}>{s.empty}</p>
            )}
            {s.items.length < s.total && s.items.length < HISTORY_MAX && (
              <Link
                href={`/lesiones?historial=${s.items.length + HISTORY_PAGE}`}
                scroll={false}
                className={`mt-3 w-full text-sm sm:w-auto ${buttonSecondary}`}
              >
                Ver más ({s.total - s.items.length} más)
              </Link>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
