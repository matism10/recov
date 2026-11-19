"use client";

// Tooltip de los gráficos: muestra el dato exacto al pasar el mouse (escritorio) o al
// tocar (celular o lápiz; otro toque fuera lo cierra). Los gráficos siguen renderizándose en el
// servidor: este componente solo agrega una capa transparente encima. Es aria-hidden y
// no recibe foco: para lectores de pantalla cada gráfico ya trae su tabla (sr-only).
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export type TooltipContent = { title: string; lines?: string[] };

// Cierra al tocar o hacer clic fuera del área.
function useOutsideClose(active: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [active, close]);
  return ref;
}

// Globo: centrado sobre el punto; pegado al borde cuando está cerca de un extremo.
function Bubble({ tip, left }: { tip: TooltipContent; left: number }) {
  const shift = left < 20 ? "0%" : left > 80 ? "-100%" : "-50%";
  return (
    <div
      className="pointer-events-none absolute bottom-full z-30 mb-1.5 w-max max-w-60 rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow-lg"
      style={{ left: `${left}%`, transform: `translateX(${shift})` }}
    >
      <p className="font-semibold">{tip.title}</p>
      {tip.lines?.map((l) => (
        <p key={l} className="text-white/85">
          {l}
        </p>
      ))}
    </div>
  );
}

// Capa por columnas (una por barra o semana) sobre un gráfico vertical. Debe ir dentro de
// un contenedor `relative` del tamaño del trazado; la columna activa se sombrea.
// `centers` (en %, opcional): dónde cae cada dato, para gráficos de líneas cuyos puntos
// van de borde a borde; sin `centers`, columnas iguales (barras).
export function ChartColumnsTooltip({ tips, centers }: { tips: (TooltipContent | null)[]; centers?: number[] }) {
  const [active, setActive] = useState<number | null>(null);
  const ref = useOutsideClose(active !== null, () => setActive(null));
  const n = tips.length;
  const center = (i: number) => centers?.[i] ?? ((i + 0.5) / n) * 100;
  const edge = (i: number) => (i <= 0 ? 0 : i >= n ? 100 : (center(i - 1) + center(i)) / 2);
  const tip = active !== null ? tips[active] : null;
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="absolute inset-0"
      onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
    >
      {tips.map((t, i) => (
        <div
          key={i}
          className={`absolute inset-y-0 rounded-sm ${t ? "cursor-pointer" : ""} ${active === i && t ? "bg-ink/5" : ""}`}
          style={{ left: `${edge(i)}%`, width: `${edge(i + 1) - edge(i)}%` }}
          onPointerEnter={(e) => e.pointerType === "mouse" && setActive(t ? i : null)}
          onPointerUp={(e) => e.pointerType !== "mouse" && setActive((a) => (a === i || !t ? null : i))}
        />
      ))}
      {tip && active !== null && <Bubble tip={tip} left={center(active)} />}
    </div>
  );
}

// Un elemento con tooltip (una fila de barras horizontales, un tramo de una barra).
export function TooltipTarget({
  tip,
  children,
  className = "",
  style,
}: {
  tip: TooltipContent;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  return (
    <div
      ref={ref}
      className={`relative cursor-pointer ${className}`}
      style={style}
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}
      onPointerUp={(e) => e.pointerType !== "mouse" && setOpen((o) => !o)}
    >
      {children}
      {open && (
        <div aria-hidden="true">
          <Bubble tip={tip} left={50} />
        </div>
      )}
    </div>
  );
}
