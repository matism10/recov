// "A quién va" un plan, en una línea: "Todo el plantel", "Sevens", "Pilar, Hooker",
// "3 jugadores" o la combinación.
import type { TargetKind } from "@/lib/gym";

export function targetSummary(targets: { kind: TargetKind; name: string | null }[]) {
  if (targets.length === 0) return "Sin destinatarios";
  if (targets.some((t) => t.kind === "plantel")) return "Todo el plantel";
  const parts: string[] = [];
  if (targets.some((t) => t.kind === "sevens")) parts.push("Sevens");
  const positions = targets.filter((t) => t.kind === "posicion" && t.name).map((t) => t.name!);
  if (positions.length > 0) parts.push(positions.length > 3 ? `${positions.length} posiciones` : positions.join(", "));
  const players = targets.filter((t) => t.kind === "jugador");
  if (players.length === 1 && players[0].name) parts.push(players[0].name);
  else if (players.length > 1) parts.push(`${players.length} jugadores`);
  return parts.join(" · ");
}
