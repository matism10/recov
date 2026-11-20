// Pestañas de /metricas (Lesiones | Carga) como barra segmentada de links: la pestaña
// vive en ?tab= y se renderiza en el servidor, así solo se consulta lo de la activa.
// En el celular queda fija arriba al hacer scroll.
import Link from "next/link";

export type MetricsTab = "lesiones" | "carga";

const LABEL: Record<MetricsTab, string> = { lesiones: "Lesiones", carga: "Carga" };

export function MetricsTabs({ tabs, active }: { tabs: MetricsTab[]; active: MetricsTab }) {
  if (tabs.length < 2) return null;
  return (
    <nav
      aria-label="Secciones de métricas"
      className="sticky top-0 z-20 -mx-4 mb-6 bg-white/95 px-4 py-2 backdrop-blur lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:py-0"
    >
      <ul className="grid grid-cols-2 gap-1 rounded-xl bg-mist p-1 sm:inline-grid sm:min-w-80">
        {tabs.map((t) => (
          <li key={t}>
            <Link
              href={`/metricas?tab=${t}`}
              scroll={false}
              aria-current={t === active ? "page" : undefined}
              className={`flex h-11 items-center justify-center rounded-lg text-sm font-semibold transition ${
                t === active ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {LABEL[t]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
