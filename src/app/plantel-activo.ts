"use server";

import { cookies } from "next/headers";
import { getSessionUser, getSupabase } from "@/lib/session";
import { ACTIVE_CLUB_COOKIE, ACTIVE_CLUB_COOKIE_OPTIONS, isUuid } from "@/lib/active-club";

// Cambia el plantel activo (cookie recov_club). Solo a un plantel donde la cuenta
// está confirmada; la base igual valida el header en cada llamada. Quien llama hace
// router.refresh() para volver a pedir la página con el plantel nuevo.
export async function setActiveClub(clubId: string): Promise<{ ok: boolean }> {
  if (!isUuid(clubId)) return { ok: false };
  const user = await getSessionUser();
  if (!user) return { ok: false };
  const supabase = await getSupabase();
  const { data } = await supabase
    .from("club_members")
    .select("club_id")
    .eq("user_id", user.id)
    .eq("club_id", clubId)
    .eq("status", "confirmado")
    .maybeSingle();
  if (!data) return { ok: false };
  (await cookies()).set(ACTIVE_CLUB_COOKIE, clubId, ACTIVE_CLUB_COOKIE_OPTIONS);
  return { ok: true };
}
