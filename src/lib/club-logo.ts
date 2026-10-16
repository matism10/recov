// Logo del club (bucket público "club-logos", migración 0021).
import type { SupabaseClient } from "@supabase/supabase-js";

export function clubLogoUrl(supabase: SupabaseClient, path: string | null | undefined) {
  if (!path) return null;
  return supabase.storage.from("club-logos").getPublicUrl(path).data.publicUrl;
}
