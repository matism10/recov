import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { ROLE_LABEL, type UserRole } from "@/lib/roles";
import { getAvatarUrls } from "@/lib/avatars";
import { buttonSecondary, cardClass, textButton } from "@/app/ui";
import { AvatarForm, PasswordForm, ProfileForm, type PlayerFields } from "./profile-forms";

// El staff solo tiene full_name: se separa en la primera palabra (nombre) y el resto (apellido).
function splitName(fullName: string | null) {
  const [first = "", ...rest] = (fullName ?? "").trim().split(/\s+/);
  return { first, last: rest.join(" ") };
}

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Desde 0005 hay dos relaciones profiles–clubs: hay que nombrar la FK.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, roles, status, club_id, clubs!profiles_club_id_fkey(name, sport)")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.status === "pendiente") redirect("/pendiente");
  if (!profile || profile.status !== "confirmado") redirect("/dashboard");

  const club = Array.isArray(profile.clubs) ? profile.clubs[0] : profile.clubs;
  const roles = (profile.roles ?? []) as UserRole[];

  // RLS: el jugador ve su propia ficha del plantel.
  const { data: playerRow } = await supabase
    .from("players")
    .select("first_name, last_name, position, secondary_position, height_cm, weight_kg")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: positions } = playerRow
    ? await supabase.from("positions").select("name").eq("sport", club?.sport).order("sort")
    : { data: null };

  const fallback = splitName(profile.full_name);
  const firstName = playerRow?.first_name ?? fallback.first;
  const lastName = playerRow?.last_name ?? fallback.last;
  const player: PlayerFields | null = playerRow
    ? {
        position: playerRow.position,
        secondaryPosition: playerRow.secondary_position,
        heightCm: playerRow.height_cm,
        weightKg: playerRow.weight_kg === null ? null : Number(playerRow.weight_kg),
      }
    : null;

  const avatarUrl = (await getAvatarUrls(supabase, [user.id])).get(user.id) ?? null;

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <header className="mb-6">
        <Link href="/dashboard" className={textButton}>
          ← Volver
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Tu perfil</h1>
        <p className="mt-1 text-sm text-muted">
          {club?.name}
          {roles.length > 0 && ` · ${roles.map((r) => ROLE_LABEL[r]).join(", ")}`}
        </p>
      </header>

      <div className="space-y-6">
        <section className={`p-5 ${cardClass}`}>
          <h2 className="mb-4 font-semibold text-ink">Foto</h2>
          <AvatarForm
            name={profile.full_name ?? ""}
            url={avatarUrl}
            folder={`${profile.club_id}/${user.id}`}
          />
        </section>

        <section className={`p-5 ${cardClass}`}>
          <h2 className="mb-4 font-semibold text-ink">Tus datos</h2>
          <ProfileForm
            firstName={firstName}
            lastName={lastName}
            player={player}
            positions={(positions ?? []).map((p) => p.name as string)}
          />
        </section>

        <section className={`p-5 ${cardClass}`}>
          <h2 className="mb-4 font-semibold text-ink">Cuenta</h2>
          <dl className="mb-4 text-sm">
            <dt className="text-muted">Correo</dt>
            <dd className="font-medium text-ink">{user.email}</dd>
          </dl>
          <PasswordForm />
        </section>

        <form action={signOut}>
          <button className={`w-full ${buttonSecondary}`}>Cerrar sesión</button>
        </form>
      </div>
    </main>
  );
}
