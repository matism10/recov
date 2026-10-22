// URL estable de una foto privada (perfil o portada del club). En vez de una URL
// firmada nueva en cada carga (que el navegador no puede guardar), apunta a /foto,
// que descarga el archivo con la sesión de quien la pide (las políticas de Storage
// deciden, igual que al firmar) y responde con caché privado de 1 hora. Cada subida
// usa un nombre de archivo nuevo, así que una URL siempre es la misma imagen.
// Los documentos médicos NO pasan por aquí: siguen con URL firmada de 5 minutos.
export const PHOTO_BUCKETS = ["avatars", "club-covers"] as const;
export type PhotoBucket = (typeof PHOTO_BUCKETS)[number];

export function photoUrl(bucket: PhotoBucket, path: string): string {
  return `/foto?b=${bucket}&p=${encodeURIComponent(path)}`;
}
