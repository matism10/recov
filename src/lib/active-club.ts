// Plantel activo: una cuenta puede pertenecer a varios planteles (club_members) y
// trabaja en uno a la vez. Se guarda en la cookie recov_club y viaja a Supabase en el
// header x-club-id (lo lee private.active_club_id() en la base). La cookie no es
// httpOnly porque el cliente del navegador la lee para mandar el header; no es un
// secreto: la base la valida contra las membresías de la cuenta.
// Este archivo no importa nada del servidor: lo usan el proxy, los clientes de
// Supabase (servidor y navegador) y las páginas.

export const ACTIVE_CLUB_COOKIE = "recov_club";
export const ACTIVE_CLUB_HEADER = "x-club-id";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return !!value && UUID_RE.test(value);
}

// Un año: se corrige en cada request si la membresía cambia.
export const ACTIVE_CLUB_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 365,
  secure: process.env.NODE_ENV === "production",
  httpOnly: false,
};

type Membership = { club_id: string; status: string; created_at: string };

// Plantel activo válido para la cuenta: el de la cookie si es una membresía
// confirmada; si no, el confirmado más antiguo; sin ninguno confirmado, null (la
// app usa el plantel principal y muestra la pantalla de pendiente).
export function pickActiveClub(
  memberships: readonly Membership[],
  cookieValue: string | null | undefined,
): string | null {
  const confirmed = memberships
    .filter((m) => m.status === "confirmado")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (cookieValue && confirmed.some((m) => m.club_id === cookieValue)) return cookieValue;
  return confirmed[0]?.club_id ?? null;
}

// fetch para el cliente de Supabase que agrega x-club-id a las llamadas a la API
// (PostgREST, Storage y funciones). Lee el plantel en cada llamada, así un cambio
// de plantel se nota sin recrear el cliente. Auth no lo necesita y no se le manda.
export function fetchWithActiveClub(readClubId: () => string | null | undefined): typeof fetch {
  return (input, init) => {
    const clubId = readClubId();
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!isUuid(clubId) || url.includes("/auth/v1/")) return fetch(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set(ACTIVE_CLUB_HEADER, clubId);
    return fetch(input, { ...init, headers });
  };
}
