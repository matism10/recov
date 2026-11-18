"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { textButton } from "@/app/ui";

// Cuenta las navegaciones dentro de la app. `document.referrer` no se actualiza con la
// navegación del cliente de Next, así que no sirve para saber si hay una pantalla
// anterior de la app. Va una vez en el layout raíz.
let appNavigations = 0;

export function NavTracker() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    appNavigations += 1;
  }, [pathname]);
  return null;
}

// "Volver" que regresa a la pantalla de la que se venía (lista de lesiones,
// plantel, calendario, Resumen…). Si no hay una pantalla anterior de la app
// (link abierto directo, otra pestaña), va a `fallback`.
export function BackLink({
  fallback,
  children = "← Volver",
  className = textButton,
}: {
  fallback: string;
  children?: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <Link
      href={fallback}
      className={className}
      onClick={(e) => {
        // Hubo al menos una navegación dentro de la app: volver a la pantalla anterior.
        const internal = appNavigations > 0 && window.history.length > 1;
        if (internal) {
          e.preventDefault();
          router.back();
        }
      }}
    >
      {children}
    </Link>
  );
}
