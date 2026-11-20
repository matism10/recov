// Índice del buscador universal ("Ir a…"): destinos estáticos por rol. Solo decide qué
// se ofrece; cada pantalla y la base siguen validando el acceso. Los permisos son las
// claves reales del catálogo (private.permissions, replicado en permissions.ts) y los
// `#ancla` apuntan a ids que existen en la pantalla (src/lib/search-index.test.ts).
// Importa con rutas relativas (sin alias @/) para poder correr con node --test.
import { rankBy } from "./search-match.ts";
import type { Permission } from "./permissions.ts";

// Reglas de quién ve cada destino. Se leen de las guardas reales de cada página y de su
// query (no de la plantilla del rol): "staff" = isStaff, "jugador" = rol jugador,
// "evaluaciones" = canReadEvaluations, "rugby" / "sevens" = lo que tenga el club,
// { perm } = basta uno de los permisos efectivos (my_permissions, con delegaciones y
// ajustes), { role } = solo ese rol (lo que la base reserva al head coach, sin permiso
// propio), { all } / { any } = combinaciones.
export type SearchRule =
  | "todos"
  | "staff"
  | "jugador"
  | "evaluaciones"
  | "rugby"
  | "sevens"
  | { perm: Permission | readonly Permission[] }
  | { role: string }
  | { all: readonly SearchRule[] }
  | { any: readonly SearchRule[] };

export type SearchDestination = {
  id: string;
  // Título tal como se ve en la pantalla.
  title: string;
  // Ruta de contexto: "Métricas › Carga".
  context: string;
  // Sinónimos en español de Chile (sin importar tildes ni mayúsculas).
  keywords: readonly string[];
  // Ruta con ?query y #ancla opcionales.
  href: string;
  requires: SearchRule;
  // Solo se dibuja en el celular (por ejemplo, la barra inferior en Perfil).
  only?: "mobile";
};

const perm = (p: Permission | readonly Permission[]): SearchRule => ({ perm: p });
const staffWith = (p: Permission): SearchRule => ({ all: ["staff", perm(p)] });

