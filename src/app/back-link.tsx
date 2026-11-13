"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { textButton } from "@/app/ui";

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
        let internal = false;
        try {
          internal =
            window.history.length > 1 &&
            !!document.referrer &&
            new URL(document.referrer).origin === window.location.origin;
        } catch {
          internal = false;
        }
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
