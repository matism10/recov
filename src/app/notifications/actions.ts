"use server";

// Lista de notificaciones de quien mira (evento + estado), para la campana del
// encabezado. Se pide desde el cliente después de montar: ninguna pantalla la espera.
// Las lecturas son las mismas del Resumen; RLS y los permisos los resuelve la base.
import { getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { isStaff, type UserRole } from "@/lib/roles";
import { getFormatContext } from "@/lib/format";
import {
  getMyNotifications,
  getMyStaffStateNotifications,
  getMyStateNotifications,
  playerStateCard,
  sortCards,
  staffStateCard,
  storedCard,
  type NoticeCard,
} from "@/lib/notifications";

export type NotificationsResult =
  | { ok: true; scope: string; cards: NoticeCard[] }
  | { ok: false };

export async function loadNotifications(): Promise<NotificationsResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false };
  const profile = await getProfile(user.id);
  if (profile?.status !== "confirmado" || !profile.club_id) return { ok: false };

  const supabase = await getSupabase();
  const roles = (profile.roles ?? []) as UserRole[];
  const staff = isStaff(roles);
  const isPlayer = roles.includes("jugador");
  const { format, group } = await getFormatContext(user.id);
  // Las de estado del jugador solo si está en el plantel del formato activo (en Sevens, el grupo).
  const me = isPlayer && (format === "15" || group.has(user.id));

  const [stored, playerState, staffState] = await Promise.all([
    getMyNotifications(supabase, profile.club_id),
    me ? getMyStateNotifications(supabase, format) : [],
    staff ? getMyStaffStateNotifications(supabase, format) : [],
  ]);

  const cards = sortCards(
    [
      ...stored.map((n) => storedCard(n, { clubName: profile.club?.name ?? null, isPlayer })),
      ...playerState.map(playerStateCard),
      ...staffState.map(staffStateCard),
    ].filter((c): c is NoticeCard => c !== null),
  );
  return { ok: true, scope: `${user.id}:${profile.club_id}:${format}`, cards };
}
