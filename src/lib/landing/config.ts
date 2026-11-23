// Configuración de la landing pública: capturas (public/landing/, las genera
// scripts/capturas-landing.ts), funciones por rol, deportes, preguntas y opciones del formulario.

export type Feature = { file: string; title: string; desc: string; alt: string };

// Capturas de celular a 390×844 (las de funciones y deportes).
export const PHONE_RATIO = 390 / 844;
export const IPAD_RATIO = 1180 / 820;

export const STAFF_FEATURES: Feature[] = [
  { file: "staff-resumen", title: "Resumen", desc: "Quién está disponible, de un vistazo.", alt: "Resumen del staff en Recov: disponibles, lesionados y en reintegro del plantel demo." },
  { file: "staff-lesiones", title: "Lesiones", desc: "Cada lesión, su fase y fecha de alta.", alt: "Lista de lesiones activas del plantel demo, con su fase y fecha de alta." },
  { file: "staff-calendario", title: "Calendario", desc: "Entrenamientos, gimnasio y partidos en un solo lugar.", alt: "Calendario de la semana con entrenamientos, gimnasio y partido." },
  { file: "staff-partido", title: "Día de partido", desc: "Toda la información del partido y la nómina, lista.", alt: "Nómina del próximo partido con titulares y banca." },
  { file: "staff-evaluaciones", title: "Evaluaciones", desc: "Los tests físicos de tu plantel, para prevenir lesiones.", alt: "Comparación de un test físico entre los jugadores del plantel demo." },
  { file: "staff-gimnasio", title: "Sesión de gimnasio", desc: "Crea la sesión y tus jugadores la ven al tiro.", alt: "Editor de una sesión de gimnasio con sus ejercicios." },
  { file: "staff-carga", title: "Carga del plantel", desc: "La carga de cada jugador, al día.", alt: "Carga de la semana de cada jugador del plantel demo." },
];

export const PLAYER_FEATURES: Feature[] = [
  { file: "jugador-resumen", title: "Resumen", desc: "Tu estado, tu próximo evento y lo que tienes pendiente.", alt: "Resumen del jugador: su estado, su próximo evento y sus pendientes." },
  { file: "jugador-registrar-lesion", title: "Registrar lesión", desc: "Marca dónde te lesionaste y sube tu diagnóstico.", alt: "Formulario para registrar una lesión marcando la zona en el cuerpo." },
  { file: "jugador-registrar-carga", title: "Registrar carga", desc: "Cuenta qué tan duro fue cada estímulo, en segundos.", alt: "Pantalla para registrar qué tan duro fue un entrenamiento." },
  { file: "jugador-calendario", title: "Calendario", desc: "Entrenamientos y partidos; avisa si no vas con un toque.", alt: "Calendario del jugador con entrenamientos y partido." },
  { file: "jugador-evaluaciones", title: "Mis evaluaciones", desc: "Tus tests, tu progreso y tu puesto en el plantel.", alt: "Evaluaciones del jugador con su progreso en cada test." },
  { file: "jugador-carga", title: "Mi carga", desc: "Tu carga de la semana, comparada con el plantel.", alt: "Carga semanal del jugador comparada con el plantel." },
];

export const SPORTS = ["Rugby", "Fútbol", "Futsal", "Handball", "Vóleibol", "Básquetbol", "Hockey césped"];

export const FAQS: [string, string][] = [
  ["¿Mis jugadores lo van a usar?", "Se registran solos desde el link del plantel, en su celular. El club aprueba quién entra."],
  ["¿Quién ve los datos médicos?", "Solo el staff autorizado del club. Cada club ve únicamente sus propios datos."],
  ["¿Hay que descargar algo?", "No. Recov se instala desde Safari o Chrome y queda como app en la pantalla de inicio."],
  ["¿Sirve si tengo varias categorías?", "Sí. Cada categoría es un plantel y una misma cuenta puede estar en varios."],
  ["¿Me cobran o me atan a algo?", "No hay pago automático ni contrato. Los primeros 10 clubes tienen 2 meses gratis."],
];

export const FORM_SPORTS = [...SPORTS, "Otro"];
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
  if (!FORM_ROLES.includes(v.role)) e.role = "Elige tu rol.";
  if (!len(v.name, 2, 120)) e.name = "Escribe tu nombre.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email.trim()) || v.email.trim().length > 254)
    e.email = "Escribe un correo válido.";
  return e;
}
