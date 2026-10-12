// Fotos de perfil (bucket privado "avatars", migración 0007).
import type { createClient } from "@/lib/supabase/server";

const SIGNED_URL_SECONDS = 60 * 60;

// URL firmada de la foto de cada usuario, por id de perfil. RLS: solo se
// obtienen las fotos de los perfiles que quien consulta puede ver.
export async function getAvatarUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileIds: (string | null | undefined)[],
) {
  const urls = new Map<string, string>();
  const ids = [...new Set(profileIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return urls;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, avatar_path")
    .in("id", ids)
    .not("avatar_path", "is", null);
  if (!profiles || profiles.length === 0) return urls;

  const { data: signed } = await supabase.storage
    .from("avatars")
    .createSignedUrls(
      profiles.map((p) => p.avatar_path as string),
      SIGNED_URL_SECONDS,
    );
  const byPath = new Map(
    (signed ?? [])
      .filter((s) => s.path && s.signedUrl)
      .map((s) => [s.path as string, s.signedUrl]),
  );
  for (const p of profiles) {
    const url = byPath.get(p.avatar_path as string);
    if (url) urls.set(p.id, url);
  }
  return urls;
}
