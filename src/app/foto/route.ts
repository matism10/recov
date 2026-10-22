// Foto privada (perfil o portada) con caché del navegador. Descarga el archivo con
// la sesión de quien lo pide: las políticas de Storage deciden quién lo ve, igual
// que al firmar una URL (confirmados del club; el pendiente, solo su propia foto).
// Responde con caché privado (solo el navegador de esa persona, nunca un caché
// compartido) de 1 hora, el mismo plazo que tenían las URL firmadas.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PHOTO_BUCKETS, type PhotoBucket } from "@/lib/photos";

const MAX_AGE_SECONDS = 60 * 60;

export async function GET(request: NextRequest) {
  const bucket = request.nextUrl.searchParams.get("b");
  const path = request.nextUrl.searchParams.get("p");
  if (!bucket || !path || !PHOTO_BUCKETS.includes(bucket as PhotoBucket)) {
    return new NextResponse(null, { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    // Sin permiso o sin archivo: lo mismo para quien pregunta.
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }

  return new NextResponse(await data.arrayBuffer(), {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Cache-Control": `private, max-age=${MAX_AGE_SECONDS}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
