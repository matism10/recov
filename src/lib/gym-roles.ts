// Quién arma planes de gimnasio: head coach y preparador físico (igual que
// private.gym_planner_club() en la base). Solo decide qué se muestra.
import type { UserRole } from "@/lib/roles";

export function canPlanGym(roles: readonly UserRole[]) {
  return roles.includes("head_coach") || roles.includes("preparador_fisico");
}
