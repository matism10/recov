// Portada del club en el Resumen. Se firma aquí y no en el layout, para no firmarla
// en cada pantalla, junto con la foto propia (el avatar del encabezado en celular).
// Va justo después del marco que pone el layout, que se oculta al llegar esta (ClubHero).
import { createClient } from "@/lib/supabase/server";
import { clubCoverUrl, clubIdentity } from "@/lib/club-identity";
import { clubLogoUrl } from "@/lib/club-logo";
import { ClubHero } from "@/app/club-header";

const AVATAR_URL_SECONDS = 60 * 60;

type Client = Awaited<ReturnType<typeof createClient>>;
export type ResumenCoverUrls = { coverUrl: string | null; avatarUrl: string | null };

// Firma la portada y la foto propia en paralelo. La página la llama apenas tiene el
// perfil, sin esperarla, para que corra mientras se hacen sus otras consultas.
export function signResumenCover(
  supabase: Client,
  coverPath: string,
  avatarPath: string | null,
): Promise<ResumenCoverUrls> {
  return Promise.all([
    clubCoverUrl(supabase, coverPath),
    avatarPath
      ? supabase.storage
          .from("avatars")
          .createSignedUrl(avatarPath, AVATAR_URL_SECONDS)
          .then(({ data }) => data?.signedUrl ?? null)
      : null,
  ])
    .then(([coverUrl, avatarUrl]) => ({ coverUrl, avatarUrl }))
    // Si falla, el Resumen queda con el marco sin foto (nunca una promesa rechazada suelta).
    .catch(() => ({ coverUrl: null, avatarUrl: null }));
}

export async function ResumenCover({
  club,
  fullName,
  urls,
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
  urls: Promise<ResumenCoverUrls>;
}) {
  const [{ coverUrl, avatarUrl }, supabase] = await Promise.all([urls, createClient()]);
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
