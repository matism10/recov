// Textos de "¿Cómo se lee?" (InfoBox) de /metricas, en un solo lugar. Cortos: uno a tres
// párrafos. En la interfaz nunca "riesgo de lesión": "Carga alta" y "Bajo lo habitual".
export const METRICS_HELP = {
  estado: [
    "Cómo está hoy el plantel. Disponibles: aptos para convocar. Lesionados: sin alta; \"en revisión\" son los marcados en terreno que aún no completan su diagnóstico. En reintegro: vuelven a entrenar de a poco.",
  ],
  altas: [
    "Lesiones abiertas con alta estimada en los próximos 30 días. Las vencidas (la fecha ya pasó y la lesión sigue abierta) van primero y resaltadas: conviene revisarlas o dar el alta.",
  ],
  recurrentes: [
    "Jugadores con 2 o más lesiones en los últimos 12 meses. Con 3 o más, la etiqueta va en rojo.",
  ],
  no_disponibles: [
    "Cada barra es una semana: cuántos jugadores estaban lesionados, en revisión o en reintegro. Los disponibles no se muestran.",
    "Una semana vacía sin barra es porque todavía no había historial.",
  ],
  lesiones_semana: [
    "Lesiones nuevas que entraron al sistema cada semana (lunes a domingo). La última barra, más clara, es la semana en curso.",
  ],
  lugar: [
    "Dónde ocurrieron las lesiones de los últimos 12 meses, con su porcentaje del total.",
  ],
  posicion: [
    "Lesiones de los últimos 12 meses por posición del jugador, y cuántos jugadores distintos se lesionaron.",
  ],
  carga_jugador: [
    "sRPE = esfuerzo que reporta el jugador (0 a 10) × minutos de la sesión. La carga de la semana suma cancha, gimnasio y partidos, de lunes a domingo.",
    "\"vs su promedio\" compara esta semana con el promedio de sus 4 semanas anteriores con datos. \"Carga alta\" = más de 1,3 veces ese promedio (con al menos 3 semanas previas).",
    "\"Bienestar bajo\": su último check (7 días) está 4 puntos o más bajo su promedio, o tiene algún ítem en el peor valor.",
  ],
  carga_semana: [
    "Cada barra es una semana (lunes a domingo): la carga sRPE promedio de los jugadores que respondieron, separada en cancha, gimnasio y partido.",
    "La línea punteada es el promedio de las 4 semanas anteriores. La semana en curso va punteada porque aún puede subir.",
  ],
  bienestar_plantel: [
    "Promedio del check de bienestar (total sobre 25; 25 = mejor) con el último check de cada jugador de los últimos 7 días. Las barras son el promedio de cada semana.",
    "Abajo, los 3 checks más bajos, con los ítems que están mal tal como los ve el jugador (en Fatiga, Dolor muscular y Estrés, 5 = peor).",
  ],
  minutos: [
    "Minutos de cada jugador en los últimos partidos con participación cargada. Cada mini barra es un partido, escalada a la duración del partido.",
    "Si el plantel carga por rango, los minutos se estiman con el punto medio de cada rango (≈). Un no convocado suma 0.",
  ],
  paron: [
    "Un jugador vuelve tras parón cuando pasó 10 días o más sin actividad (ausencia avisada, \"No fui\", ausente en la lista o lesión) y volvió en los últimos 14 días.",
    "Si vuelve el 60 % del plantel o más (o hubo parón del plantel), se muestra un solo aviso de equipo. Es solo informativo: no cambia \"Carga alta\".",
  ],
  mi_carga: [
    "Carga = esfuerzo × minutos de cada sesión (cancha, gimnasio y partido). Cada barra es una semana, de lunes a domingo.",
    "La línea punteada es tu promedio de las 4 semanas anteriores con datos. La semana en curso va punteada porque aún puede subir.",
    "\"Carga alta\" aparece cuando esta semana pasa 1,3 veces tu promedio; no es un diagnóstico, solo una señal para ir con calma.",
  ],
  asistencia: [
    "Asistencia a entrenamientos con lista en los últimos 30 días: los 5 con menor porcentaje. Verde desde 85 %, ámbar de 70 a 84 % y rojo bajo 70 %.",
  ],
} as const satisfies Record<string, readonly string[]>;

export type MetricsHelpKey = keyof typeof METRICS_HELP;
