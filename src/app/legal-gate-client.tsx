"use client";

import { usePathname } from "next/navigation";
import { isLegalExempt } from "@/lib/legal/gate";

// Muestra la pantalla bloqueante en lugar de la página, salvo en las rutas exentas.
export function LegalGateClient({ blocker, children }: { blocker: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  return isLegalExempt(pathname) ? children : blocker;
}
