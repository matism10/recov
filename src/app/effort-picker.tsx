"use client";

import { RPE_SCALE } from "@/lib/srpe";

const INK = "#082F49";
const EMPTY = "#F1F5F9";

// Esfuerzo de 0 a 10 con "número grande": círculo de 210 px con el número y su
// etiqueta (el fondo cambia según el número), una frase corta, botones − y + y una
// barra de 11 segmentos tocables. Sin respuesta (value null) muestra "?" para que
// nadie deje un número por defecto. La usan /reportar, el esfuerzo del gimnasio y la
// sesión por su cuenta.
export function EffortPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: number | null;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const step = RPE_SCALE[value ?? 0];
  const pick = (n: number) => !disabled && onChange(Math.max(0, Math.min(10, n)));

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div
        aria-live="polite"
        aria-atomic="true"
        className="flex size-[210px] shrink-0 flex-col items-center justify-center gap-1 rounded-full transition-colors"
        style={{ backgroundColor: value === null ? EMPTY : step.color, color: INK }}
      >
        {value === null ? (
          <>
            <span className="font-display text-8xl leading-none font-extrabold text-[#94A3B8]" aria-hidden="true">
              ?
            </span>
            <span className="sr-only">Sin elegir</span>
          </>
        ) : (
          <>
            <span className="font-display text-8xl leading-none font-extrabold tabular-nums">
              {value}
              <span className="sr-only"> de 10:</span>
            </span>
            <span className="font-display text-xl font-bold">{step.label}</span>
          </>
        )}
      </div>
      <p className="min-h-5 text-center text-[15px] text-[#334155]">
        {value === null ? "Toca la barra o usa + y −" : step.hint}
      </p>

      <div className="flex items-center gap-4">
        <StepButton label="Bajar el esfuerzo" disabled={disabled || value === null || value === 0} onClick={() => pick((value ?? 0) - 1)}>
          −
        </StepButton>
        <span className="w-24 text-center text-[13px] text-muted">de 0 a 10</span>
        <StepButton
          label="Subir el esfuerzo"
          disabled={disabled || value === 10}
          onClick={() => pick(value === null ? 0 : value + 1)}
        >
          +
        </StepButton>
      </div>

      <div className="w-full space-y-1.5">
        <div className="grid grid-cols-11 gap-[3px]">
          {RPE_SCALE.map((s, i) => {
            const selected = value === i;
            return (
              <button
                key={i}
                type="button"
                aria-label={`Esfuerzo ${i}`}
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => pick(i)}
                className="h-11 rounded-lg p-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong disabled:cursor-default"
                style={{
                  backgroundColor: value !== null && i <= value ? s.color : EMPTY,
                  border: selected ? `3px solid ${INK}` : "none",
                }}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-muted" aria-hidden="true">
          <span>Reposo</span>
          <span>Moderado</span>
          <span>Máximo</span>
        </div>
      </div>
    </div>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-16 items-center justify-center rounded-full border-2 border-[#E2E8F0] bg-white text-[30px] leading-none text-[#082F49] transition hover:bg-mist disabled:opacity-40"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
