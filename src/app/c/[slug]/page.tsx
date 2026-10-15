import { createClient } from "@/lib/supabase/server";
import { RegisterForm } from "./register-form";

export default async function ClubSignupPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: club } = await supabase
    .rpc("club_public_info", { p_slug: slug })
    .maybeSingle<{ name: string; sport: string }>();

  if (!club) {
    return (
      <main className="flex flex-1 items-center justify-center bg-white px-4">
        <p className="rounded-xl bg-mist p-8 text-center text-ink border border-line">
          Este link no es válido
        </p>
      </main>
    );
  }

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
