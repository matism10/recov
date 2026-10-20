// Plantel confirmado y activo del club, con fotos y fase en curso: lo usan el
// Resumen (/dashboard) y la pantalla Plantel (/plantel).
import type { createClient } from "@/lib/supabase/server";
import { getAvatarUrls } from "@/lib/avatars";

type Client = Awaited<ReturnType<typeof createClient>>;

export type SquadPlayer = {
  id: string;
  full_name: string;
  position: string | null;
  secondary_position: string | null;
  availability: string;
  user_id: string | null;
};

export async function getSquad(supabase: Client, extraAvatarIds: string[] = []) {
  // RLS: solo jugadores del club del usuario. La dirección también ve los
  // pendientes, así que se filtra el plantel confirmado.
  const { data } = await supabase
    .from("players")
    .select("id, full_name, position, secondary_position, availability, user_id")
    .eq("active", true)
    .eq("status", "confirmado")
    .order("full_name");
  const players = (data ?? []) as SquadPlayer[];

  // Foto de perfil de los jugadores con cuenta (y de quien la pida, p. ej. el usuario).
  const avatarUrls = await getAvatarUrls(supabase, [
    ...players.map((p) => p.user_id),
    ...extraAvatarIds,
  ]);

  // Fase de recuperación en curso de cada jugador: solo el nombre, visible para
  // todo el club (los jugadores no ven el resto de la lesión de sus compañeros).
  const { data: currentPhases } = await supabase.rpc("squad_current_phases");
  const phaseByPlayer = new Map(
    ((currentPhases ?? []) as { player_id: string; phase_name: string }[]).map((p) => [
      p.player_id,
      p.phase_name,
    ]),
  );

  return { players, avatarUrls, phaseByPlayer };
}
