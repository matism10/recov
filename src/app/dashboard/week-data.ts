// Datos de "Mi semana" (Resumen, todos los confirmados): días de cancha, gimnasio y
// partido de la semana en curso (lunes a domingo, Chile).
//   Jugador: los eventos del formato activo y sus sesiones del plan (my_gym_week).
//   Staff: los eventos del club (formato activo) y los días con algún plan publicado.
import type { createClient } from "@/lib/supabase/server";
import type { Format } from "@/lib/sevens";
import { addDays } from "@/lib/injuries";
import { chileDateTime, chileToIso } from "@/lib/events";
import { currentWeek, getMyGymWeek } from "@/lib/gym";
import type { EventSheetData } from "@/app/calendario/event-sheet";

type Client = Awaited<ReturnType<typeof createClient>>;

export type WeekItem = {
  kind: "G" | "E" | "P";
  title: string;
  detail: string | null;
  href: string | null;
  done?: boolean;
  // Eventos (E y P): se abren en la hoja de detalle, sin navegar.
  event?: EventSheetData;
};
export type WeekDay = { date: string; items: WeekItem[] };
export type WeekData = { today: string; days: WeekDay[] };

export async function getWeekData(
  supabase: Client,
  clubId: string,
  format: Format,
  who: { player: boolean; staff: boolean },
): Promise<WeekData> {
  const { today, monday, sunday } = currentWeek();
  const from = chileToIso(monday, "00:00")!;
  const to = chileToIso(addDays(sunday, 1), "00:00")!;

  const [events, gymWeek, plans] = await Promise.all([
    supabase
      .from("events")
      .select("id, type, starts_at, ends_at, location, opponent, notes, cancelled_at")
      .eq("club_id", clubId)
      .eq("format", format)
      .is("cancelled_at", null)
      .gte("starts_at", from)
      .lt("starts_at", to)
      .order("starts_at")
      .then(({ data }) => data ?? []),
    who.player ? getMyGymWeek(supabase, monday) : [],
    // Staff: planes publicados vigentes esta semana, con sus sesiones (RLS: staff del club).
    who.staff && !who.player
      ? supabase
          .from("gym_plans")
          .select("id, name, starts_on, ends_on, gym_plan_sessions(label, weekday, archived_at)")
          .eq("club_id", clubId)
          .eq("status", "publicado")
          .lte("starts_on", sunday)
          .gte("ends_on", monday)
          .then(({ data }) => data ?? [])
      : [],
  ]);

  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => ({ date: addDays(monday, i), items: [] }));
  const byDate = new Map(days.map((d) => [d.date, d]));

  for (const g of gymWeek) {
    byDate.get(g.date)?.items.push({
      kind: "G",
      title: `Gimnasio · ${g.label}`,
      detail: g.done ? "Hecha" : `~${g.est_minutes} min`,
      href: g.date >= addDays(today, -2) && g.date <= today ? "/mi-plan" : null,
      done: g.done,
    });
  }
  for (const p of plans) {
    for (const s of (p.gym_plan_sessions ?? []) as { label: string; weekday: number; archived_at: string | null }[]) {
      if (s.archived_at) continue;
      const date = addDays(monday, s.weekday - 1);
      if (date < (p.starts_on as string) || date > (p.ends_on as string)) continue;
      byDate.get(date)?.items.push({ kind: "G", title: `Gimnasio · ${s.label}`, detail: p.name as string, href: `/planes/${p.id}` });
    }
  }
  for (const e of events) {
    const { date, time } = chileDateTime(e.starts_at as string);
    const match = e.type === "competencia";
    byDate.get(date)?.items.push({
      kind: match ? "P" : "E",
      title: match ? (e.opponent ? `Partido vs. ${e.opponent}` : "Partido") : "Entrenamiento",
      detail: time,
      href: null,
      event: {
        id: e.id as string,
        type: e.type as EventSheetData["type"],
        day: date,
        start: time,
        end: chileDateTime(e.ends_at as string).time,
        location: (e.location as string | null) ?? null,
        opponent: (e.opponent as string | null) ?? null,
        notes: (e.notes as string | null) ?? null,
        cancelled: e.cancelled_at != null,
      },
    });
  }
  // Orden dentro del día: E, G, P (como la leyenda).
  const order = { E: 0, G: 1, P: 2 };
  for (const d of days) d.items.sort((a, b) => order[a.kind] - order[b.kind]);
  return { today, days };
}
