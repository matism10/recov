import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveClubId, getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { canSetWellnessDays, type UserRole } from "@/lib/roles";
import { PageTitle, textButton } from "@/app/ui";
import { WellnessDaysForm } from "./days-form";

// Días del check de bienestar del plantel: head coach, manager y preparador físico.
// Los jugadores lo responden esos días (o al día siguiente).
export default async function WellnessDaysPage() {
  const supabase = await getSupabase();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const clubId = await getActiveClubId(user.id);
  const [me, { data: club }] = await Promise.all([
    getProfile(user.id),
    supabase.from("clubs").select("wellness_days").eq("id", clubId).maybeSingle(),
  ]);
  if (me?.status === "pendiente") redirect("/pendiente");
  if (!me || me.status !== "confirmado" || !canSetWellnessDays((me.roles ?? []) as UserRole[])) {
    redirect("/dashboard");
  }

  const days = ((club?.wellness_days as number[] | null) ?? [1]).map(Number);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <header className="mb-6">
        <Link href="/dashboard" className={textButton}>
          ← Volver al resumen
        </Link>
        <PageTitle className="mt-2">Check de bienestar</PageTitle>
        <p className="mt-1 text-sm text-muted">
          Elige qué días los jugadores responden las 5 preguntas de bienestar. Quien no
          alcanza a responder, puede hacerlo al día siguiente.
        </p>
      </header>
      <WellnessDaysForm initial={days} />
    </main>
  );
}
