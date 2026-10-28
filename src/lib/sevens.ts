// Rugby Sevens (0045): tipos y textos que usan el servidor y el navegador. Sin
// código de servidor: lo importan también los componentes de cliente.

export type Format = "15" | "7";
export const FORMAT_COOKIE = "recov_format";
export const FORMAT_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 365,
  secure: process.env.NODE_ENV === "production",
  httpOnly: false,
};

export const FORMAT_LABEL: Record<Format, string> = { "15": "Rugby 15", "7": "Sevens" };

// Posiciones de Sevens (positions con format '7'), en el orden del catálogo.
export const SEVENS_POSITIONS = ["Pilar", "Hooker", "Medio scrum", "Apertura", "Centro", "Wing"] as const;

export type SevensMember = { position: string | null; secondary_position: string | null };

// Texto de la posición de Sevens: "Pilar · sec. Hooker" o "Sin posición en Sevens".
export function sevensPositionLabel(m: SevensMember | undefined | null) {
  if (!m?.position) return "Sin posición en Sevens";
  return m.secondary_position ? `${m.position} · sec. ${m.secondary_position}` : m.position;
}
