// Teléfono del jugador en formato internacional (E.164), igual que el CHECK de
// player_contacts (0030). Acepta "9 1234 5678", "+56 9 1234 5678" o
// "56912345678", con espacios, guiones, puntos o paréntesis. Sin prefijo de
// país se asume Chile (+56).
export const PHONE_RE = /^\+[1-9][0-9]{7,14}$/;

export const PHONE_ERROR =
  "El teléfono no es válido. Escríbelo como 9 1234 5678 o con el código de país, por ejemplo +56 9 1234 5678.";

// Devuelve el número normalizado, "" si viene vacío o null si no es válido.
export function normalizePhone(input: string): string | null {
  const raw = input.trim();
  if (!raw) return "";
  const compact = raw.replace(/[\s\-.()]/g, "");
  if (!/^\+?[0-9]+$/.test(compact)) return null;

  const digits = compact.replace("+", "");
  let phone: string;
  if (compact.startsWith("+")) phone = `+${digits}`;
  else if (digits.startsWith("00")) phone = `+${digits.slice(2)}`;
  // Celular chileno con el 56 delante pero sin "+": 56 9 1234 5678.
  else if (digits.length === 11 && digits.startsWith("56")) phone = `+${digits}`;
  else phone = `+56${digits}`;

  return PHONE_RE.test(phone) ? phone : null;
}

// Para mostrar: los celulares chilenos como "+56 9 1234 5678"; el resto tal cual.
export function formatPhone(phone: string): string {
  const m = /^\+569(\d{4})(\d{4})$/.exec(phone);
  return m ? `+56 9 ${m[1]} ${m[2]}` : phone;
}
