import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL, isDirection, type UserRole } from "@/lib/roles";
import { ReviewButtons } from "./review-buttons";

type PendingProfile = {
  id: string;
  full_name: string | null;
  requested_role: UserRole | null;
  created_at: string;
};

type PendingPlayer = {
  user_id: string;
  position: string | null;
  secondary_position: string | null;
  height_cm: number | null;
  weight_kg: number | null;
};

const dateFormat = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  timeZone: "America/Santiago",
});

function playerDetails(p: PendingPlayer) {
  return [
    p.position,
    p.secondary_position && `secundaria: ${p.secondary_position}`,
    p.height_cm && `${p.height_cm} cm`,
    p.weight_kg && `${p.weight_kg} kg`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default async function RegistrosPage() {
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
  if (me?.status !== "confirmado" || !isDirection((me.roles ?? []) as UserRole[])) {
    redirect("/dashboard");
  }

  // RLS: solo la dirección ve los perfiles y jugadores pendientes de su club.
  const [{ data: profiles }, { data: players }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, requested_role, created_at")
      .eq("status", "pendiente")
      .order("created_at"),
    supabase
      .from("players")
      .select("user_id, position, secondary_position, height_cm, weight_kg")
      .eq("status", "pendiente")
      .not("user_id", "is", null),
  ]);

  const playerByUser = new Map(
    ((players ?? []) as PendingPlayer[]).map((p) => [p.user_id, p]),
  );
  const pending = (profiles ?? []) as PendingProfile[];
  const pendingPlayers = pending.filter((p) => playerByUser.has(p.id));
  const pendingStaff = pending.filter((p) => !playerByUser.has(p.id));

  const sections = [
    {
      title: "Jugadores",
      items: pendingPlayers,
      details: (p: PendingProfile) => playerDetails(playerByUser.get(p.id)!),
    },
    {
      title: "Staff",
      items: pendingStaff,
      details: (p: PendingProfile) =>
        p.requested_role
          ? `Solicita: ${ROLE_LABEL[p.requested_role]}`
          : "Sin puesto solicitado",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-8">
        <Link href="/dashboard" className="text-sm text-slate-500 underline">
          ← Volver al plantel
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Registros pendientes
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Confirma a quienes se registraron con el link del club.
        </p>
      </header>

      {pending.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-slate-500 ring-1 ring-slate-200">
          No hay registros pendientes.
        </p>
      ) : (
        <div className="space-y-8">
          {sections
            .filter((s) => s.items.length > 0)
            .map((s) => (
              <section key={s.title}>
                <h2 className="mb-3 text-sm font-medium text-slate-500">
                  {s.title} ({s.items.length})
                </h2>
                <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
                  {s.items.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {p.full_name}
                        </p>
                        <p className="text-sm text-slate-500">{s.details(p)}</p>
                        <p className="text-xs text-slate-400">
                          Registrado el {dateFormat.format(new Date(p.created_at))}
                        </p>
                      </div>
                      <ReviewButtons profileId={p.id} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}
    </main>
  );
}
