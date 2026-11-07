import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getActiveClubId, getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { ROLE_LABEL, isDirection, type UserRole } from "@/lib/roles";
import { Avatar } from "@/app/avatar";
import { getAvatarUrls } from "@/lib/avatars";
import { PageTitle, SectionTitle, cardClass, chipClass } from "@/app/ui";
import { HeadCoachButton, PermissionSwitches, ResetPermissionsButton, RolesForm } from "../staff-forms";
import { extraCount, isCoHeadCoach, isCustomized, loadStaff, removedCount } from "../data";

// Detalle de una persona del staff: chips de rol, roles, permisos agrupados con
// interruptores y "Restablecer al rol". Solo el head coach edita permisos y nombra
// head coach; el manager ve los permisos y cambia roles (salvo head coach).
export default async function StaffMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabase();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const clubId = await getActiveClubId(user.id);
  const [me, staff] = await Promise.all([getProfile(user.id), loadStaff(supabase, clubId)]);
  if (me?.status === "pendiente") redirect("/pendiente");
  const myRoles = (me?.roles ?? []) as UserRole[];
  if (!me || me.status !== "confirmado" || !isDirection(myRoles)) redirect("/dashboard");

  const p = staff.find((s) => s.id === id);
  if (!p) notFound();
  const avatarUrls = await getAvatarUrls(supabase, [p.id]);

  const isMe = p.id === user.id;
  const iAmHeadCoach = myRoles.includes("head_coach");
  const iAmPrincipal = staff.some((s) => s.id === user.id && s.isPrincipal);
  const targetIsHeadCoach = p.roles.includes("head_coach");
  const name = p.full_name ?? "esta persona";
  const extra = extraCount(p);
  const removed = removedCount(p);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:px-8">
      <Link href="/staff" className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft aria-hidden className="size-4" /> Staff
      </Link>

      <header className="mb-6 flex items-center gap-4">
        <Avatar name={p.full_name ?? ""} url={avatarUrls.get(p.id)} />
        <div className="min-w-0">
          <PageTitle>{p.full_name}</PageTitle>
          <div className="mt-2 flex flex-wrap gap-2">
            {p.roles.map((r) => (
              <span key={r} className={chipClass}>
                {ROLE_LABEL[r]}
              </span>
            ))}
            {p.isPrincipal && <span className={chipClass}>Head coach principal</span>}
            {isCoHeadCoach(p) && <span className={chipClass}>co</span>}
          </div>
        </div>
      </header>

      <div className="space-y-6">
        <section className={`p-5 ${cardClass}`}>
          <SectionTitle className="mb-3">Roles</SectionTitle>
          {isMe ? (
            <p className="text-sm text-muted">No puedes cambiar tus propios roles.</p>
          ) : p.isPrincipal ? (
            <p className="text-sm text-muted">
              Es el head coach principal del plantel: nadie puede quitarlo ni cambiar sus roles.
            </p>
          ) : targetIsHeadCoach && !iAmPrincipal ? (
            <p className="text-sm text-muted">
              Es co-head coach: solo el head coach principal puede cambiar sus roles.
            </p>
          ) : (
            <div className="space-y-4">
              <RolesForm profileId={p.id} name={name} roles={p.roles} />
              {iAmHeadCoach && !targetIsHeadCoach && (
                <HeadCoachButton profileId={p.id} name={name} roles={p.roles} mode="nombrar" />
              )}
              {iAmPrincipal && targetIsHeadCoach && (
                <HeadCoachButton profileId={p.id} name={name} roles={p.roles} mode="quitar" />
              )}
            </div>
          )}
        </section>

        <section className={`p-5 ${cardClass}`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <SectionTitle>Permisos</SectionTitle>
            {isCustomized(p) && (
              <span className={chipClass}>
                Personalizado · {extra} extra{removed > 0 ? ` · ${removed} quitado${removed > 1 ? "s" : ""}` : ""}
              </span>
            )}
          </div>
          {targetIsHeadCoach ? (
            <p className="text-sm text-muted">
              Un head coach tiene todos los permisos, incluido gestionar el staff, activar
              Sevens y armar el Grupo Sevens.
            </p>
          ) : (
            <div className="space-y-4">
              {!iAmHeadCoach && (
                <p className="text-sm text-muted">Solo el head coach cambia los permisos.</p>
              )}
              <PermissionSwitches
                profileId={p.id}
                perms={p.perms}
                defaults={p.defaults}
                readOnly={!iAmHeadCoach || isMe}
              />
              {iAmHeadCoach && isCustomized(p) && <ResetPermissionsButton profileId={p.id} />}
              <p className="text-xs text-muted">
                Gestionar el staff, activar Sevens y el Grupo Sevens no se delegan: son del
                head coach y del manager.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
