// Pestañas de la ficha del jugador: links a ?tab= (se renderizan en el servidor y solo se
// consulta lo de la activa). Barra con scroll horizontal en el celular y subrayado celeste
// en la activa. "Resumen" es la de por defecto y no lleva ?tab=.
import Link from "next/link";

export type PlayerTab = "resumen" | "lesiones" | "carga" | "gimnasio" | "evaluaciones";

export function playerTabHref(playerId: string, tab: PlayerTab) {
  return tab === "resumen" ? `/jugadores/${playerId}` : `/jugadores/${playerId}?tab=${tab}`;
}

export function PlayerTabs({
  playerId,
  tabs,
  active,
}: {
  playerId: string;
  tabs: { id: PlayerTab; label: string }[];
  active: PlayerTab;
}) {
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Secciones de la ficha" className="-mx-4 mb-5 border-b border-line lg:mx-0">
      <ul className="flex overflow-x-auto px-4 [scrollbar-width:none] lg:px-0 [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => {
          const current = t.id === active;
          return (
            <li key={t.id} className="shrink-0">
              <Link
                href={playerTabHref(playerId, t.id)}
                scroll={false}
                aria-current={current ? "page" : undefined}
                className={`-mb-px flex min-h-11 items-center border-b-2 px-4 text-sm font-semibold whitespace-nowrap transition ${
                  current
                    ? "border-brand-strong text-ink"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
