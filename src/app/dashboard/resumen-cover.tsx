// Portada del club en el Resumen, con la foto propia (el avatar del encabezado en
// celular). Va justo después del marco que pone el layout, que se oculta al llegar
// esta (ClubHero). Las imágenes van por /foto (URL estable, sin firmar en cada carga).
import { getSupabase } from "@/lib/session";
import { clubCoverUrl, clubIdentity } from "@/lib/club-identity";
import { clubLogoUrl } from "@/lib/club-logo";
import { photoUrl } from "@/lib/photos";
import { ClubHero } from "@/app/club-header";
import type { ClubOption } from "@/lib/club-options";

export async function ResumenCover({
  club,
  fullName,
  avatarPath,
  clubs,
}: {
  club: {
    name: string;
    sport: string | null;
    category: string | null;
    logo_path: string | null;
    cover_path: string;
    cover_position_x: number | null;
    cover_position_y: number | null;
  };
  fullName: string;
  avatarPath: string | null;
  clubs: ClubOption[];
}) {
  const supabase = await getSupabase();
  const identity = clubIdentity({
    name: club.name,
    sport: club.sport,
    category: club.category,
    coverPath: club.cover_path,
    coverPosition: { x: club.cover_position_x ?? 50, y: club.cover_position_y ?? 50 },
    uploadedLogoUrl: clubLogoUrl(supabase, club.logo_path),
  });
  return (
    <ClubHero
      identity={identity}
      coverUrl={clubCoverUrl(club.cover_path)}
      fullName={fullName}
      avatarUrl={avatarPath ? photoUrl("avatars", avatarPath) : null}
      clubs={clubs}
    />
  );
}
