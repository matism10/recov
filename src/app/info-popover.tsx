"use client";

// Icono de ayuda (ⓘ) con un texto que se abre al tocarlo. Se cierra al tocar
// fuera o con Escape. Con mouse también se abre al pasar por encima, y con
// teclado al enfocarlo. El texto queda siempre en el DOM (oculto si está
// cerrado) para que `aria-describedby` funcione en el botón y en el campo.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

export function InfoPopover({
  id,
  label,
  children,
}: {
  id: string; // id del texto, para usarlo también en aria-describedby del campo
  label: string;
  children: ReactNode;
}) {
  const [pinned, setPinned] = useState(false); // abierto por click o tap
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false); // foco visible (teclado)
  const open = pinned || hovered || focused;
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function close() {
      setPinned(false);
      setHovered(false);
      setFocused(false);
    }
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        aria-describedby={id}
        onClick={() => {
          if (pinned) {
            setPinned(false);
            setHovered(false);
            setFocused(false);
          } else {
            setPinned(true);
          }
        }}
        onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(false)}
        onFocus={(e) => e.currentTarget.matches(":focus-visible") && setFocused(true)}
        onBlur={() => setFocused(false)}
        className="-my-2 inline-flex size-11 items-center justify-center rounded-full text-muted outline-none hover:text-brand-text focus-visible:ring-2 focus-visible:ring-brand-strong"
      >
        <Info aria-hidden="true" className="size-4" />
      </button>
      <span
        id={id}
        role="tooltip"
        hidden={!open}
        className="absolute inset-x-0 top-full z-20 mt-1 rounded-xl border border-line bg-white p-3 text-sm font-normal leading-relaxed text-ink shadow-lg"
      >
        {children}
      </span>
    </span>
  );
}
