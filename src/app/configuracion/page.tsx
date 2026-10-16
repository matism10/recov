import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDirection, type UserRole } from "@/lib/roles";
import { clubLogoUrl } from "@/lib/club-logo";
import { cardClass, textButton } from "@/app/ui";
import { LogoForm } from "./logo-form";

// Configuración del club: solo la dirección (head coach y manager).
export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Desde 0005 hay dos relaciones profiles–clubs: hay que nombrar la FK.
  const { data: me } = await supabase
    .from("profiles")
    .select("roles, status, club_id, clubs!profiles_club_id_fkey(name, logo_path)")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.status === "pendiente") redirect("/pendiente");
  if (me?.status !== "confirmado" || !isDirection((me.roles ?? []) as UserRole[])) {
    redirect("/dashboard");
  }
  const club = Array.isArray(me.clubs) ? me.clubs[0] : me.clubs;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-8">
        <Link href="/dashboard" className={textButton}>
          ← Volver al resumen
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Configuración</h1>
        <p className="mt-1 text-sm text-muted">Ajustes de {club?.name}.</p>
      </header>

      <section className={`p-5 ${cardClass}`}>
        <h2 className="font-medium text-ink">Logo del club</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Se muestra en el menú lateral y en el link de registro del club.
        </p>
        <LogoForm
          clubName={club?.name ?? ""}
          url={clubLogoUrl(supabase, club?.logo_path)}
          folder={me.club_id}
        />
      </section>
    </main>
  );
}
