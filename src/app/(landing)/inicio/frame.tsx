import Image from "next/image";
import type { ReactNode } from "react";

export function BrowserFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border-2 border-ink bg-white shadow-[0_20px_50px_rgba(11,27,43,0.22)] ${className}`}>
      <div className="flex h-8 items-center gap-1.5 border-b-2 border-ink bg-landing-wash px-3" aria-hidden="true">
        {[0, 1, 2].map((i) => <span key={i} className="size-2.5 rounded-full bg-landing-line" />)}
      </div>
      {children}
    </div>
  );
}

// Captura con next/image; si el archivo no existe (src null) muestra un bloque gris con el nombre.
export function Shot({
  src, name, width, height, sizes, priority = false, className = "",
}: {
  src: string | null; name: string; width: number; height: number; sizes: string; priority?: boolean; className?: string;
}) {
  if (!src)
    return (
      <div style={{ aspectRatio: `${width} / ${height}` }} className={`flex items-center justify-center bg-landing-fill p-2 text-center text-sm font-semibold text-body-soft ${className}`}>
        {name}
      </div>
    );
  return (
    <Image src={src} alt="" width={width} height={height} sizes={sizes} priority={priority} loading={priority ? undefined : "lazy"} className={`block h-auto w-full ${className}`} />
  );
}
