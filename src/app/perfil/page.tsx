import { redirect } from "next/navigation";
import { getActiveClubId, getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { signOut } from "@/app/login/actions";
import { ROLE_LABEL, type UserRole } from "@/lib/roles";
import { photoUrl } from "@/lib/photos";
import { signOutButtonClass } from "@/app/ui";
import { Card, CardHeader, PageHeader } from "@/app/ui-blocks";
import { LogOut } from "lucide-react";
import { allowedScreens, defaultSlots, resolveSlots } from "@/lib/nav-slots";
import { NavSlotsForm } from "./nav-slots-form";
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
  const [profile, { data: playerRow }, { data: navRow }] = await Promise.all([
    getProfile(user.id),
    supabase
      .from("players")
      .select("id, first_name, last_name, position, secondary_position, height_cm, weight_kg")
      .eq("user_id", user.id)
      .eq("club_id", clubId)
      .maybeSingle(),
    // Barra móvil guardada (0047; RLS: solo la fila propia del plantel activo).
    supabase.from("nav_preferences").select("slots").eq("club_id", clubId).maybeSingle(),
  ]);

  if (profile?.status === "pendiente") redirect("/pendiente");
  if (!profile || profile.status !== "confirmado") redirect("/dashboard");

  const club = profile.club;
  const roles = (profile.roles ?? []) as UserRole[];
  const navOpts = { kineDelegate: club?.kine_delegate_id === user.id };
  const navSlots = resolveSlots((navRow?.slots as string[] | null) ?? null, roles, navOpts);

  // Solo jugadores, en paralelo: posiciones de su deporte y su teléfono
  // (get_player_phone, 0030: al propio jugador siempre le devuelve su número).
  const [{ data: positions }, { data: phone }] = playerRow
    ? await Promise.all([
        supabase.from("positions").select("name").eq("sport", club?.sport ?? "").eq("format", "15").order("sort"),
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
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 lg:max-w-[1080px] lg:px-8 lg:py-10">
      <PageHeader
        title="Tu perfil"
        back={{ fallback: "/dashboard" }}
        description={`${club?.name ?? ""}${roles.length > 0 ? ` · ${roles.map((r) => ROLE_LABEL[r]).join(", ")}` : ""}`}
      />

      <div className="max-w-2xl space-y-6">
        <Card as="section" id="foto" className="scroll-mt-4">
          <CardHeader title="Foto" />
          <AvatarForm
            name={profile.full_name ?? ""}
            url={avatarUrl}
            folder={`${profile.club_id}/${user.id}`}
          />
        </Card>

        <Card as="section" id="datos" className="scroll-mt-4">
          <CardHeader title="Tus datos" />
          <ProfileForm
            firstName={firstName}
            lastName={lastName}
            player={player}
            positions={(positions ?? []).map((p) => p.name as string)}
          />
        </Card>

        {playerRow && (
          <Card as="section" id="contacto" className="scroll-mt-4">
            <CardHeader title="Contacto" />
            <PhoneForm phone={(phone as string | null) ?? null} />
          </Card>
        )}

        <Card as="section" id="cuenta" className="scroll-mt-4">
          <CardHeader title="Cuenta" />
          <dl className="mb-4 text-sm">
            <dt className="text-muted">Correo</dt>
            <dd className="font-medium text-ink">{user.email}</dd>
          </dl>
          <PasswordForm />
        </Card>

        {/* Barra inferior: solo existe en el celular. */}
        <Card as="section" id="barra-principal" className="scroll-mt-4 lg:hidden">
          <CardHeader title="Barra principal" />
          <NavSlotsForm
            current={navSlots}
            defaults={defaultSlots(roles, navOpts)}
            allowed={allowedScreens(roles)}
            player={roles.includes("jugador")}
          />
        </Card>

        <form id="cerrar-sesion" action={signOut} className="scroll-mt-4">
          <button className={signOutButtonClass}>
            <LogOut aria-hidden="true" className="size-5" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </main>
  );
}
