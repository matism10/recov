// Identidad del club para el encabezado (ClubHeader). Prototipo: la categoría es un
// dato de ejemplo y la portada sale de public/dev-identity/, que está en .gitignore
// (fotos reales: nunca al repo). Sin consultas nuevas.
import { existsSync } from "node:fs";
import { join } from "node:path";

export type ClubIdentity = {
  name: string;
  sportLabel: string;
  category: string;
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

const DEV_DIR = join(process.cwd(), "public", "dev-identity");
const devFile = (file: string, url: string) => (existsSync(join(DEV_DIR, file)) ? url : null);

export function getClubIdentity(club: {
  name: string;
  sport: string | null;
  uploadedLogoUrl: string | null;
}): ClubIdentity {
  return {
    name: club.name,
    sportLabel: (club.sport && SPORT_LABEL[club.sport]) || "",
    category: "Adulta", // fixture del prototipo
    // Escudo: el de prueba si existe; si no, el logo que el club subió; si no, iniciales.
    logoUrl: devFile("logo.png", "/dev-identity/logo.png") ?? club.uploadedLogoUrl,
    coverUrl: devFile("cover.jpg", "/dev-identity/cover.jpg"),
  };
}
