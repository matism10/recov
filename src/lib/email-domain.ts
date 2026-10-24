import "server-only";
import { resolve4, resolve6, resolveMx } from "node:dns/promises";

// ¿El dominio del correo puede recibir correos? Atrapa errores de tipeo (gmial.com)
// y dominios inventados antes de crear la cuenta. Si el DNS no responde a tiempo o
// falla por otra razón, no se bloquea a nadie.

const TIMEOUT_MS = 3000;
const NOT_FOUND = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN"]);

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "TIMEOUT" })), TIMEOUT_MS)),
  ]);
}

const code = (error: unknown) => (error as { code?: string })?.code ?? "";

export async function emailDomainReceivesMail(email: string): Promise<boolean> {
  const domain = email.split("@")[1]?.trim().toLowerCase();
  if (!domain) return false;

  try {
    const records = await withTimeout(resolveMx(domain));
    // MX nulo (RFC 7505): el dominio declara que no recibe correos.
    if (records.length === 1 && (records[0].exchange === "" || records[0].exchange === ".")) return false;
    if (records.length > 0) return true;
  } catch (error) {
    if (!NOT_FOUND.has(code(error))) return true; // DNS lento o caído: no bloquear
    if (code(error) === "ENOTFOUND" || code(error) === "NXDOMAIN") return false; // el dominio no existe
  }

  // Sin MX: el correo puede llegar igual a la dirección del dominio (RFC 5321).
  for (const resolve of [resolve4, resolve6]) {
    try {
      if ((await withTimeout(resolve(domain))).length > 0) return true;
    } catch (error) {
      if (!NOT_FOUND.has(code(error))) return true;
    }
  }
  return false;
}
