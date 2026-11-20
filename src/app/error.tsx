"use client";

import { useEffect } from "react";
import Link from "next/link";
import { EmptyState } from "@/app/ui-blocks";
import { buttonPrimary, buttonSecondary } from "@/app/ui";

// Algo falló al mostrar la pantalla. Se ve dentro del layout de la app (menú y
// encabezado del club). En esta versión de Next la función se llama `retry`.
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:px-8">
      <EmptyState
        title="Algo salió mal"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => retry()} className={buttonPrimary}>
              Reintentar
            </button>
            <Link href="/dashboard" className={buttonSecondary}>
              Ir al Resumen
            </Link>
          </div>
        }
      >
        No pudimos mostrar esta pantalla. Reintenta; si sigue igual, vuelve al Resumen.
      </EmptyState>
    </main>
  );
}
