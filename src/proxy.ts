import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

// La landing pública vive en /inicio y se sirve en la raíz de recov.cl. El resto de
// hosts (app, *.vercel.app) no la muestran: /inicio redirige a /.
const LANDING_HOSTS = new Set(["recov.cl", "www.recov.cl"]);

export async function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const { pathname } = request.nextUrl;
  if (LANDING_HOSTS.has(host) && (pathname === "/" || pathname === "/inicio")) {
    const url = request.nextUrl.clone();
    url.pathname = "/inicio";
    return NextResponse.rewrite(url);
  }
  if (pathname === "/inicio") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    // Todo excepto assets estáticos y el manifest de la Web App (sin sesión).
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
