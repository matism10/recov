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
} as const satisfies Record<string, readonly string[]>;

export type MetricsHelpKey = keyof typeof METRICS_HELP;
