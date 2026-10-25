import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ACTIVE_CLUB_COOKIE, fetchWithActiveClub } from "@/lib/active-club";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde un Server Component: la sesión se refresca en proxy.ts.
          }
        },
      },
      // Plantel activo en cada llamada (header x-club-id). La cookie ya viene
      // validada por el proxy; se lee en cada llamada porque una acción puede
      // cambiarla a mitad del request.
      global: {
        fetch: fetchWithActiveClub(() => cookieStore.get(ACTIVE_CLUB_COOKIE)?.value),
      },
    },
  );
}
