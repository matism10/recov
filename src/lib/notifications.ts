// Notificaciones del Resumen (20261107180000 a 184000). Dos tipos:
// - De evento: filas de public.notifications (las crea la base al ocurrir algo) que se
//   quedan hasta descartarlas.
// - De estado: se calculan al leer (my_state_notifications del jugador y
//   my_staff_state_notifications del staff) y se ven mientras la condición sea cierta.
// Aquí se arman los textos, el color (por tipo) y el link de cada tarjeta. En la
// interfaz nunca se dice "riesgo de lesión": "Carga alta" y "Bajo lo habitual".
import type { createClient } from "@/lib/supabase/server";
import type { Format } from "@/lib/sevens";
import { chileDateTime, compactDayLabel, type EventType } from "@/lib/events";
import { AVAILABILITY_LABEL, ROLE_LABEL, type Availability, type UserRole } from "@/lib/roles";
import { SEVERITY_LABEL, todayInChile, type InjurySeverity } from "@/lib/injuries";
import { isBodyZone, isLaterality, zoneLabel } from "@/lib/body-zones";
import { formatValue, type DisplayFormat } from "@/lib/evaluations";
import { lowItemsText, sessionWhen, type WellnessItem } from "@/lib/srpe";
import { PITCH_LAYOUTS, pitchKind } from "@/lib/pitch";

type Client = Awaited<ReturnType<typeof createClient>>;

// ---------------------------------------------------------------------------
// Colores (por tipo) e íconos
// ---------------------------------------------------------------------------
export type NoticeTone = "rojo" | "celeste" | "naranjo" | "azul" | "gris";

export const TONE_COLOR: Record<NoticeTone, string> = {
  rojo: "#E24B4A",
  celeste: "#7DD3FC",
  naranjo: "#F97316",
  azul: "#0369A1",
  gris: "#888780",
};

// Grupos de la hoja "Ver todas", en este orden.
export const TONE_GROUPS: { tone: NoticeTone; label: string }[] = [
  { tone: "rojo", label: "Cambios y alertas" },
  { tone: "celeste", label: "Calendario y nóminas" },
  { tone: "naranjo", label: "Lesiones" },
  { tone: "azul", label: "Gimnasio y evaluaciones" },
  { tone: "gris", label: "Cuenta y registros" },
];

// Nombre del ícono (lucide); el componente del cliente lo traduce.
export type NoticeIcon =
  | "calendar-x"
  | "calendar-plus"
  | "calendar-clock"
  | "clipboard"
  | "user-minus"
  | "stethoscope"
  | "circle-check"
  | "list-checks"
  | "party"
  | "activity"
  | "alert"
  | "dumbbell"
  | "gauge"
  | "badge-check"
  | "user-cog"
  | "users"
  | "arrows"
  | "user-plus"
  | "file"
  | "key"
  | "chart"
  | "biceps"
  | "heart"
  | "trending-up"
  | "trending-down"
  | "timer"
  | "calendar-check";

// Tarjeta lista para mostrar (viaja al cliente).
export type NoticeCard = {
  key: string;
  // id de la fila en notifications: solo las de evento (se pueden descartar).
  id: string | null;
  tone: NoticeTone;
  icon: NoticeIcon;
  title: string;
  detail: string | null;
  href: string | null;
  // "Vence en 5 h" (de estado, si vence en menos de 12 h) o "Hoy", "Ayer", "Lun 2 nov".
  badge: string | null;
  urgent: boolean;
  // Orden: menor primero (urgentes, luego rojas, luego de estado, luego de evento).
  rank: number;
  // Desempate dentro del mismo rango (ms; mayor = más reciente o más próximo).
  time: number;
};

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------
export type StoredNotification = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
};

// Notificaciones de evento vivas del plantel activo (RLS: solo las propias), de los
// últimos 30 días. Si falla, ninguna: el Resumen no debe romperse por esto.
export async function getMyNotifications(supabase: Client, clubId: string): Promise<StoredNotification[]> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, payload, created_at")
    .eq("club_id", clubId)
    .is("dismissed_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return data as StoredNotification[];
}

