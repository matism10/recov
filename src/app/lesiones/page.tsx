import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isStaff, type UserRole } from "@/lib/roles";
import { formatDate, type InjuryStatus } from "@/lib/injuries";
import { InjuryProgress } from "./injury-progress";
import { InjuryStatusBadge, PageTitle, SectionTitle, cardClass, textButton } from "@/app/ui";

const OPEN_STATUSES: InjuryStatus[] = ["en_evaluacion", "activa"];

type InjuryRow = {
  id: string;
  type: string;
  status: InjuryStatus;
  started_on: string;
  expected_return_on: string | null;
  closed_on: string | null;
  players: { full_name: string } | { full_name: string }[] | null;
};

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
    .select("id, type, status, started_on, expected_return_on, closed_on, players(full_name)")
    .order("started_on", { ascending: false });
  const injuries = (data ?? []) as InjuryRow[];
  const open = injuries.filter((i) => OPEN_STATUSES.includes(i.status));
  const past = injuries.filter((i) => !OPEN_STATUSES.includes(i.status));

  const sections = [
    { title: "Abiertas", items: open, empty: "No hay lesiones abiertas." },
    { title: "Historial", items: past, empty: "Aún no hay lesiones cerradas o descartadas." },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:max-w-6xl lg:px-8">
      <header className="mb-8">
        {/* En escritorio se vuelve por la sidebar. */}
        <Link href="/dashboard" className={`${textButton} lg:hidden`}>
          ← Volver al resumen
        </Link>
        <PageTitle className="mt-2 lg:mt-0">Lesiones</PageTitle>
        <p className="mt-1 text-sm text-muted">
          {staff ? "Lesiones del plantel, abiertas y pasadas." : "Tus lesiones, abiertas y pasadas."}
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
                  const player = Array.isArray(i.players) ? i.players[0] : i.players;
                  return (
                    <li key={i.id}>
                      <Link
                        href={`/lesiones/${i.id}`}
                        className="block space-y-2 px-5 py-4 transition hover:bg-white"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-ink">
                              {staff && player ? `${player.full_name} · ${i.type}` : i.type}
                            </p>
                            <p className="text-sm text-muted">
                              Desde el {formatDate(i.started_on)}
                              {i.closed_on && ` · hasta el ${formatDate(i.closed_on)}`}
                            </p>
                          </div>
                          <InjuryStatusBadge status={i.status} />
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
