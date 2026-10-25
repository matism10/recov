import type { createClient } from "@/lib/supabase/server";

// Nombre y apellido de la cuenta desde su ficha de jugador (la más reciente que RLS
// deja leer). null si no tiene: la cuenta es solo de staff.
export async function accountName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<{ first: string; last: string } | null> {
  const { data } = await supabase
    .from("players")
    .select("first_name, last_name")
    .eq("user_id", userId)
    .not("first_name", "is", null)
    .not("last_name", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ first_name: string; last_name: string }>();
  return data ? { first: data.first_name, last: data.last_name } : null;
}