export type PlayerStateRow = {
  kind: "session" | "gym" | "wellness";
  ref_id: string | null;
  event_type: EventType | null;
  starts_at: string | null;
  ends_at: string | null;
  opponent: string | null;
  location: string | null;
  minutes: number | null;
  estimated: boolean | null;
  report_date: string | null;
  deadline: string;
  urgent: boolean;
};

// Jugador: sRPE, esfuerzo del gimnasio y check de bienestar por responder.
export async function getMyStateNotifications(supabase: Client, format: Format): Promise<PlayerStateRow[]> {
  const { data, error } = await supabase.rpc("my_state_notifications", { p_format: format });
  if (error || !data) return [];
  return data as PlayerStateRow[];
}

export type StaffStateRow = {
  kind: string;
  ref_id: string | null;
  occurs_at: string | null;
  payload: Record<string, unknown>;
};

// Staff: carga alta, bienestar bajo, listas, nóminas, altas y planes (según permisos).
export async function getMyStaffStateNotifications(supabase: Client, format: Format): Promise<StaffStateRow[]> {
  const { data, error } = await supabase.rpc("my_staff_state_notifications", { p_format: format });
  if (error || !data) return [];
  return data as StaffStateRow[];
}

// ---------------------------------------------------------------------------
// Ayudas de texto
// ---------------------------------------------------------------------------
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : null);

const eventNoun = (type: unknown) => (type === "competencia" ? "partido" : "entrenamiento");
const vsRival = (opponent: unknown) => (str(opponent) ? ` vs ${opponent}` : "");

function eventWhen(startsAt: unknown) {
  return typeof startsAt === "string" ? sessionWhen(startsAt) : null;
}

function calendarHref(p: Record<string, unknown>) {
  const id = str(p.event_id);
  const startsAt = str(p.starts_at);
  if (!id) return "/calendario";
  return startsAt ? `/calendario?fecha=${chileDateTime(startsAt).date}&evento=${id}` : `/calendario?evento=${id}`;
}

