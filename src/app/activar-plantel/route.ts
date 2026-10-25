import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_CLUB_COOKIE, ACTIVE_CLUB_COOKIE_OPTIONS, isUuid } from "@/lib/active-club";

// Activa un plantel y entra a la app: /activar-plantel?club=<id>[&next=/ruta].
// La usan el link del plantel (/c/[slug]) y "Ir a <plantel>" después de enviar una
// solicitud, porque una página no puede escribir cookies. Solo activa planteles
// donde la cuenta está confirmada; si no, entra igual y el proxy elige uno válido.
export async function GET(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get("club");
  const nextParam = request.nextUrl.searchParams.get("next") ?? "/dashboard";
  // Solo rutas internas (evita redirigir a otro sitio).
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";
  const response = NextResponse.redirect(new URL(next, request.url));

  if (!isUuid(clubId)) return response;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.redirect(new URL("/login", request.url));

  const { data } = await supabase
    .from("club_members")
    .select("club_id")
    .eq("user_id", userId)
    .eq("club_id", clubId)
    .eq("status", "confirmado")
    .maybeSingle();
  if (data) response.cookies.set(ACTIVE_CLUB_COOKIE, clubId, ACTIVE_CLUB_COOKIE_OPTIONS);
  return response;
}
