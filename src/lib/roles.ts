import { can, hasEffectivePermissions } from "@/lib/permissions";

export type UserRole =
  | "head_coach"
  | "manager"
  | "entrenador"
  | "kinesiologo"
  | "nutricionista"
  | "preparador_fisico"
  | "jugador";

// Los helpers de este archivo son fachada de los permisos (src/lib/permissions.ts):
// con los permisos efectivos de la sesión pegados a `roles` (getProfile) siguen los
// ajustes por persona; sin ellos, la plantilla del rol. Solo controlan qué se muestra;
// el permiso real lo verifica la base de datos (private.has_perm).

// Dirección del club: gestiona el staff (permiso no delegable: head coach y manager).
export const DIRECTION_ROLES = ["head_coach", "manager"] as const satisfies readonly UserRole[];

export function isDirection(roles: readonly UserRole[]) {
  return can(roles, "staff_gestionar");
}

// Aprueba registros (/registros): por defecto la dirección; se puede dar a otros.
export function canApproveRegistrations(roles: readonly UserRole[]) {
  return can(roles, "registros_aprobar");
}

// Días del check de bienestar (set_wellness_days): por defecto head coach, manager y preparador físico.
export function canSetWellnessDays(roles: readonly UserRole[]) {
  return can(roles, "check_dias");
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
  if (hasEffectivePermissions(roles)) return can(roles, "lesiones_revisar");
  return can(roles, "lesiones_revisar") || kineDelegateId === userId;
}

// Crean, editan y cancelan eventos del calendario: head coach, manager y
// entrenador. Igual que private.events_actor_club() en la base (0022).
export const EVENT_ROLES = ["head_coach", "manager", "entrenador"] as const satisfies readonly UserRole[];

export function canManageEvents(roles: readonly UserRole[]) {
  return can(roles, "eventos_editar");
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

