// Índice del buscador universal ("Ir a…"): destinos estáticos por rol. Solo decide qué
// se ofrece; cada pantalla y la base siguen validando el acceso. Los permisos son las
// claves reales del catálogo (private.permissions, replicado en permissions.ts) y los
// `#ancla` apuntan a ids que existen en la pantalla (src/lib/search-index.test.ts).
// Importa con rutas relativas (sin alias @/) para poder correr con node --test.
import { rankBy } from "./search-match.ts";
import type { Permission } from "./permissions.ts";

// "todos": cualquier confirmado. "staff" / "jugador": por rol. "evaluaciones": quien
// puede leerlas. { perm }: basta con uno de los permisos efectivos de la persona.
// { role }: solo ese rol (lo que la base reserva al head coach, sin permiso propio).
export type SearchRule = "todos" | "staff" | "jugador" | "evaluaciones" | { perm: Permission | readonly Permission[] } | { role: string };

export type SearchDestination = {
  id: string;
  title: string;
  // Ruta de contexto: "Métricas › Carga del plantel".
  context: string;
  keywords: readonly string[];
  href: string;
  requires: SearchRule;
};

export const SEARCH_INDEX: readonly SearchDestination[] = [
  { id: "resumen", title: "Resumen", context: "Inicio", keywords: ["inicio", "panel", "home", "principal"], href: "/dashboard", requires: "todos" },
  { id: "zonas", title: "Zonas lesionadas", context: "Resumen › mapa del cuerpo", keywords: ["lugar", "zona", "donde", "mapa", "cuerpo", "dolor"], href: "/dashboard#zonas", requires: { perm: "lesiones_ver" } },
  { id: "lesiones-activas", title: "Lesiones activas", context: "Resumen › lesionados y en reintegro", keywords: ["lesionados", "reintegro", "no disponibles", "bajas"], href: "/dashboard#lesiones-activas", requires: { perm: "lesiones_ver" } },
  { id: "calendario", title: "Calendario", context: "Eventos del plantel", keywords: ["eventos", "partidos", "entrenamientos", "agenda", "fixture", "competencias"], href: "/calendario", requires: "todos" },
  { id: "evento-nuevo", title: "Crear evento", context: "Calendario › nuevo evento", keywords: ["agendar", "entrenamiento", "partido", "competencia", "programar", "nuevo"], href: "/calendario/nuevo", requires: { perm: "eventos_editar" } },
  { id: "pasar-lista", title: "Pasar lista", context: "Calendario › elige un entrenamiento", keywords: ["asistencia", "presentes", "lista"], href: "/calendario", requires: { perm: "lista_pasar" } },
  { id: "avisos-staff", title: "Avisos de ausencia", context: "Calendario › ausencias", keywords: ["ausencias", "faltas", "paron", "avisos", "declarar"], href: "/calendario/ausencias", requires: { perm: "lista_pasar" } },
  { id: "plantel", title: "Plantel", context: "Jugadores del club", keywords: ["jugadores", "equipo", "posiciones", "cancha", "disponibilidad"], href: "/plantel", requires: "todos" },
  { id: "lesiones", title: "Lesiones", context: "Por revisar y en recuperación", keywords: ["lesionados", "por revisar", "fases", "recuperacion", "alta", "diagnostico"], href: "/lesiones", requires: { perm: "lesiones_ver" } },
  { id: "mis-lesiones", title: "Mis lesiones", context: "Mi recuperación", keywords: ["lesion", "fases", "recuperacion", "alta", "diagnostico", "documentos"], href: "/lesiones", requires: "jugador" },
  { id: "registrar-lesion", title: "Registrar lesión", context: "Reportar una lesión", keywords: ["lesionarme", "me lesione", "reportar", "dolor", "golpe", "nueva lesion"], href: "/registrar-lesion", requires: "jugador" },
  { id: "metricas", title: "Métricas", context: "Métricas del plantel", keywords: ["estadisticas", "datos", "graficos", "indicadores"], href: "/metricas", requires: "staff" },
  { id: "metricas-lesiones", title: "Métricas de lesiones", context: "Métricas › Lesiones", keywords: ["estadisticas", "recurrentes", "altas", "no disponibles"], href: "/metricas?tab=lesiones", requires: { perm: "lesiones_ver" } },
  { id: "metricas-carga", title: "Carga del plantel", context: "Métricas › Carga", keywords: ["carga", "esfuerzo", "minutos", "semana"], href: "/metricas?tab=carga", requires: { perm: "carga_ver" } },
  { id: "carga-srpe", title: "Carga sRPE", context: "Métricas › Carga del plantel por semana", keywords: ["srpe", "rpe", "esfuerzo", "carga semanal", "sesiones"], href: "/metricas?tab=carga#carga-semana", requires: { perm: "carga_ver" } },
  { id: "carga-jugador", title: "Carga por jugador", context: "Métricas › Carga › por jugador", keywords: ["carga alta", "srpe", "individual", "semana", "gimnasio"], href: "/metricas?tab=carga#carga-jugador", requires: { perm: "carga_ver" } },
  { id: "paron", title: "Vuelven tras parón", context: "Métricas › Carga por jugador", keywords: ["paron", "vuelta", "ausencia", "retorno", "sin entrenar"], href: "/metricas?tab=carga#carga-jugador", requires: { perm: "carga_ver" } },
  { id: "bienestar-plantel", title: "Bienestar del plantel", context: "Métricas › Carga", keywords: ["bienestar", "check", "sueno", "fatiga", "animo"], href: "/metricas?tab=carga#bienestar-plantel", requires: { perm: "carga_ver" } },
  { id: "minutos", title: "Minutos jugados", context: "Métricas › Carga › ranking", keywords: ["minutos", "partidos", "participacion", "ranking"], href: "/metricas/carga", requires: { perm: "carga_ver" } },
  { id: "asistencia", title: "Asistencia a entrenamientos", context: "Métricas › Asistencia", keywords: ["asistencia", "faltas", "ranking", "presentes", "entrenamientos"], href: "/asistencia", requires: "staff" },
  { id: "nominas", title: "Nóminas", context: "Convocatorias por partido", keywords: ["convocatoria", "partido", "titulares", "banca", "alineacion", "participacion"], href: "/nominas", requires: "todos" },
  { id: "armar-nomina", title: "Armar nómina", context: "Nóminas › próximo partido", keywords: ["convocar", "alineacion", "titulares", "banca", "partido"], href: "/nominas", requires: { perm: "nomina_armar" } },
  { id: "evaluaciones", title: "Evaluaciones", context: "Tests físicos del plantel", keywords: ["tests", "fuerza", "resultados", "fisicas", "pruebas"], href: "/evaluaciones", requires: "evaluaciones" },
  { id: "mis-evaluaciones", title: "Mis evaluaciones", context: "Mis tests físicos", keywords: ["tests", "fuerza", "resultados", "fisicas", "pruebas"], href: "/evaluaciones/mias", requires: "jugador" },
  { id: "planes", title: "Planes de gimnasio", context: "Fuerza y acondicionamiento", keywords: ["gimnasio", "rutina", "ejercicios", "entrenamiento", "fuerza"], href: "/planes", requires: { perm: "gimnasio_planes" } },
  { id: "plan-nuevo", title: "Crear plan de gimnasio", context: "Planes › nuevo plan", keywords: ["gimnasio", "rutina", "ejercicios", "nuevo"], href: "/planes/nuevo", requires: { perm: "gimnasio_planes" } },
  { id: "mi-plan", title: "Mi plan", context: "Gimnasio", keywords: ["gimnasio", "rutina", "ejercicios", "sesion", "hoy toca"], href: "/mi-plan", requires: "jugador" },
  { id: "bienestar", title: "Mi bienestar", context: "Check de bienestar", keywords: ["check", "sueno", "fatiga", "animo", "encuesta", "como estoy"], href: "/bienestar", requires: "jugador" },
  { id: "ausencias", title: "Ausencias", context: "Mis avisos", keywords: ["avisar", "falta", "no puedo ir", "viaje", "avisos"], href: "/ausencias", requires: "jugador" },
  { id: "ausencia-nueva", title: "Avisar una ausencia", context: "Ausencias › nueva", keywords: ["falta", "no puedo ir", "viaje", "aviso", "ausentarme"], href: "/ausencias/nueva", requires: "jugador" },
  { id: "staff", title: "Staff", context: "Roles y permisos", keywords: ["equipo tecnico", "roles", "permisos", "delegar", "kinesiologo", "entrenador", "personas"], href: "/staff", requires: { perm: "staff_gestionar" } },
  { id: "registros", title: "Registros", context: "Solicitudes pendientes", keywords: ["pendientes", "aprobar", "confirmar", "rechazar", "altas", "nuevos"], href: "/registros", requires: { perm: "registros_aprobar" } },
  { id: "configuracion", title: "Configuración", context: "Ajustes del club", keywords: ["ajustes", "club", "opciones", "logo", "portada"], href: "/configuracion", requires: { perm: ["staff_gestionar", "check_dias"] } },
  { id: "config-bienestar", title: "Días del check de bienestar", context: "Configuración › Check de bienestar", keywords: ["bienestar", "dias", "check", "encuesta"], href: "/configuracion#bienestar", requires: { perm: "check_dias" } },
  { id: "config-logo", title: "Logo del plantel", context: "Configuración › Logo", keywords: ["escudo", "imagen", "club"], href: "/configuracion#logo", requires: { perm: "staff_gestionar" } },
  { id: "config-portada", title: "Portada", context: "Configuración › Portada", keywords: ["foto", "imagen", "encabezado", "club"], href: "/configuracion#portada", requires: { perm: "staff_gestionar" } },
  { id: "config-partidos", title: "Registro de partidos", context: "Configuración › Registro de partidos", keywords: ["participacion", "minutos", "modo", "nomina", "rango"], href: "/configuracion#partidos", requires: { perm: "staff_gestionar" } },
  { id: "config-resumen", title: "Métricas del Resumen", context: "Configuración › Métricas del Resumen", keywords: ["resumen", "indicadores", "tarjetas", "inicio"], href: "/configuracion#metricas-resumen", requires: { role: "head_coach" } },
  { id: "sevens", title: "Rugby Sevens", context: "Configuración › Sevens", keywords: ["sevens", "grupo", "formato", "rugby 7", "activar"], href: "/configuracion/sevens", requires: { perm: "sevens_activar" } },
  { id: "perfil", title: "Perfil", context: "Mi cuenta", keywords: ["cuenta", "foto", "contrasena", "telefono", "cerrar sesion", "barra inferior", "datos"], href: "/perfil", requires: "todos" },
];

export type SearchContext = {
  roles: readonly string[];
  // Ya calculados con isStaff(roles) y canReadEvaluations(roles) (roles.ts, evaluations.ts).
  staff: boolean;
  evaluations: boolean;
  // Permisos efectivos de la persona (my_permissions), no la plantilla del rol.
  permissions: readonly string[];
};

export function allows(rule: SearchRule, ctx: SearchContext): boolean {
  if (rule === "todos") return true;
  if (rule === "staff") return ctx.staff;
  if (rule === "jugador") return ctx.roles.includes("jugador");
  if (rule === "evaluaciones") return ctx.evaluations;
  if ("role" in rule) return ctx.roles.includes(rule.role);
  const wanted = Array.isArray(rule.perm) ? rule.perm : [rule.perm as Permission];
  return wanted.some((p) => ctx.permissions.includes(p));
}

export function visibleDestinations(ctx: SearchContext): SearchDestination[] {
  return SEARCH_INDEX.filter((d) => allows(d.requires, ctx));
}

export function searchDestinations(query: string, ctx: SearchContext, max?: number): SearchDestination[] {
  return rankBy(visibleDestinations(ctx), query, (d) => ({ title: d.title, keywords: [d.context, ...d.keywords] }), max);
}
