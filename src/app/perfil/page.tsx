import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveClubId, getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { signOut } from "@/app/login/actions";
import { ROLE_LABEL, type UserRole } from "@/lib/roles";
import { photoUrl } from "@/lib/photos";
import { buttonSecondary, cardClass, textButton } from "@/app/ui";
import {
  AvatarForm,
  PasswordForm,
  PhoneForm,
  ProfileForm,
  type PlayerFields,
} from "./profile-forms";

// El staff solo tiene full_name: se separa en la primera palabra (nombre) y el resto (apellido).
function splitName(fullName: string | null) {
  const [first = "", ...rest] = (fullName ?? "").trim().split(/\s+/);
  return { first, last: rest.join(" ") };
}

export default async function ProfilePage() {
  const supabase = await getSupabase();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // En paralelo: perfil (con el club y la ruta de la foto) y la ficha propia del
  // plantel (RLS: el jugador ve la suya).
  // La ficha es la del plantel activo: con varios planteles, la cuenta tiene una por plantel.
  const clubId = await getActiveClubId(user.id);
  const [profile, { data: playerRow }] = await Promise.all([
    getProfile(user.id),
    supabase
      .from("players")
      .select("id, first_name, last_name, position, secondary_position, height_cm, weight_kg")
      .eq("user_id", user.id)
      .eq("club_id", clubId)
      .maybeSingle(),
  ]);

  if (profile?.status === "pendiente") redirect("/pendiente");
  if (!profile || profile.status !== "confirmado") redirect("/dashboard");

  const club = profile.club;
  const roles = (profile.roles ?? []) as UserRole[];

  // Solo jugadores, en paralelo: posiciones de su deporte y su teléfono
  // (get_player_phone, 0030: al propio jugador siempre le devuelve su número).
  const [{ data: positions }, { data: phone }] = playerRow
    ? await Promise.all([
        supabase.from("positions").select("name").eq("sport", club?.sport ?? "").order("sort"),
        supabase.rpc("get_player_phone", { p_player_id: playerRow.id }),
      ])
    : [{ data: null }, { data: null }];

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

  // Foto propia: la ruta viene en el perfil; la URL estable (/foto) no necesita consulta.
  const avatarUrl = profile.avatar_path ? photoUrl("avatars", profile.avatar_path) : null;

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

        {playerRow && (
          <section className={`p-5 ${cardClass}`}>
            <h2 className="mb-4 font-semibold text-ink">Contacto</h2>
            <PhoneForm phone={(phone as string | null) ?? null} />
          </section>
        )}

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
