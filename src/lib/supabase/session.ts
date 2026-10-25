import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  ACTIVE_CLUB_COOKIE,
  ACTIVE_CLUB_COOKIE_OPTIONS,
  pickActiveClub,
} from "@/lib/active-club";

// Accesibles sin sesión. "/c/" es el link de registro de cada club; /recuperar y
// /restablecer, recuperar contraseña.
// /pendiente no va aquí: requiere sesión, pero no un perfil confirmado.
const PUBLIC_PATHS = ["/login", "/c/", "/recuperar", "/restablecer"];

// Refresca la sesión de Supabase en cada request, protege las rutas privadas y
// valida el plantel activo (cookie recov_club) contra las membresías de la cuenta.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const isLoggedIn = !!userId;
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!isLoggedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Solo el login redirige a quien ya tiene sesión; el link de registro no.
  if (isLoggedIn && pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  const current = request.cookies.get(ACTIVE_CLUB_COOKIE)?.value ?? null;
  let next: string | null = null;
  if (userId) {
    // Membresías propias (RLS: cada cuenta lee las suyas). Una consulta corta por
    // request: así un plantel que deja de ser válido se corrige de inmediato.
    const { data: memberships, error } = await supabase
      .from("club_members")
      .select("club_id, status, created_at")
      .eq("user_id", userId);
    // Si la consulta falla, no se toca la cookie: la base igual valida el header.
    if (error) return response;
    next = pickActiveClub(memberships ?? [], current);
  }
  if (next === current) return response;

  // Corregir la cookie en el request (para que la lean las páginas de este mismo
  // request) y en la respuesta (para el navegador), sin perder las de la sesión.
  if (next) request.cookies.set(ACTIVE_CLUB_COOKIE, next);
  else request.cookies.delete(ACTIVE_CLUB_COOKIE);
  const corrected = NextResponse.next({ request });
  response.cookies.getAll().forEach((c) => corrected.cookies.set(c));
  if (next) corrected.cookies.set(ACTIVE_CLUB_COOKIE, next, ACTIVE_CLUB_COOKIE_OPTIONS);
  else corrected.cookies.delete(ACTIVE_CLUB_COOKIE);
  return corrected;
}