export const SEARCH_INDEX: readonly SearchDestination[] = [
  // --- Resumen ---
  { id: "resumen", title: "Resumen", context: "Inicio", keywords: ["inicio", "panel", "home", "principal", "tablero"], href: "/dashboard", requires: "todos" },
  { id: "notificaciones", title: "Notificaciones", context: "Campana del encabezado", keywords: ["avisos", "alertas", "campana", "novedades", "pendientes", "por responder", "avisos del club"], href: "/dashboard#notificaciones", requires: "todos" },
  { id: "por-revisar", title: "Por revisar", context: "Resumen › lesiones por revisar", keywords: ["pendientes", "bandeja", "diagnostico", "revisar lesion", "confirmar lesion", "descartar"], href: "/dashboard#por-revisar", requires: perm("lesiones_revisar") },
  { id: "lesiones-activas", title: "Lesiones activas", context: "Resumen › lesionados y en reintegro", keywords: ["lesionados", "reintegro", "no disponibles", "bajas", "quienes estan lesionados"], href: "/dashboard#lesiones-activas", requires: "staff" },
  { id: "zonas", title: "Zonas lesionadas", context: "Resumen › mapa del cuerpo", keywords: ["lugar", "zona", "donde", "mapa", "cuerpo", "dolor", "muneco"], href: "/dashboard#zonas", requires: "staff" },
  { id: "mi-semana", title: "Mi semana", context: "Resumen › agenda de la semana", keywords: ["agenda", "semana", "que toca", "proximos dias", "entrenamientos", "partidos"], href: "/dashboard#mi-semana", requires: "todos" },
  { id: "mis-lesiones", title: "Mis lesiones", context: "Resumen › mis lesiones", keywords: ["mi lesion", "recuperacion", "fases", "alta", "lesion actual"], href: "/dashboard#mis-lesiones", requires: "jugador" },

  // --- Calendario ---
  { id: "calendario", title: "Calendario", context: "Eventos del plantel", keywords: ["eventos", "partidos", "entrenamientos", "agenda", "fixture", "competencias", "mes", "semana"], href: "/calendario", requires: "todos" },
  { id: "evento-nuevo", title: "Nuevo evento", context: "Calendario › crear evento", keywords: ["crear evento", "agendar", "programar", "entrenamiento", "partido", "competencia", "repetir"], href: "/calendario/nuevo", requires: perm("eventos_editar") },
  { id: "avisos-staff", title: "Ausencias", context: "Calendario › avisos de ausencia", keywords: ["avisos", "faltas", "paron", "no van", "ausentes", "declarar ausencia"], href: "/calendario/ausencias", requires: perm("lista_pasar") },

  // --- Plantel y lesiones ---
  { id: "plantel", title: "Plantel", context: "Jugadores del club", keywords: ["jugadores", "equipo", "posiciones", "cancha", "disponibilidad", "lista de jugadores"], href: "/plantel", requires: "todos" },
  { id: "lesiones", title: "Lesiones", context: "Actuales e historial", keywords: ["lesionados", "lesion", "fases", "recuperacion", "alta", "diagnostico", "documentos"], href: "/lesiones", requires: { any: [perm("lesiones_ver"), "jugador"] } },
  { id: "lesiones-actuales", title: "Actuales", context: "Lesiones › lesiones actuales", keywords: ["abiertas", "en curso", "lesionados ahora", "en recuperacion"], href: "/lesiones?tab=actuales", requires: { any: [perm("lesiones_ver"), "jugador"] } },
  { id: "lesiones-historial", title: "Historial", context: "Lesiones › cerradas y descartadas", keywords: ["pasadas", "antiguas", "cerradas", "descartadas", "dadas de alta"], href: "/lesiones?tab=historial", requires: { any: [perm("lesiones_ver"), "jugador"] } },
  { id: "registrar-lesion", title: "Registrar lesión", context: "Reportar una lesión", keywords: ["lesionarme", "me lesione", "reportar", "dolor", "golpe", "nueva lesion", "me duele"], href: "/registrar-lesion", requires: "jugador" },

  // --- Métricas ---
  { id: "metricas", title: "Métricas del plantel", context: "Métricas", keywords: ["estadisticas", "datos", "graficos", "indicadores", "numeros"], href: "/metricas", requires: { all: ["staff", { any: [perm("lesiones_ver"), perm("carga_ver")] }] } },
  { id: "metricas-lesiones", title: "Lesiones", context: "Métricas › Lesiones", keywords: ["estadisticas de lesiones", "pestana lesiones", "indicadores de lesiones"], href: "/metricas?tab=lesiones", requires: staffWith("lesiones_ver") },
  { id: "lesiones-semana", title: "Lesiones nuevas por semana", context: "Métricas › Lesiones", keywords: ["cuantas lesiones", "por semana", "evolucion", "tendencia"], href: "/metricas?tab=lesiones#lesiones-nuevas-por-semana", requires: staffWith("lesiones_ver") },
  { id: "lesiones-lugar", title: "Lugar de la lesión", context: "Métricas › Lesiones", keywords: ["zona", "donde", "partes del cuerpo", "rodilla", "tobillo", "hombro"], href: "/metricas?tab=lesiones#lugar-de-la-lesion", requires: staffWith("lesiones_ver") },
  { id: "lesiones-posicion", title: "Lesiones por posición", context: "Métricas › Lesiones", keywords: ["posicion", "puesto", "pilar", "apertura", "wing", "delantero", "forwards", "back"], href: "/metricas?tab=lesiones#lesiones-por-posicion", requires: staffWith("lesiones_ver") },
  { id: "recurrentes", title: "Jugadores recurrentes", context: "Métricas › Lesiones", keywords: ["reincidentes", "se lesionan seguido", "varias lesiones", "repetidas"], href: "/metricas?tab=lesiones#jugadores-recurrentes", requires: staffWith("lesiones_ver") },
  { id: "proximas-altas", title: "Próximas altas estimadas", context: "Métricas › Lesiones", keywords: ["alta", "vuelven", "regreso", "cuando vuelve", "fecha de alta", "retorno"], href: "/metricas?tab=lesiones#proximas-altas-estimadas", requires: staffWith("lesiones_ver") },
  { id: "no-disponibles", title: "Jugadores no disponibles por semana", context: "Métricas › Lesiones", keywords: ["bajas", "indisponibles", "lesionados por semana", "no disponibles"], href: "/metricas?tab=lesiones#jugadores-no-disponibles-por-semana", requires: staffWith("lesiones_ver") },
  { id: "metricas-carga", title: "Carga", context: "Métricas › Carga", keywords: ["carga", "esfuerzo", "minutos", "semana", "pestana carga"], href: "/metricas?tab=carga", requires: staffWith("carga_ver") },
  { id: "carga-semana", title: "Carga del plantel por semana", context: "Métricas › Carga", keywords: ["srpe", "rpe", "esfuerzo", "carga semanal", "sesiones", "cancha", "gimnasio", "promedio"], href: "/metricas?tab=carga#carga-del-plantel-por-semana", requires: staffWith("carga_ver") },
  { id: "bienestar-plantel", title: "Bienestar del plantel", context: "Métricas › Carga", keywords: ["bienestar", "check", "sueno", "fatiga", "animo", "estres", "como estan"], href: "/metricas?tab=carga#bienestar-del-plantel", requires: staffWith("carga_ver") },
  { id: "carga-jugador", title: "Carga por jugador", context: "Métricas › Carga", keywords: ["carga alta", "srpe", "individual", "semana", "gimnasio", "paron", "vuelven tras paron", "vuelta", "retorno", "bienestar bajo"], href: "/metricas?tab=carga#carga-por-jugador", requires: staffWith("carga_ver") },
  { id: "minutos-bloque", title: "Minutos jugados", context: "Métricas › Carga", keywords: ["minutos", "partidos", "participacion", "juegan", "ranking"], href: "/metricas?tab=carga#minutos-jugados", requires: staffWith("carga_ver") },
  { id: "minutos", title: "Minutos jugados", context: "Métricas › Carga › ranking completo", keywords: ["minutos", "partidos", "participacion", "juegan", "ranking", "todos los jugadores"], href: "/metricas/carga", requires: "staff" },
  { id: "asistencia-bloque", title: "Asistencia a entrenamientos", context: "Métricas › Carga", keywords: ["asistencia", "faltas", "quienes faltan", "presentes", "entrenamientos"], href: "/metricas?tab=carga#asistencia-a-entrenamientos", requires: staffWith("carga_ver") },
  { id: "asistencia", title: "Asistencia a entrenamientos", context: "Ranking de asistencia", keywords: ["asistencia", "faltas", "ranking", "presentes", "pasar lista", "lista", "temporada"], href: "/asistencia", requires: "todos" },

  // --- Nóminas ---
  { id: "nominas", title: "Nóminas", context: "Convocatorias por partido", keywords: ["convocatoria", "partido", "titulares", "banca", "alineacion", "convocados"], href: "/nominas", requires: "todos" },
  { id: "armar-nomina", title: "Armar nómina", context: "Nóminas › próximo partido", keywords: ["convocar", "alineacion", "titulares", "banca", "partido", "armar equipo"], href: "/nominas#armar-nomina", requires: perm("nomina_armar") },

  // --- Evaluaciones ---
  { id: "evaluaciones", title: "Evaluaciones", context: "Tests físicos del plantel", keywords: ["tests", "fuerza", "resultados", "fisicas", "pruebas", "mediciones"], href: "/evaluaciones", requires: "evaluaciones" },
  { id: "evaluaciones-cargar", title: "Cargar resultados", context: "Evaluaciones › cargar resultados", keywords: ["ingresar tests", "anotar", "pruebas fisicas", "maximos", "registrar test"], href: "/evaluaciones?tab=cargar", requires: perm(["evaluaciones_cargar", "tests_catalogo"]) },
  { id: "evaluaciones-comparar", title: "Comparar plantel", context: "Evaluaciones › comparar plantel", keywords: ["ranking", "comparar", "evolucion", "tests", "quien levanta mas"], href: "/evaluaciones?tab=comparar", requires: "evaluaciones" },
  { id: "mis-evaluaciones", title: "Mis evaluaciones", context: "Mis tests físicos", keywords: ["tests", "fuerza", "resultados", "fisicas", "pruebas", "mi progreso"], href: "/evaluaciones/mias", requires: "jugador" },

  // --- Gimnasio ---
  { id: "planes", title: "Planes de gimnasio", context: "Fuerza y acondicionamiento", keywords: ["gimnasio", "gym", "rutina", "ejercicios", "pesas", "fuerza", "planificacion"], href: "/planes", requires: perm("gimnasio_planes") },
  { id: "plan-nuevo", title: "Nuevo plan", context: "Planes de gimnasio › nuevo plan", keywords: ["crear plan", "gimnasio", "rutina", "ejercicios", "pesas"], href: "/planes/nuevo", requires: perm("gimnasio_planes") },
  { id: "mi-plan", title: "Mi plan de hoy", context: "Gimnasio", keywords: ["gimnasio", "gym", "rutina", "ejercicios", "sesion", "hoy toca", "pesas", "mi plan"], href: "/mi-plan", requires: "jugador" },
  { id: "plan-propia", title: "Gimnasio por tu cuenta", context: "Mi plan › registrar sesión propia", keywords: ["gimnasio", "gym", "entrene por mi cuenta", "registrar sesion", "libre"], href: "/mi-plan/propia", requires: "jugador" },

  // --- Jugador: bienestar y ausencias ---
  { id: "bienestar", title: "Mi bienestar", context: "Check de bienestar · ¿Cómo estás hoy?", keywords: ["check", "sueno", "fatiga", "animo", "encuesta", "como estoy", "como estas hoy", "estres"], href: "/bienestar", requires: "jugador" },
  { id: "ausencias", title: "Mis ausencias", context: "Avisos de ausencia", keywords: ["avisar", "falta", "no puedo ir", "viaje", "avisos", "ausentarme"], href: "/ausencias", requires: "jugador" },
  { id: "ausencia-nueva", title: "Avisar una ausencia", context: "Mis ausencias › nuevo aviso", keywords: ["falta", "no puedo ir", "viaje", "aviso", "ausentarme", "no voy"], href: "/ausencias/nueva", requires: "jugador" },

  // --- Dirección ---
  { id: "staff", title: "Staff del plantel", context: "Staff › roles y permisos", keywords: ["equipo tecnico", "roles", "permisos", "delegar", "kinesiologo", "entrenador", "personas", "cuerpo tecnico"], href: "/staff", requires: perm("staff_gestionar") },
  { id: "funciones-kinesiologo", title: "Funciones de kinesiólogo", context: "Staff › delegar al kinesiólogo", keywords: ["delegar", "kine", "kinesiologo", "reemplazo", "revisar lesiones"], href: "/staff#funciones-kinesiologo", requires: perm("staff_gestionar") },
  { id: "delegado-nominas", title: "Nóminas", context: "Staff › quién arma las nóminas", keywords: ["delegar", "convocatoria", "arma la nomina", "responsable de nominas"], href: "/staff#delegado-nominas", requires: perm("staff_gestionar") },
  { id: "registros", title: "Registros pendientes", context: "Solicitudes de ingreso", keywords: ["pendientes", "aprobar", "confirmar", "rechazar", "altas", "nuevos", "solicitudes", "registros"], href: "/registros", requires: perm("registros_aprobar") },

  // --- Configuración ---
  { id: "configuracion", title: "Configuración", context: "Ajustes del club", keywords: ["ajustes", "club", "opciones", "preferencias"], href: "/configuracion", requires: { any: [perm("staff_gestionar"), perm("check_dias")] } },
  { id: "config-bienestar", title: "Check de bienestar", context: "Configuración › días del check", keywords: ["bienestar", "dias", "check", "encuesta", "que dias responden"], href: "/configuracion#bienestar", requires: { any: [perm("staff_gestionar"), perm("check_dias")] } },
  { id: "config-logo", title: "Logo del plantel", context: "Configuración › logo", keywords: ["escudo", "imagen", "club", "insignia"], href: "/configuracion#logo", requires: perm("staff_gestionar") },
  { id: "config-portada", title: "Portada", context: "Configuración › portada", keywords: ["foto", "imagen", "encabezado", "banner", "club"], href: "/configuracion#portada", requires: perm("staff_gestionar") },
  { id: "config-partidos", title: "Registro de partidos", context: "Configuración › registro de partidos", keywords: ["participacion", "minutos", "modo", "nomina", "rango", "exacto", "jugo"], href: "/configuracion#partidos", requires: perm("staff_gestionar") },
  { id: "config-sevens", title: "Rugby Sevens", context: "Configuración › Rugby Sevens", keywords: ["sevens", "7", "formato", "rugby 7", "activar sevens"], href: "/configuracion#sevens", requires: { all: [perm("staff_gestionar"), "rugby"] } },
  { id: "grupo-sevens", title: "Grupo Sevens", context: "Configuración › Rugby Sevens › grupo", keywords: ["sevens", "grupo", "quienes juegan sevens", "elegir jugadores"], href: "/configuracion/sevens", requires: { all: [perm("staff_gestionar"), "sevens"] } },
  { id: "config-resumen", title: "Métricas del Resumen", context: "Configuración › métricas del Resumen", keywords: ["resumen", "indicadores", "tarjetas", "inicio", "numeros del inicio"], href: "/configuracion#metricas-resumen", requires: { all: [perm("staff_gestionar"), { role: "head_coach" }] } },

  // --- Perfil y cuenta ---
  { id: "perfil", title: "Tu perfil", context: "Mi cuenta", keywords: ["perfil", "mi cuenta", "datos", "mis datos"], href: "/perfil", requires: "todos" },
  { id: "perfil-foto", title: "Foto", context: "Perfil › foto", keywords: ["avatar", "imagen", "cambiar foto", "foto de perfil"], href: "/perfil#foto", requires: "todos" },
  { id: "perfil-datos", title: "Tus datos", context: "Perfil › nombre y posición", keywords: ["nombre", "apellido", "posicion", "cambiar nombre", "editar perfil"], href: "/perfil#datos", requires: "todos" },
  { id: "perfil-contacto", title: "Contacto", context: "Perfil › teléfono", keywords: ["telefono", "celular", "numero", "whatsapp", "fono"], href: "/perfil#contacto", requires: "jugador" },
  { id: "perfil-cuenta", title: "Cuenta", context: "Perfil › correo y contraseña", keywords: ["contrasena", "clave", "password", "correo", "email", "cambiar contrasena"], href: "/perfil#cuenta", requires: "todos" },
  { id: "perfil-barra", title: "Barra principal", context: "Perfil › barra inferior del celular", keywords: ["barra inferior", "pestanas", "menu", "accesos", "personalizar", "slots"], href: "/perfil#barra-principal", requires: "todos", only: "mobile" },
  { id: "cerrar-sesion", title: "Cerrar sesión", context: "Perfil › cerrar sesión", keywords: ["salir", "logout", "desconectar", "cerrar cuenta"], href: "/perfil#cerrar-sesion", requires: "todos" },
  { id: "privacidad", title: "Política de privacidad", context: "Legal", keywords: ["datos personales", "privacidad", "legal", "proteccion de datos"], href: "/privacidad", requires: "todos" },
  { id: "terminos", title: "Términos de uso", context: "Legal", keywords: ["terminos", "condiciones", "legal", "reglas de uso"], href: "/terminos", requires: "todos" },
];

