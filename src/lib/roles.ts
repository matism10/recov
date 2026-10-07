export type UserRole =
  | "head_coach"
  | "manager"
  | "entrenador"
  | "kinesiologo"
  | "nutricionista"
  | "preparador_fisico"
  | "jugador";

// Puestos que se pueden solicitar al registrarse por el link del club.
export const STAFF_SIGNUP_ROLES = [
  "kinesiologo",
  "entrenador",
  "nutricionista",
  "preparador_fisico",
] as const satisfies readonly UserRole[];

export type StaffSignupRole = (typeof STAFF_SIGNUP_ROLES)[number];

export type Availability = "disponible" | "en_recuperacion" | "de_baja";

export const ROLE_LABEL: Record<UserRole, string> = {
  head_coach: "Head coach",
  manager: "Manager",
  entrenador: "Entrenador",
  kinesiologo: "Kinesiólogo",
  nutricionista: "Nutricionista",
  preparador_fisico: "Preparador físico",
  jugador: "Jugador",
};

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  disponible: "Disponible",
  en_recuperacion: "En recuperación",
  de_baja: "De baja",
};

export const AVAILABILITY_STYLE: Record<Availability, string> = {
  disponible: "bg-emerald-100 text-emerald-800",
  en_recuperacion: "bg-amber-100 text-amber-800",
  de_baja: "bg-red-100 text-red-800",
};
