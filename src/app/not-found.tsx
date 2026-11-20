import Link from "next/link";
import { EmptyState } from "@/app/ui-blocks";
import { buttonPrimary } from "@/app/ui";

// Página no encontrada, dentro del layout de la app.
export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:px-8">
      <EmptyState
        title="No encontramos esta página"
        action={
          <Link href="/dashboard" className={buttonPrimary}>
            Ir al Resumen
          </Link>
        }
      >
        Puede que el link esté mal escrito o que ya no exista.
      </EmptyState>
    </main>
  );
}
