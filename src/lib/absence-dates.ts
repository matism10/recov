// Fechas cortas de los avisos de ausencia ("22 dic"), sin puntos: Safari abrevia "dic." y
// el servidor "dic", y el texto debe ser igual en ambos para no romper la hidratación.
const dayMonth = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "UTC" });

// "2026-12-22" → "22 dic".
export function monthLabelShort(date: string) {
  return dayMonth.format(new Date(`${date}T00:00:00Z`)).replace(/\./g, "");
}
