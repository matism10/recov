import { createBrowserClient } from "@supabase/ssr";
import { ACTIVE_CLUB_COOKIE, fetchWithActiveClub } from "@/lib/active-club";

// Plantel activo desde la cookie (no es httpOnly justamente para esto).
function activeClubFromCookie() {
  const match = document.cookie.match(new RegExp(`(?:^|; )${ACTIVE_CLUB_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    // El cliente del navegador es uno solo por pestaña: el header se arma en cada
    // llamada, así sigue al plantel activo después de cambiarlo.
    { global: { fetch: fetchWithActiveClub(activeClubFromCookie) } },
  );
}
