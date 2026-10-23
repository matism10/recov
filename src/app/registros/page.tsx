import { redirect } from "next/navigation";
import { getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { ROLE_LABEL, isDirection, type UserRole } from "@/lib/roles";
import { ReviewButtons } from "./review-buttons";
import { PageTitle, SectionTitle } from "@/app/ui";

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

export default async function RegistrosPage({
  searchParams,
}: {
  searchParams: Promise<{ correo?: string }>;
}) {
  const { correo } = await searchParams;
  const supabase = await getSupabase();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // En paralelo: perfil y los registros pendientes. RLS: solo la dirección ve los
  // perfiles y jugadores pendientes de su club; sin acceso se redirige antes de mostrar.
  const [me, { data: profiles }, { data: players }] = await Promise.all([
    getProfile(user.id),
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

  if (me?.status === "pendiente") redirect("/pendiente");
  if (me?.status !== "confirmado" || !isDirection((me.roles ?? []) as UserRole[])) {
    redirect("/dashboard");
  }

  const playerByUser = new Map(
    ((players ?? []) as PendingPlayer[]).map((p) => [p.user_id, p]),
  );
  const pending = (profiles ?? []) as PendingProfile[];
  const pendingPlayers = pending.filter((p) => playerByUser.has(p.id));
  const pendingStaff = pending.filter((p) => !playerByUser.has(p.id));

  const sections = [
    {
      title: "Jugadores",
      detailsLabel: "Posición y medidas",
      items: pendingPlayers,
      details: (p: PendingProfile) => playerDetails(playerByUser.get(p.id)!),
      tableDetails: (p: PendingProfile) => playerDetails(playerByUser.get(p.id)!),
    },
    {
      title: "Staff",
      detailsLabel: "Puesto solicitado",
      items: pendingStaff,
      details: (p: PendingProfile) =>
        p.requested_role
          ? `Solicita: ${ROLE_LABEL[p.requested_role]}`
          : "Sin puesto solicitado",
      // En la tabla la columna ya dice "Puesto solicitado": sin prefijo.
      tableDetails: (p: PendingProfile) =>
        p.requested_role ? ROLE_LABEL[p.requested_role] : "Sin puesto solicitado",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:max-w-6xl lg:px-8">
      <header className="mb-8">
        <PageTitle>Registros pendientes</PageTitle>
        <p className="mt-1 text-sm text-muted">
          Confirma a quienes se registraron con el link del club.
        </p>
      </header>

      {/* Tras confirmar: la decisión quedó guardada, pero el correo no salió. */}
      {correo === "no-enviado" && (
        <p role="status" className="mb-6 rounded-xl border border-line bg-mist px-4 py-3 text-sm text-ink">
          Aprobado, pero no pudimos enviar el correo. Avísale tú que ya puede entrar.
        </p>
      )}

      {pending.length === 0 ? (
        <p className="rounded-xl bg-mist p-8 text-center text-muted border border-line">
          No hay registros pendientes.
        </p>
      ) : (
        <div className="space-y-8">
          {sections
            .filter((s) => s.items.length > 0)
            .map((s) => (
              <section key={s.title}>
                <SectionTitle className="mb-3">
                  {s.title} ({s.items.length})
                </SectionTitle>
                <ul className="divide-y divide-line overflow-hidden rounded-xl bg-mist border border-line lg:hidden">
                  {s.items.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                    >
                      <div>
                        <p className="font-medium text-ink">
                          {p.full_name}
                        </p>
                        <p className="text-sm text-muted">{s.details(p)}</p>
                        <p className="text-xs text-muted">
                          Registrado el {dateFormat.format(new Date(p.created_at))}
                        </p>
                      </div>
                      <ReviewButtons profileId={p.id} />
                    </li>
                  ))}
                </ul>
                {/* En escritorio, la misma lista como tabla. */}
                <div className="hidden overflow-x-auto rounded-xl border border-line bg-mist lg:block">
                  <table className="w-full text-left">
                    <thead className="text-sm text-muted">
                      <tr className="border-b border-line">
                        <th scope="col" className="py-3 pr-3 pl-5 font-medium">
                          Nombre
                        </th>
                        <th scope="col" className="px-3 py-3 font-medium">
                          {s.detailsLabel}
                        </th>
                        <th scope="col" className="px-3 py-3 font-medium">
                          Registrado
                        </th>
                        <th scope="col" className="py-3 pr-5 pl-3 text-right font-medium">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {s.items.map((p) => (
                        <tr key={p.id}>
                          <td className="py-4 pr-3 pl-5 font-medium text-ink">
                            {p.full_name}
                          </td>
                          <td className="px-3 py-4 text-sm text-muted">{s.tableDetails(p)}</td>
                          <td className="px-3 py-4 text-sm whitespace-nowrap text-muted">
                            {dateFormat.format(new Date(p.created_at))}
                          </td>
                          <td className="py-4 pr-5 pl-3">
                            <ReviewButtons profileId={p.id} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
        </div>
      )}
    </main>
  );
}
