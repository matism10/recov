import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getActiveClubId, getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { ROLE_LABEL, isDirection, type UserRole } from "@/lib/roles";
import { Avatar } from "@/app/avatar";
import { getAvatarUrls } from "@/lib/avatars";
import { DelegateForm } from "./staff-forms";
import { PageTitle, SectionTitle, cardClass, chipClass } from "@/app/ui";
import { isCoHeadCoach, isCustomized, loadStaff } from "./data";

// Gestión del staff para la dirección (head coach y manager): lista con roles y
// permisos (el detalle de cada persona está en /staff/[id]) y delegaciones.
export default async function StaffPage() {
  const supabase = await getSupabase();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const clubId = await getActiveClubId(user.id);
  const [me, staff] = await Promise.all([getProfile(user.id), loadStaff(supabase, clubId)]);

  if (me?.status === "pendiente") redirect("/pendiente");
  if (!me || me.status !== "confirmado" || !isDirection((me.roles ?? []) as UserRole[])) {
    redirect("/dashboard");
  }
  const avatarUrls = await getAvatarUrls(
    supabase,
    staff.map((p) => p.id),
  );
  const club = me.club;
  const delegateId = (club?.kine_delegate_id as string | null) ?? null;
  const nominaDelegateId = (club?.nomina_delegate_id as string | null) ?? null;
  const delegateOptions = staff.map(({ id, full_name }) => ({ id, full_name }));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:max-w-6xl lg:px-8">
      <header className="mb-8">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <PageTitle>Staff del plantel</PageTitle>
          <span className="text-sm font-medium text-brand-text">Maneja los permisos</span>
        </div>
        <p className="mt-1 text-sm text-muted">
          Toca a una persona para ver sus roles y permisos. Cada rol trae sus permisos;
          el head coach puede sumar o quitar permisos a cada persona.
        </p>
      </header>

      <div className="space-y-8">
        <section>
          <SectionTitle className="mb-3">Staff ({staff.length})</SectionTitle>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-mist">
            {staff.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/staff/${p.id}`}
                  className="flex min-h-16 items-center gap-3 px-5 py-3 hover:bg-white focus-visible:outline-2 focus-visible:outline-brand-strong"
                >
                  <Avatar name={p.full_name ?? ""} url={avatarUrls.get(p.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                      <span className="truncate">{p.full_name}</span>
                      {p.id === user.id && <span className="font-normal text-muted">(tú)</span>}
                      {isCoHeadCoach(p) && <span className={chipClass}>co</span>}
                      {isCustomized(p) && <span className={chipClass}>personalizado</span>}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {p.roles.map((r) => ROLE_LABEL[r]).join(", ")}
                      {p.id === delegateId && " · Funciones de kinesiólogo"}
                      {p.id === nominaDelegateId && " · Nóminas"}
                    </p>
                  </div>
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <section className={`p-5 ${cardClass}`}>
            <SectionTitle>Funciones de kinesiólogo</SectionTitle>
            <p className="mt-1 mb-4 text-sm text-muted">
              Si el plantel no tiene kinesiólogo, delega sus funciones en alguien del staff:
              podrá revisar lesiones, ver documentos médicos y cambiar la disponibilidad.
            </p>
            <DelegateForm staff={delegateOptions} currentDelegateId={delegateId} />
          </section>

          <section className={`p-5 ${cardClass}`}>
            <SectionTitle>Nóminas</SectionTitle>
            <p className="mt-1 mb-4 text-sm text-muted">
              El head coach y el manager arman la convocatoria de cada partido y cargan la
              participación. Puedes delegarlo también en alguien del staff.
            </p>
            <DelegateForm kind="nomina" staff={delegateOptions} currentDelegateId={nominaDelegateId} />
          </section>
        </div>
      </div>
    </main>
  );
}
