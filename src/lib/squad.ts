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
  // Las fases en curso no dependen de los jugadores: van en paralelo con la cadena
  // jugadores → fotos (que sí necesita los user_id de los jugadores).
  const playersWithAvatars = supabase
    .from("players")
    .select("id, full_name, position, secondary_position, availability, user_id")
    .eq("active", true)
    .eq("status", "confirmado")
    .order("full_name")
    .then(async ({ data }) => {
      const players = (data ?? []) as SquadPlayer[];
      const avatarUrls = await getAvatarUrls(supabase, [
        ...players.map((p) => p.user_id),
        ...extraAvatarIds,
      ]);
      return { players, avatarUrls };
    });

  const [{ players, avatarUrls }, { data: currentPhases }] = await Promise.all([
    playersWithAvatars,
    supabase.rpc("squad_current_phases"),
  ]);
  const phaseByPlayer = new Map(
    ((currentPhases ?? []) as { player_id: string; phase_name: string }[]).map((p) => [
      p.player_id,
      p.phase_name,
    ]),
  );

  return { players, avatarUrls, phaseByPlayer };
}
