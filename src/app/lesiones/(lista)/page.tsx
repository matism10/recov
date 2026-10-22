import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isStaff, type UserRole } from "@/lib/roles";
import { formatDate, type InjuryStatus } from "@/lib/injuries";
import { getAvatarUrls } from "@/lib/avatars";
import { Avatar } from "@/app/avatar";
import { InjuryProgress } from "../injury-progress";
import { InjuryStatusBadge, PageTitle, SectionTitle, cardClass } from "@/app/ui";

const OPEN_STATUSES: InjuryStatus[] = ["en_evaluacion", "activa"];

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
export default async function InjuriesPage() {
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
  if (me?.status !== "confirmado") redirect("/dashboard");
  const staff = isStaff((me.roles ?? []) as UserRole[]);

  // RLS: el staff ve las lesiones del club; el jugador, solo las suyas.
  const { data } = await supabase
    .from("injuries")
    .select(
      "id, type, status, started_on, expected_return_on, closed_on, players(full_name, user_id)",
    )
    .order("started_on", { ascending: false });
  const injuries = (data ?? []) as InjuryRow[];
  const open = injuries.filter((i) => OPEN_STATUSES.includes(i.status));
  const past = injuries.filter((i) => !OPEN_STATUSES.includes(i.status));
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
    { title: "Actuales", items: open, empty: "No hay lesiones actuales." },
    { title: "Historial", items: past, empty: "Aún no hay lesiones cerradas o descartadas." },
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
              {s.title} ({s.items.length})
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
          </section>
        ))}
      </div>
    </main>
  );
}
