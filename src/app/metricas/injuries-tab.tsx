// Pestaña Lesiones de /metricas: franja de estado, próximas altas y recurrentes, no
// disponibles por semana, lesiones nuevas y lugar, y lesiones por posición. Las
// funciones dash_* validan en la base que quien llama sea staff confirmado.
import type { getSupabase } from "@/lib/session";
import type { Format } from "@/lib/sevens";
import {
  getAvailabilitySeries,
  getDashSummary,
  getInjuriesByPlace,
  getInjuriesByPosition,
  getInjuriesByWeek,
  getPlayersStatus,
  getRecurringPlayers,
  getUpcomingReturns,
} from "@/lib/metrics";
import { getAvatarUrls } from "@/lib/avatars";
import {
  InjuriesByPlaceBlock,
  InjuriesByPositionBlock,
  InjuriesByWeekBlock,
  RecurringPlayersBlock,
  StatusStrip,
  UnavailableWeeksBlock,
  UpcomingReturnsBlock,
} from "./blocks";

type Client = Awaited<ReturnType<typeof getSupabase>>;

export async function InjuriesTab({ supabase, format }: { supabase: Client; format: Format }) {
  const [summary, series, byWeek, byPlace, byPosition, recurring, upcoming] = await Promise.all([
    getDashSummary(supabase, format),
    getAvailabilitySeries(supabase, 12, format),
    getInjuriesByWeek(supabase, 12, format),
    getInjuriesByPlace(supabase, format),
    getInjuriesByPosition(supabase, format),
    getRecurringPlayers(supabase, format),
    getUpcomingReturns(supabase, format),
  ]);

  // Estado y foto solo de los jugadores listados; si falla, iniciales y sin estado.
  const listedIds = [
    ...new Set([
      ...(recurring.ok ? recurring.data.map((p) => p.player_id) : []),
      ...(upcoming.ok ? upcoming.data.map((r) => r.player_id) : []),
    ]),
  ];
  const players = await getPlayersStatus(supabase, listedIds);
  const status = players.ok ? players.data : null;
  const avatarUrls = status
    ? await getAvatarUrls(supabase, [...status.values()].map((p) => p.user_id))
    : new Map<string, string>();

  return (
    <div className="space-y-4">
      <StatusStrip result={summary} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <UpcomingReturnsBlock result={upcoming} status={status} avatarUrls={avatarUrls} />
        </div>
        <RecurringPlayersBlock result={recurring} status={status} avatarUrls={avatarUrls} />
      </div>
      <UnavailableWeeksBlock result={series} summary={summary} />
      <div className="grid gap-4 lg:grid-cols-2">
        <InjuriesByWeekBlock result={byWeek} />
        <InjuriesByPlaceBlock result={byPlace} />
      </div>
      <InjuriesByPositionBlock result={byPosition} />
    </div>
  );
}
