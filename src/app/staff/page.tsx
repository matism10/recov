import { redirect } from "next/navigation";
import { getActiveClubId, getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { ROLE_LABEL, isDirection, type UserRole } from "@/lib/roles";
import { getAvatarUrls } from "@/lib/avatars";
import { DelegateForm } from "./staff-forms";
import { chipClass } from "@/app/ui";
import { Card, CardHeader, PageHeader, PlayerCard, PlayerCardList } from "@/app/ui-blocks";
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
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 lg:max-w-[1200px] lg:px-8 lg:py-10">
      <PageHeader
        title="Staff del plantel"
        description="Toca a una persona para ver sus roles y permisos. Cada rol trae sus permisos; el head coach puede sumar o quitar permisos a cada persona."
      />

      <div className="space-y-6">
        <section>
          <CardHeader title="Staff" count={staff.length} />
          <PlayerCardList>
            {staff.map((p) => (
              <PlayerCard
                key={p.id}
                href={`/staff/${p.id}`}
                name={`${p.full_name ?? ""}${p.id === user.id ? " (tú)" : ""}`}
                photoUrl={avatarUrls.get(p.id)}
                secondary={
                  <>
                    {p.roles.map((r) => ROLE_LABEL[r]).join(", ")}
                    {p.id === delegateId && " · Funciones de kinesiólogo"}
                    {p.id === nominaDelegateId && " · Nóminas"}
                  </>
                }
                badge={
                  (isCoHeadCoach(p) || isCustomized(p)) && (
                    <span className="flex flex-wrap justify-end gap-1">
                      {isCoHeadCoach(p) && <span className={chipClass}>co</span>}
                      {isCustomized(p) && <span className={chipClass}>personalizado</span>}
                    </span>
                  )
                }
              />
            ))}
          </PlayerCardList>
        </section>

        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <Card as="section" id="funciones-kinesiologo" className="scroll-mt-4">
            <CardHeader
              title="Funciones de kinesiólogo"
              subtitle="Si el plantel no tiene kinesiólogo, delega sus funciones en alguien del staff: podrá revisar lesiones, ver documentos médicos y cambiar la disponibilidad."
            />
            <DelegateForm staff={delegateOptions} currentDelegateId={delegateId} />
          </Card>

          <Card as="section" id="delegado-nominas" className="scroll-mt-4">
            <CardHeader
              title="Nóminas"
              subtitle="El head coach y el manager arman la convocatoria de cada partido y cargan la participación. Puedes delegarlo también en alguien del staff."
            />
            <DelegateForm kind="nomina" staff={delegateOptions} currentDelegateId={nominaDelegateId} />
          </Card>
        </div>
      </div>
    </main>
  );
}
