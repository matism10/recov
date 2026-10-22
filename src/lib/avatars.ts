// Fotos de perfil (bucket privado "avatars", migración 0007).
import type { createClient } from "@/lib/supabase/server";
import { photoUrl } from "@/lib/photos";


// URL firmada de la foto de cada usuario, por id de perfil. RLS: solo se
// obtienen las fotos de los perfiles que quien consulta puede ver.
export async function getAvatarUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileIds: (string | null | undefined)[],
) {
  const urls = new Map<string, string>();
  const ids = [...new Set(profileIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return urls;

  // RLS: solo rutas de fotos de perfiles visibles para quien consulta. La URL es
  // estable (/foto) y el navegador la guarda; ya no se firma una por carga.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, avatar_path")
    .in("id", ids)
    .not("avatar_path", "is", null);
  for (const p of profiles ?? []) {
    urls.set(p.id as string, photoUrl("avatars", p.avatar_path as string));
  }
  return urls;
}
