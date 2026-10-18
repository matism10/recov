// Identidad del club para el encabezado (ClubHeader): nombre, deporte, categoría,
// escudo y portada. La portada vive en el bucket privado "club-covers" (0025) y se
// lee con URL firmada.
import type { createClient } from "@/lib/supabase/server";

export type ClubIdentity = {
  name: string;
  sportLabel: string;
  category: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
};

const SPORT_LABEL: Record<string, string> = {
  futbol: "Fútbol",
  futsal: "Futsal",
  rugby: "Rugby",
  handball: "Handball",
  voleibol: "Vóleibol",
  basquetbol: "Básquetbol",
  hockey: "Hockey",
};

const SIGNED_URL_SECONDS = 60 * 60;

// URL firmada de la portada. RLS: solo los confirmados del club la pueden leer.
export async function clubCoverUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null | undefined,
) {
  if (!path) return null;
  const { data } = await supabase.storage
    .from("club-covers")
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  return data?.signedUrl ?? null;
}

export async function getClubIdentity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  club: {
    name: string;
    sport: string | null;
    category: string | null;
    coverPath: string | null;
    uploadedLogoUrl: string | null;
  },
): Promise<ClubIdentity> {
  return {
    name: club.name,
    sportLabel: (club.sport && SPORT_LABEL[club.sport]) || "",
    category: club.category,
    // Escudo: el logo que el club subió; sin logo, las iniciales.
    logoUrl: club.uploadedLogoUrl,
    coverUrl: await clubCoverUrl(supabase, club.coverPath),
  };
}
