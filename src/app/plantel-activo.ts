"use server";

import { cookies } from "next/headers";
import { getSessionUser, getSupabase } from "@/lib/session";
import { ACTIVE_CLUB_COOKIE, ACTIVE_CLUB_COOKIE_OPTIONS, isUuid } from "@/lib/active-club";
import { FORMAT_COOKIE, FORMAT_COOKIE_OPTIONS, type Format } from "@/lib/sevens";

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
  const store = await cookies();
  store.set(ACTIVE_CLUB_COOKIE, clubId, ACTIVE_CLUB_COOKIE_OPTIONS);
  // Al cambiar de plantel se vuelve a Rugby 15.
  store.set(FORMAT_COOKIE, "15", FORMAT_COOKIE_OPTIONS);
  return { ok: true };
}

// Cambia el formato activo (cookie recov_format). Solo guarda la preferencia:
// getActiveFormat la ignora si el plantel no tiene Sevens o la cuenta no puede usarlo.
export async function setActiveFormat(format: Format): Promise<{ ok: boolean }> {
  if (format !== "15" && format !== "7") return { ok: false };
  const user = await getSessionUser();
  if (!user) return { ok: false };
  (await cookies()).set(FORMAT_COOKIE, format, FORMAT_COOKIE_OPTIONS);
  return { ok: true };
}
