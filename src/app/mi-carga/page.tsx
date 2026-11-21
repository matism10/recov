import { redirect } from "next/navigation";
import { requireMember } from "@/app/calendario/member";
import { getActiveFormat } from "@/lib/format";
import { getMyLoadScreen } from "@/lib/my-load";
import { MyLoadScreenView } from "./my-load";

// "Mi carga" (jugador): su carga de la semana, 6 semanas, sesiones y bienestar. Va en
// "Más" y en la sidebar. Solo lecturas que ya existen (src/lib/my-load.ts).
export default async function MyLoadPage() {
  const { supabase, userId, clubId, roles } = await requireMember();
  if (!roles.includes("jugador")) redirect("/dashboard");
  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .eq("status", "confirmado")
    .maybeSingle();
  if (!player) redirect("/dashboard");
  const format = await getActiveFormat(userId);
  const data = await getMyLoadScreen(supabase, { playerId: player.id, clubId }, format);
  return <MyLoadScreenView data={data} format={format} />;
}
