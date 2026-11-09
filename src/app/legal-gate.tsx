import { getProfile, getSessionUser } from "@/lib/session";
import { pendingLegal } from "@/lib/legal/gate";
import { LegalScreen } from "./legal-consent";
import { LegalGateClient } from "./legal-gate-client";

// Bloquea la app mientras falte aceptar los términos vigentes o, para head coach y
// manager, la declaración del plantel. Usa getProfile (cacheado por request: la misma
// consulta que ya hace la navegación); sin sesión no consulta nada.
export async function LegalGate({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const profile = user ? await getProfile(user.id) : null;
  const pending = profile ? pendingLegal(profile) : null;
  if (!pending) return children;
  return <LegalGateClient blocker={<LegalScreen key={pending} kind={pending} />}>{children}</LegalGateClient>;
}
