// Identidad del club para el encabezado (ClubHeader): nombre, deporte, categoría,
// escudo y portada. La portada vive en el bucket privado "club-covers" (0025) y se
// lee por /foto (src/lib/photos.ts).
import { photoUrl } from "@/lib/photos";

export type ClubIdentity = {
  name: string;
  sportLabel: string;
  category: string | null;
  logoUrl: string | null;
  // Ruta de la portada en Storage (sin firmar): la firma la página del Resumen.
  coverPath: string | null;
  coverPosition: { x: number; y: number };
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

// URL estable de la portada (/foto). Storage decide quién la ve: solo los
// confirmados del club.
export function clubCoverUrl(path: string | null | undefined) {
  return path ? photoUrl("club-covers", path) : null;
}

// Identidad del club para el encabezado, sin consultas: la portada va como ruta y
// se firma solo donde se muestra (el Resumen), con clubCoverUrl.
export function clubIdentity(club: {
  name: string;
  sport: string | null;
  category: string | null;
  coverPath: string | null;
  coverPosition: { x: number; y: number };
  uploadedLogoUrl: string | null;
}): ClubIdentity {
  return {
    name: club.name,
    sportLabel: (club.sport && SPORT_LABEL[club.sport]) || "",
    category: club.category,
    logoUrl: club.uploadedLogoUrl,
    coverPath: club.coverPath,
    coverPosition: club.coverPosition,
  };
}
