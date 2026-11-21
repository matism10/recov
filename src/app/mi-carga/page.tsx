import { redirect } from "next/navigation";
import { requireMember } from "@/app/calendario/member";

// Atajo a "Mi carga": la pestaña Carga de la ficha propia del jugador (para el buscador y los links).
export default async function MyLoadShortcutPage() {
  const { supabase, userId, clubId, roles } = await requireMember();
  if (!roles.includes("jugador")) redirect("/dashboard");
  const { data } = await supabase
    .from("players")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .eq("status", "confirmado")
    .maybeSingle();
  if (!data) redirect("/dashboard");
  redirect(`/jugadores/${data.id}?tab=carga`);
}
