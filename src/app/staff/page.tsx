import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL, isDirection, isStaff, type UserRole } from "@/lib/roles";
import { Avatar } from "@/app/avatar";
import { getAvatarUrls } from "@/lib/avatars";
import { DelegateForm, RolesForm } from "./staff-forms";
import { cardClass, chipClass, textButton } from "@/app/ui";

type StaffProfile = { id: string; full_name: string | null; roles: UserRole[] };

// Gestión del staff para la dirección (head coach y manager): roles, quitar del
// staff y delegación de las funciones de kinesiólogo.
export default async function StaffPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Desde 0005 hay dos relaciones profiles–clubs: hay que nombrar la FK.
  const { data: me } = await supabase
    .from("profiles")
    .select("roles, status, clubs!profiles_club_id_fkey(kine_delegate_id)")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.status === "pendiente") redirect("/pendiente");
  if (me?.status !== "confirmado" || !isDirection((me.roles ?? []) as UserRole[])) {
    redirect("/dashboard");
  }
  const club = Array.isArray(me.clubs) ? me.clubs[0] : me.clubs;
  const delegateId = (club?.kine_delegate_id as string | null) ?? null;

  // RLS: la dirección ve los perfiles de su club.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, roles")
    .eq("status", "confirmado")
    .order("full_name");

  const staff = ((profiles ?? []) as StaffProfile[]).filter((p) => isStaff(p.roles ?? []));
  const avatarUrls = await getAvatarUrls(
    supabase,
    staff.map((p) => p.id),
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:max-w-6xl lg:px-8">
      <header className="mb-8">
        <Link href="/dashboard" className={textButton}>
          ← Volver al plantel
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Staff del club</h1>
        <p className="mt-1 text-sm text-muted">
          Cambia los roles del staff y decide quién tiene las funciones de kinesiólogo.
        </p>
      </header>

      <div className="space-y-8">
        <section className={`p-5 ${cardClass}`}>
          <h2 className="font-medium text-ink">Funciones de kinesiólogo</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            Si el club no tiene kinesiólogo, delega sus funciones en alguien del staff:
            podrá revisar lesiones, ver documentos médicos y cambiar la disponibilidad.
          </p>
          <DelegateForm
            staff={staff.map(({ id, full_name }) => ({ id, full_name }))}
            currentDelegateId={delegateId}
          />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">
            Staff ({staff.length})
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl bg-mist border border-line">
            {staff.map((p) => {
              const isMe = p.id === user.id;
              return (
                // En escritorio: persona a la izquierda (1/4) y sus roles a la derecha (3/4).
                <li
                  key={p.id}
                  className="space-y-3 px-5 py-4 lg:grid lg:grid-cols-4 lg:items-center lg:gap-8 lg:space-y-0"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={p.full_name ?? ""} url={avatarUrls.get(p.id)} />
                    <div>
                      <p className="font-medium text-ink">
                        {p.full_name}
                        {isMe && <span className="font-normal text-muted"> (tú)</span>}
                        {p.id === delegateId && (
                          <span className={`ml-2 ${chipClass}`}>
                            Funciones de kinesiólogo
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-muted">
                        {p.roles.map((r) => ROLE_LABEL[r]).join(", ")}
                      </p>
                    </div>
                  </div>
                  <div className="lg:col-span-3">
                    {isMe ? (
                      <p className="text-xs text-muted">
                        No puedes cambiar tus propios roles.
                      </p>
                    ) : (
                      <RolesForm
                        profileId={p.id}
                        name={p.full_name ?? "esta persona"}
                        roles={p.roles}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
}