export type SearchContext = {
  roles: readonly string[];
  // Permisos efectivos de la persona (my_permissions), no la plantilla del rol.
  permissions: readonly string[];
  // Ya calculados con isStaff(roles) y canReadEvaluations(roles) (roles.ts, evaluations.ts).
  staff: boolean;
  evaluations: boolean;
  // Deporte del club y si tiene Sevens activo.
  sport: string;
  hasSevens: boolean;
  // Pantalla de celular (< lg): los destinos `only: "mobile"` no se ofrecen en escritorio.
  mobile: boolean;
};

export function allows(rule: SearchRule, ctx: SearchContext): boolean {
  if (rule === "todos") return true;
  if (rule === "staff") return ctx.staff;
  if (rule === "jugador") return ctx.roles.includes("jugador");
  if (rule === "evaluaciones") return ctx.evaluations;
  if (rule === "rugby") return ctx.sport === "rugby";
  if (rule === "sevens") return ctx.sport === "rugby" && ctx.hasSevens;
  if ("all" in rule) return rule.all.every((r) => allows(r, ctx));
  if ("any" in rule) return rule.any.some((r) => allows(r, ctx));
  if ("role" in rule) return ctx.roles.includes(rule.role);
  const wanted = Array.isArray(rule.perm) ? rule.perm : [rule.perm as Permission];
  return wanted.some((p) => ctx.permissions.includes(p));
}

export function visibleDestinations(ctx: SearchContext): SearchDestination[] {
  return SEARCH_INDEX.filter((d) => allows(d.requires, ctx) && (d.only !== "mobile" || ctx.mobile));
}

export function searchDestinations(query: string, ctx: SearchContext, max?: number): SearchDestination[] {
  return rankBy(visibleDestinations(ctx), query, (d) => ({ title: d.title, keywords: [d.context, ...d.keywords] }), max);
}
