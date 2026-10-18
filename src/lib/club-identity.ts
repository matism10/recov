// Identidad del club para el encabezado (ClubHeader): nombre, deporte, categoría,
// escudo y portada. La portada vive en el bucket privado "club-covers" (0025) y se
// lee con URL firmada. Si el club no tiene portada, se usa la de prueba de
// public/dev-identity/ cuando existe (está en .gitignore: fotos reales, nunca al repo).
import { existsSync } from "node:fs";
import { join } from "node:path";
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

const DEV_DIR = join(process.cwd(), "public", "dev-identity");
const devFile = (file: string, url: string) => (existsSync(join(DEV_DIR, file)) ? url : null);

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
    // Escudo: el de prueba si existe; si no, el logo que el club subió; si no, iniciales.
    logoUrl: devFile("logo.png", "/dev-identity/logo.png") ?? club.uploadedLogoUrl,
    coverUrl:
      (await clubCoverUrl(supabase, club.coverPath)) ??
      devFile("cover.jpg", "/dev-identity/cover.jpg"),
  };
}
