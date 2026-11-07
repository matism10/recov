// Quién arma planes de gimnasio: permiso gimnasio_planes (por defecto head coach y
// preparador físico; igual que private.gym_planner_club()). Solo decide qué se muestra.
import type { UserRole } from "@/lib/roles";
import { can } from "@/lib/permissions";

export function canPlanGym(roles: readonly UserRole[]) {
  return can(roles, "gimnasio_planes");
}
