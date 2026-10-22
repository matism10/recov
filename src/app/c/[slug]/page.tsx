import { createClient } from "@/lib/supabase/server";
import { clubLogoUrl } from "@/lib/club-logo";
import { ClubLogo } from "@/app/club-logo";
import { RegisterForm } from "./register-form";

export default async function ClubSignupPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // En paralelo: el club y la ruta de su logo (sin sesión: club_logo_path solo
  // devuelve la ruta del logo, en un bucket público). Ambos dependen solo del link.
  const [{ data: club }, { data: logoPath }] = await Promise.all([
    supabase.rpc("club_public_info", { p_slug: slug }).maybeSingle<{ name: string; sport: string }>(),
    supabase.rpc("club_logo_path", { p_slug: slug }),
  ]);

  if (!club) {
    return (
      <main className="flex flex-1 items-center justify-center bg-white px-4">
        <p className="rounded-xl bg-mist p-8 text-center text-ink border border-line">
          Este link no es válido
        </p>
      </main>
    );
  }

  const logoUrl = clubLogoUrl(supabase, logoPath as string | null);

  const { data: positions } = await supabase
    .from("positions")
    .select("name")
    .eq("sport", club.sport)
    .order("sort");

  return (
    <main className="flex flex-1 items-center justify-center bg-white px-4 py-10">
      <div className="w-full max-w-sm space-y-5 rounded-xl bg-mist p-8 border border-line">
        <div>
          <p className="font-display text-sm font-extrabold text-ink">Recov</p>
          {logoUrl && (
            <div className="mt-3">
              <ClubLogo name={club.name} url={logoUrl} size="lg" />
            </div>
          )}
          <h1 className="text-2xl font-semibold text-ink">{club.name}</h1>
          <p className="mt-1 text-sm text-muted">
            Crea tu cuenta para unirte al club.
          </p>
        </div>
        <RegisterForm
          slug={slug}
          positions={(positions ?? []).map((p) => p.name as string)}
        />
      </div>
    </main>
  );
}
