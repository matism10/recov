"use client";

// "Zonas lesionadas" del Resumen del staff, en versión compacta: en el celular, chips por
// zona con su cantidad; en escritorio, barras horizontales. Ambos pintados con los colores
// del mapa (1, 2, 3 o más). "Ver mapa" abre el mapa del cuerpo con la lista completa.
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { BodyMapPair, HEAT_COLORS, type BodyMark } from "@/app/body-map";
import { BODY_ZONES, type BodyZone } from "@/lib/body-zones";
import { Card } from "@/app/ui-blocks";
import { SectionTitle, chipClass } from "@/app/ui";

// Zonas que se ven en la tarjeta; el resto queda en la lista del mapa.
const SHOWN = 5;

const heat = (count: number) => HEAT_COLORS[Math.min(count, HEAT_COLORS.length) - 1];

export function ZonesCard({
  marks,
  counts,
  withoutZone,
  className = "",
}: {
  marks: BodyMark[];
  // Zonas con su cantidad, de mayor a menor.
  counts: [BodyZone, number][];
  withoutZone: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const shown = counts.slice(0, SHOWN);
  const max = Math.max(...counts.map(([, n]) => n), 1);
  const note =
    withoutZone > 0
      ? `${withoutZone === 1 ? "1 lesión no tiene" : `${withoutZone} lesiones no tienen`} zona registrada.`
      : null;

  return (
    <section id="zonas" className={`scroll-mt-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionTitle>
          Zonas lesionadas
          {counts.length > 0 && <span className={`ml-2 align-middle ${chipClass}`}>{marks.length}</span>}
        </SectionTitle>
        {marks.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            className="-my-2 inline-flex min-h-11 items-center text-sm font-medium text-brand-text underline"
          >
            Ver mapa
          </button>
        )}
      </div>

      {marks.length === 0 ? (
        <Card className="text-center">
          <div className="mx-auto max-w-md py-4">
            <p className="text-15 font-semibold text-ink">No hay lesiones abiertas con zona registrada</p>
          </div>
        </Card>
      ) : (
        <Card>
          {/* Celular: chips */}
          <ul className="flex flex-wrap gap-2 lg:hidden">
            {shown.map(([zone, count]) => (
              <li
                key={zone}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-mist px-3 text-13 text-ink"
              >
                <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: heat(count) }} />
                {BODY_ZONES[zone].label}
                <span className="font-semibold tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
          {/* Escritorio: barras */}
          <ul className="hidden space-y-3 lg:block">
            {shown.map(([zone, count]) => (
              <li key={zone} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_1.5rem] items-center gap-3 text-sm">
                <span className="truncate text-ink">{BODY_ZONES[zone].label}</span>
                <span className="h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${(count / max) * 100}%`, background: heat(count) }}
                  />
                </span>
                <span className="text-right font-semibold tabular-nums text-ink">{count}</span>
              </li>
            ))}
          </ul>
          {(counts.length > SHOWN || note) && (
            <p className="mt-3 text-13 text-muted">
              {counts.length > SHOWN && `y ${counts.length - SHOWN} zonas más. `}
              {note}
            </p>
          )}
        </Card>
      )}

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-end bg-ink/30 lg:items-center lg:justify-center lg:p-6"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="zonas-mapa-title"
            className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-white p-5 shadow-lg lg:max-w-xl lg:rounded-2xl lg:p-6"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="zonas-mapa-title" className="font-sans text-lg font-bold text-ink">
                Zonas lesionadas
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="inline-flex size-11 items-center justify-center rounded-full text-muted transition hover:bg-mist"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <BodyMapPair heat={marks} legend className="mx-auto w-full max-w-80" />
            <ul className="mt-4 divide-y divide-line">
              {counts.map(([zone, count]) => (
                <li key={zone} className="flex items-center justify-between gap-4 py-2 text-sm">
                  <span className="text-ink">{BODY_ZONES[zone].label}</span>
                  <span className="font-semibold tabular-nums text-ink">{count}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              Lesiones abiertas (en evaluación o activas) del plantel. {note}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
