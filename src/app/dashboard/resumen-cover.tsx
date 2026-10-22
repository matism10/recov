// Portada del club en el Resumen. Se firma aquí y no en el layout, para no firmarla
// en cada pantalla. Firma la portada y la foto propia (para el avatar del encabezado
// en celular) en paralelo; va justo después del marco que pone el layout, que se
// oculta al llegar esta (ClubHero).
import { createClient } from "@/lib/supabase/server";
import { clubCoverUrl, clubIdentity } from "@/lib/club-identity";
import { clubLogoUrl } from "@/lib/club-logo";
import { ClubHero } from "@/app/club-header";

const AVATAR_URL_SECONDS = 60 * 60;

export async function ResumenCover({
  club,
  fullName,
  avatarPath,
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
}) {
  const supabase = await createClient();
  const [coverUrl, avatarUrl] = await Promise.all([
    clubCoverUrl(supabase, club.cover_path),
    avatarPath
      ? supabase.storage
          .from("avatars")
          .createSignedUrl(avatarPath, AVATAR_URL_SECONDS)
          .then(({ data }) => data?.signedUrl ?? null)
      : null,
  ]);
  // Sin URL (no se pudo firmar), queda el marco del layout sin foto.
  if (!coverUrl) return null;

  const identity = clubIdentity({
    name: club.name,
    sport: club.sport,
    category: club.category,
    coverPath: club.cover_path,
    coverPosition: { x: club.cover_position_x ?? 50, y: club.cover_position_y ?? 50 },
    uploadedLogoUrl: clubLogoUrl(supabase, club.logo_path),
  });
  return <ClubHero identity={identity} coverUrl={coverUrl} fullName={fullName} avatarUrl={avatarUrl} />;
}
