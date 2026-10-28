import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarX } from "lucide-react";
import { getActiveClubId, getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { canManageEvents, isStaff, type UserRole } from "@/lib/roles";
import { buttonPrimary, cardClass, textButton } from "@/app/ui";
import { getActiveFormat } from "@/lib/format";

// "Armar nómina" sin un partido próximo: lo avisa y ofrece crearlo a quien puede
// crear eventos (head coach, manager y entrenador).
export default async function NoMatchPage() {
  const supabase = await getSupabase();
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // En paralelo: perfil y el próximo partido del plantel activo.
  // Del formato activo (Rugby 15 o Sevens).
  const [clubId, format] = await Promise.all([getActiveClubId(user.id), getActiveFormat(user.id)]);
  const [me, { data: next }] = await Promise.all([
    getProfile(user.id),
    supabase
      .from("events")
      .select("id")
      .eq("club_id", clubId)
      .eq("type", "competencia")
      .eq("format", format)
      .is("cancelled_at", null)
      .gt("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(1)
      .maybeSingle(),
  ]);
  if (me?.status === "pendiente") redirect("/pendiente");
  const roles = (me?.roles ?? []) as UserRole[];
  if (me?.status !== "confirmado" || !isStaff(roles)) redirect("/dashboard");

  // Si ya hay un partido próximo, va directo a su nómina.
  if (next) redirect(`/calendario/${next.id}/disponibles`);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <Link href="/nominas" className={textButton}>
        ← Volver a nóminas
      </Link>
      <div className={`mt-4 space-y-4 p-6 text-center ${cardClass}`}>
        <CalendarX aria-hidden="true" className="mx-auto size-10 text-muted" />
        <h1 className="text-xl font-semibold text-ink">No hay un partido próximamente</h1>
        <p className="text-sm text-muted">
          Para armar una nómina, primero tiene que haber un partido en el calendario.
        </p>
        {canManageEvents(roles) ? (
          <Link href="/calendario/nuevo?tipo=competencia" className={`w-full ${buttonPrimary}`}>
            Crear un partido
          </Link>
        ) : (
          <p className="text-sm text-ink">
            Pídele al head coach, al manager o a un entrenador que lo cree en el calendario.
          </p>
        )}
      </div>
    </main>
  );
}
