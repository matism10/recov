// Configuración de la landing pública: imágenes (public/landing/), pantallas, deportes y opciones del formulario.
export const LANDING_IMAGES = {
  hero: { name: "hero-resumen", width: 2000, height: 1138 },
} as const;

export type ScreenItem = { file: string; label: string; text: string };

const PHONE = { width: 923, height: 2000 };
export const PHONE_SIZE = PHONE;

export const STAFF_SCREENS: ScreenItem[] = [
  { file: "staff-resumen", label: "Resumen", text: "Quién está disponible, de un vistazo." },
  { file: "staff-lesiones", label: "Lesiones", text: "Cada lesión, su fase y fecha de alta." },
  { file: "staff-calendario", label: "Calendario", text: "Entrenamientos, gimnasio y partidos en un solo lugar." },
  { file: "staff-partido", label: "Día de partido", text: "Toda la información del partido y la nómina, lista." },
  { file: "staff-evaluaciones", label: "Evaluaciones", text: "Los tests físicos de tu plantel, para prevenir lesiones." },
  { file: "staff-gimnasio", label: "Sesión de gimnasio", text: "Crea la sesión y tus jugadores la ven al tiro." },
  { file: "staff-carga", label: "Carga del plantel", text: "La carga de cada jugador, al día." },
];

export const PLAYER_SCREENS: ScreenItem[] = [
  { file: "jugador-resumen", label: "Resumen", text: "Tu estado y tu próxima actividad." },
  { file: "jugador-lesion", label: "Registrar lesión", text: "Avisa en segundos, desde el celular." },
  { file: "jugador-registrar-carga", label: "Registrar carga", text: "Cuenta cómo te sentiste en el entrenamiento." },
  { file: "jugador-evaluaciones", label: "Mis evaluaciones", text: "Tu progreso en pesos y tests." },
  { file: "jugador-calendario", label: "Calendario", text: "Entrenamientos, gimnasio y partidos, todo en una vista." },
  { file: "jugador-carga", label: "Mi carga", text: "Mira cuánta carga llevas tú." },
];

export const ALL_IMAGE_FILES = [
  LANDING_IMAGES.hero.name,
  ...STAFF_SCREENS.map((s) => s.file),
  ...PLAYER_SCREENS.map((s) => s.file),
];

export const FORM_SPORTS = ["Rugby", "Fútbol", "Futsal", "Handball", "Vóleibol", "Básquetbol", "Hockey césped", "Otro"];
export const FORM_ROLES = [
  "Director/a o presidente/a",
  "Entrenador/a o head coach",
  "Kinesiólogo/a",
  "Delegado/a",
  "Otro",
];

export type Field = "club" | "sport" | "role" | "name" | "email";

export function validateRequest(v: Record<Field, string>): Partial<Record<Field, string>> {
  const e: Partial<Record<Field, string>> = {};
  const len = (s: string, a: number, b: number) => s.trim().length >= a && s.trim().length <= b;
  if (!len(v.club, 2, 120)) e.club = "Escribe el nombre de tu club.";
  if (!FORM_SPORTS.includes(v.sport)) e.sport = "Elige un deporte.";
  if (!FORM_ROLES.includes(v.role)) e.role = "Elige tu cargo.";
  if (!len(v.name, 2, 120)) e.name = "Escribe tu nombre.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email.trim()) || v.email.trim().length > 254)
    e.email = "Escribe un correo válido.";
  return e;
}