// "Hoy", "Ayer" o "Lun 2 nov" de un instante.
function relativeDay(instant: string) {
  const day = chileDateTime(instant).date;
  const today = todayInChile();
  if (day === today) return "Hoy";
  const yesterday = new Date(`${today}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (day === yesterday.toISOString().slice(0, 10)) return "Ayer";
  return compactDayLabel(day);
}

function hoursLeft(deadline: string) {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 3_600_000) return "Vence en menos de 1 h";
  return `Vence en ${Math.floor(ms / 3_600_000)} h`;
}

function joinRoles(roles: unknown) {
  if (!Array.isArray(roles)) return "";
  const labels = roles.map((r) => ROLE_LABEL[r as UserRole] ?? String(r));
  return labels.length <= 1 ? (labels[0] ?? "") : `${labels.slice(0, -1).join(", ")} y ${labels.at(-1)}`;
}

function injuryTitle(p: Record<string, unknown>) {
  return isBodyZone(p.body_zone) && isLaterality(p.laterality)
    ? zoneLabel(p.body_zone, p.laterality)
    : (str(p.injury_type) ?? "Lesión");
}

function callupDetail(p: Record<string, unknown>) {
  const slot = num(p.slot);
  const role = str(p.role);
  const kind = pitchKind(str(p.sport), p.format === "7" ? "7" : "15");
  let spot = "Convocado";
  if (slot && role === "banca") spot = `Banca · ${slot}`;
  else if (slot && role === "titular") {
    const position = kind ? PITCH_LAYOUTS[kind].find((s) => s.slot === slot)?.position : null;
    spot = position ? `Titular · ${slot} · ${position}` : `Titular · ${slot}`;
  }
  return [spot, eventWhen(p.starts_at)].filter(Boolean).join(" · ");
}

const RED_KINDS = new Set(["evento_cancelado", "evento_modificado", "carga_alta", "bienestar_bajo"]);

// ---------------------------------------------------------------------------
// Tarjetas de evento
// ---------------------------------------------------------------------------
export function storedCard(n: StoredNotification, ctx: { clubName: string | null }): NoticeCard | null {
  const p = n.payload ?? {};
  const base = {
    key: n.id,
    id: n.id,
    badge: relativeDay(n.created_at),
    urgent: false,
    rank: RED_KINDS.has(n.kind) ? 1 : 3,
    time: new Date(n.created_at).getTime(),
  };
  const sevens = p.format === "7" ? " · Sevens" : "";

  switch (n.kind) {
    // 1 · Evento cancelado
    case "evento_cancelado":
      return {
        ...base,
        tone: "rojo",
        icon: "calendar-x",
        title: `Se canceló el ${eventNoun(p.event_type)}${vsRival(p.opponent)}`,
        detail: `${eventWhen(p.starts_at) ?? ""}${sevens}` || null,
        href: calendarHref(p),
      };
    // 2 · Evento nuevo
    case "evento_nuevo": {
      const weeks = num(p.weeks) ?? 1;
      return {
        ...base,
        tone: "celeste",
        icon: "calendar-plus",
        title: p.event_type === "competencia" ? `Nuevo partido${vsRival(p.opponent)}` : "Nuevo entrenamiento",
        detail:
          [eventWhen(p.starts_at), weeks > 1 ? `cada semana (${weeks} semanas)` : null, str(p.location)]
            .filter(Boolean)
            .join(" · ") + sevens || null,
        href: calendarHref(p),
      };
    }
    // 3 · Evento modificado (fecha, hora o lugar)
    case "evento_modificado": {
      const moved = p.prev_starts_at !== p.starts_at || p.prev_ends_at !== p.ends_at;
      return {
        ...base,
        tone: "rojo",
        icon: "calendar-clock",
        title: `Cambió el ${eventNoun(p.event_type)}${vsRival(p.opponent)}`,
        detail:
          [moved ? `Ahora: ${eventWhen(p.starts_at)}` : eventWhen(p.starts_at), str(p.location) ? `en ${p.location}` : null]
            .filter(Boolean)
            .join(" · ") + sevens || null,
        href: calendarHref(p),
      };
    }
    // 4 · Convocado (titular o banca y puesto)
    case "convocado":
      return {
        ...base,
        tone: "celeste",
        icon: "clipboard",
        title: `Te convocaron${vsRival(p.opponent) || " al partido"}`,
        detail: callupDetail(p),
        href: str(p.event_id) ? `/nominas/${p.event_id}` : "/nominas",
      };
    // 5 · Quitado de una nómina
    case "quitado_nomina":
      return {
        ...base,
        tone: "celeste",
        icon: "user-minus",
        title: `Ya no estás en la nómina${vsRival(p.opponent) || " del partido"}`,
        detail: eventWhen(p.starts_at),
        href: str(p.event_id) ? `/nominas/${p.event_id}` : "/nominas",
      };
    // 6 · Lesión confirmada (gravedad y alta estimada)
    case "lesion_confirmada": {
      const severity = SEVERITY_LABEL[p.severity as InjurySeverity];
      const back = str(p.expected_return_on);
      return {
        ...base,
        tone: "naranjo",
        icon: "stethoscope",
        title: "El kinesiólogo confirmó tu lesión",
        detail:
          [str(p.injury_type), severity, back ? `alta estimada: ${compactDayLabel(back)}` : null].filter(Boolean).join(" · ") ||
          null,
        href: str(p.injury_id) ? `/lesiones/${p.injury_id}` : null,
      };
    }
    // 7 · Lesión descartada
    case "lesion_descartada":
      return {
        ...base,
        tone: "naranjo",
        icon: "circle-check",
        title: "Se descartó tu lesión",
        detail: str(p.injury_type),
        href: str(p.injury_id) ? `/lesiones/${p.injury_id}` : null,
      };
    // 8 · Cambio de fase
    case "fase_cambio":
      return {
        ...base,
        tone: "naranjo",
        icon: "list-checks",
        title: `Pasaste a la fase ${str(p.phase_name) ?? "siguiente"}`,
        detail: [str(p.injury_type), str(p.prev_phase_name) ? `antes: ${p.prev_phase_name}` : null].filter(Boolean).join(" · ") || null,
        href: str(p.injury_id) ? `/lesiones/${p.injury_id}` : null,
      };
    // 9 · Alta
    case "alta":
      return {
        ...base,
        tone: "naranjo",
        icon: "party",
        title: "¡Te dieron de alta!",
        detail: str(p.injury_type),
        href: str(p.injury_id) ? `/lesiones/${p.injury_id}` : null,
      };
    // 10 · Cambio de disponibilidad a mano
    case "disponibilidad": {
      const to = AVAILABILITY_LABEL[p.to as Availability] ?? String(p.to ?? "");
      const from = AVAILABILITY_LABEL[p.from as Availability];
      return {
        ...base,
        tone: "naranjo",
        icon: "activity",
        title: `Tu disponibilidad cambió a ${to}`,
        detail: from ? `Antes: ${from}` : null,
        href: null,
      };
    }
    // 11 · Marcado lesionado en terreno
    case "marcado_lesionado":
      return {
        ...base,
        tone: "naranjo",
        icon: "alert",
        title: "Te marcaron lesionado: sube tu diagnóstico",
        detail: "Agrega lo que te indicó el médico para que el kinesiólogo lo revise.",
        href: str(p.injury_id) ? `/lesiones/${p.injury_id}/completar` : null,
      };
    // 12 · Plan de gimnasio nuevo o modificado
    case "plan_gimnasio":
      return {
        ...base,
        tone: "azul",
        icon: "dumbbell",
        title: p.change === "modificado" ? "Se actualizó tu plan de gimnasio" : "Tienes un plan de gimnasio nuevo",
        detail: str(p.plan_name),
        href: "/mi-plan",
      };
    // 13 · Resultado de evaluación
    case "evaluacion_resultado": {
      const value = num(p.value);
      const shown =
        value !== null
          ? formatValue(value, {
              unit: str(p.unit) ?? "",
              display_format: (p.display_format === "mmss" ? "mmss" : "number") as DisplayFormat,
            })
          : null;
      return {
        ...base,
        tone: "azul",
        icon: "gauge",
        title: `Nuevo resultado: ${str(p.test_name) ?? "evaluación"}`,
        detail: [shown, str(p.measured_on) ? compactDayLabel(String(p.measured_on)) : null].filter(Boolean).join(" · ") || null,
        href: "/evaluaciones/mias",
      };
    }
    // 14 · Registro aprobado
    case "registro_aprobado":
      return {
        ...base,
        tone: "gris",
        icon: "badge-check",
        title: ctx.clubName ? `¡Bienvenido a ${ctx.clubName}!` : "¡Bienvenido al plantel!",
        detail: "La dirección aprobó tu registro.",
        href: null,
      };
    // 15 · Cambio de roles
    case "roles_cambio":
      return {
        ...base,
        tone: "gris",
        icon: "user-cog",
        title: "Cambiaron tus roles",
        detail: joinRoles(p.roles) ? `Ahora: ${joinRoles(p.roles)}` : null,
        href: null,
      };
    // 16 · Agregado al grupo Sevens
    case "sevens_agregado":
      return {
        ...base,
        tone: "gris",
        icon: "users",
        title: "Te sumaron al grupo Sevens",
        detail: "Elige Sevens arriba del Resumen para ver su calendario y nóminas.",
        href: null,
      };
    // 17 · Cambio de posición
    case "posicion_cambio": {
      const pos = str(p.position);
      const changedMain = p.position !== p.prev_position;
      const changedSevens = p.sevens_position !== p.prev_sevens_position && str(p.sevens_position);
      const title = changedMain && pos
        ? `Tu posición cambió a ${pos}`
        : changedSevens
          ? `Tu posición en Sevens cambió a ${p.sevens_position}`
          : str(p.secondary)
            ? `Tu posición secundaria cambió a ${p.secondary}`
            : "Cambió tu posición";
      return { ...base, tone: "gris", icon: "arrows", title, detail: null, href: "/perfil" };
    }
    // 20 · Registro nuevo (staff)
    case "registro_pendiente": {
      const role = p.kind === "staff" ? ROLE_LABEL[p.requested_role as UserRole] : null;
      return {
        ...base,
        tone: "gris",
        icon: "user-plus",
        title: `Registro nuevo: ${str(p.name) ?? "por revisar"}`,
        detail: p.kind === "staff" ? `Staff${role ? ` · ${role}` : ""}` : "Jugador",
        href: "/registros",
      };
    }
    // 21 · Lesión nueva para revisar (staff)
    case "lesion_por_revisar": {
      const docs = num(p.documents) ?? 0;
      return {
        ...base,
        tone: "naranjo",
        icon: "stethoscope",
        title: `Lesión por revisar: ${str(p.player_name) ?? "jugador"}`,
        detail: [injuryTitle(p), docs === 0 ? "Sin documento" : null].filter(Boolean).join(" · "),
        href: str(p.injury_id) ? `/lesiones/${p.injury_id}` : "/lesiones",
      };
    }
    // 22 · Documento subido o reemplazado (staff)
    case "documento_subido":
      return {
        ...base,
        tone: "naranjo",
        icon: "file",
        title: `${str(p.player_name) ?? "Un jugador"} subió un documento`,
        detail: [injuryTitle(p), str(p.file_name)].filter(Boolean).join(" · "),
        href: str(p.injury_id) ? `/lesiones/${p.injury_id}` : "/lesiones",
      };
    // 23 · Función asignada (staff)
    case "funcion_asignada":
      return {
        ...base,
        tone: "gris",
        icon: "key",
        title: p.funcion === "nominas" ? "Ahora eres delegado de nóminas" : "Ahora eres delegado de kinesiología",
        detail:
          p.funcion === "nominas"
            ? "Puedes armar nóminas y cargar la participación."
            : "Puedes revisar lesiones, sus documentos y la disponibilidad.",
        href: p.funcion === "nominas" ? "/nominas" : "/lesiones",
      };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Tarjetas de estado
// ---------------------------------------------------------------------------
// Jugador (18, 19 y el esfuerzo del gimnasio): los mismos links de "Pendientes".
export function playerStateCard(r: PlayerStateRow): NoticeCard | null {
  const urgent = r.urgent;
  const base = {
    id: null,
    urgent,
    badge: urgent ? hoursLeft(r.deadline) : null,
    rank: urgent ? 0 : 2,
    // Lo que vence antes va primero.
    time: -new Date(r.deadline).getTime(),
  };
  const today = todayInChile();
  if (r.kind === "session" && r.ref_id) {
    return {
      ...base,
      key: `session:${r.ref_id}`,
      tone: "celeste",
      icon: "chart",
      title: r.event_type === "competencia" ? "¿Qué tan duro fue el partido?" : "¿Qué tan duro fue el entrenamiento?",
      detail: `${r.starts_at ? sessionWhen(r.starts_at) : ""} · ${r.minutes ?? 0} min${r.estimated ? " (estimado)" : ""}`,
      href: `/reportar/${r.ref_id}`,
    };
  }
  if (r.kind === "gym" && r.ref_id) {
    return {
      ...base,
      key: `gym:${r.ref_id}`,
      tone: "azul",
      icon: "biceps",
      title: "¿Qué tan dura fue la sesión de gimnasio?",
      detail: `${r.report_date === today ? "Hoy" : r.report_date ? compactDayLabel(r.report_date) : ""} · ${
        r.location ?? "Por tu cuenta"
      } · ${r.minutes ?? 0} min`,
      href: `/mi-plan/esfuerzo/${r.ref_id}`,
    };
  }
  if (r.kind === "wellness") {
    return {
      ...base,
      key: "wellness",
      tone: "celeste",
      icon: "heart",
      title: "Check de bienestar",
      detail: `${r.report_date === today ? "Hoy" : r.report_date ? `Del ${compactDayLabel(r.report_date)}` : ""} · 5 preguntas`,
      href: "/bienestar",
    };
  }
  return null;
}

// Staff (24 a 29).
export function staffStateCard(r: StaffStateRow): NoticeCard | null {
  const p = r.payload ?? {};
  const at = r.occurs_at ? new Date(r.occurs_at).getTime() : 0;
  const base = { id: null, urgent: false, badge: null as string | null, rank: 2, time: at };
  const name = str(p.player_name) ?? "Jugador";
  switch (r.kind) {
    case "carga_alta": {
      const pct = num(p.pct_over);
      return {
        ...base,
        rank: 1,
        key: `carga:${r.ref_id}`,
        tone: "rojo",
        icon: "trending-up",
        title: `Carga alta: ${name}`,
        detail: pct !== null ? `+${pct} % sobre su promedio de 4 semanas` : "Esta semana, sobre su promedio",
        href: r.ref_id ? `/jugadores/${r.ref_id}` : null,
      };
    }
    case "bienestar_bajo": {
      const items = Array.isArray(p.low_items) ? (p.low_items as WellnessItem[]) : [];
      return {
        ...base,
        rank: 1,
        key: `bienestar:${r.ref_id}`,
        tone: "rojo",
        icon: "trending-down",
        title: `Bajo lo habitual: ${name}`,
        detail: [num(p.total) !== null ? `Bienestar ${p.total} / 25` : null, items.length ? lowItemsText(items) : null]
          .filter(Boolean)
          .join(" · "),
        href: r.ref_id ? `/jugadores/${r.ref_id}` : null,
      };
    }
    case "sin_lista":
      return {
        ...base,
        key: `lista:${r.ref_id}`,
        tone: "celeste",
        icon: "list-checks",
        title: "Entrenamiento sin lista",
        detail: eventWhen(p.starts_at),
        href: r.ref_id ? `/calendario/${r.ref_id}/asistencia` : "/calendario",
      };
    case "sin_nomina":
      return {
        ...base,
        // El partido más próximo primero.
        time: -at,
        key: `nomina:${r.ref_id}`,
        tone: "celeste",
        icon: "clipboard",
        title: `Partido sin nómina${vsRival(p.opponent)}`,
        detail: eventWhen(p.starts_at),
        href: r.ref_id ? `/calendario/${r.ref_id}/disponibles` : "/nominas",
      };
    case "sin_participacion":
      return {
        ...base,
        key: `participacion:${r.ref_id}`,
        tone: "celeste",
        icon: "timer",
        title: `Falta la participación${vsRival(p.opponent) || " del partido"}`,
        detail: eventWhen(p.starts_at),
        href: r.ref_id ? `/calendario/${r.ref_id}/participacion` : "/nominas",
      };
    case "alta_estimada": {
      const days = num(p.days) ?? 0;
      const when =
        days < 0 ? `vencida hace ${-days} ${days === -1 ? "día" : "días"}` : days === 0 ? "hoy" : `en ${days} ${days === 1 ? "día" : "días"}`;
      return {
        ...base,
        time: -at,
        key: `alta:${r.ref_id}`,
        tone: "naranjo",
        icon: "calendar-check",
        title: `Alta estimada ${when}: ${name}`,
        detail: str(p.injury_type),
        href: r.ref_id ? `/lesiones/${r.ref_id}` : "/lesiones",
      };
    }
    case "plan_sin_test": {
      const players = num(p.players) ?? 0;
      const tests = Array.isArray(p.tests)
        ? (p.tests as { test_name?: string }[]).map((t) => t.test_name).filter(Boolean).join(", ")
        : "";
      return {
        ...base,
        key: `plan:${r.ref_id}`,
        tone: "azul",
        icon: "gauge",
        title: `${players} ${players === 1 ? "jugador" : "jugadores"} sin test en ${str(p.plan_name) ?? "un plan"}`,
        detail: tests ? `Falta: ${tests}` : null,
        href: r.ref_id ? `/planes/${r.ref_id}` : "/planes",
      };
    }
    default:
      return null;
  }
}

// Todas las tarjetas, ordenadas: urgentes, rojas, de estado y de evento.
export function sortCards(cards: NoticeCard[]) {
  return [...cards].sort((a, b) => a.rank - b.rank || b.time - a.time);
}
