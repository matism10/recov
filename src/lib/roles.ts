export type UserRole =
  | "head_coach"
  | "manager"
  | "entrenador"
  | "kinesiologo"
  | "nutricionista"
  | "preparador_fisico"
  | "jugador";

// Dirección del club: valida registros y gestiona el staff. Solo controla qué se
// muestra; el permiso real lo verifica la base de datos.
export const DIRECTION_ROLES = ["head_coach", "manager"] as const satisfies readonly UserRole[];

export function isDirection(roles: readonly UserRole[]) {
  return DIRECTION_ROLES.some((r) => roles.includes(r));
}

// Staff del club: ve lesiones y fases. Igual que private.staff_roles() en la base.
export const STAFF_ROLES = [
  "head_coach",
  "manager",
  "entrenador",
  "kinesiologo",
  "nutricionista",
  "preparador_fisico",
] as const satisfies readonly UserRole[];

export function isStaff(roles: readonly UserRole[]) {
  return STAFF_ROLES.some((r) => roles.includes(r));
}

// Marca, revisa, descarta y da de alta lesiones: kinesiólogo, su delegado y
// head coach. Igual que private.can_manage_injuries() en la base; solo decide
// qué se muestra, el permiso real lo verifica la base de datos.
export function canManageInjuries(
  roles: readonly UserRole[],
  userId: string,
  kineDelegateId: string | null | undefined,
) {
  return (
    roles.includes("kinesiologo") ||
    roles.includes("head_coach") ||
    kineDelegateId === userId
  );
}

// Puestos que se pueden solicitar al registrarse por el link del club.
export const STAFF_SIGNUP_ROLES = [
  "kinesiologo",
  "entrenador",
  "nutricionista",
  "preparador_fisico",
] as const satisfies readonly UserRole[];

export type StaffSignupRole = (typeof STAFF_SIGNUP_ROLES)[number];

export type Availability = "disponible" | "en_revision" | "lesionado" | "reintegro";

// "En revisión" lo pone solo mark_player_injured y lo reemplaza review_injury:
// no se ofrece al elegir la disponibilidad a mano.
export const MANUAL_AVAILABILITY = [
  "disponible",
  "lesionado",
  "reintegro",
] as const satisfies readonly Availability[];
export type ManualAvailability = (typeof MANUAL_AVAILABILITY)[number];

// Jugadores que aparecen en "Lesiones activas".
export const INJURED_AVAILABILITY = ["lesionado", "reintegro"] as const satisfies readonly Availability[];

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
  en_revision: "En revisión",
  lesionado: "Lesionado",
  reintegro: "Reintegro",
};

