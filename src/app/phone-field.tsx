"use client";

// Campo "Teléfono (opcional)" con su ayuda (ⓘ). Lo usan el registro y el perfil;
// quien lo usa valida con normalizePhone (src/lib/phone.ts) y pasa el error.
import { InfoPopover } from "@/app/info-popover";
import { ErrorMessage, inputClass, labelClass, optionalClass } from "@/app/ui";

const PHONE_HELP =
  "Facilita la comunicación directa entre el staff y tú ante dudas puntuales: cómo vas con tu lesión, si estás disponible para entrenar o jugar. Solo lo ve el staff de tu club. Es opcional.";

export function PhoneField({
  id,
  defaultValue,
  error,
  onChange,
  disabled,
}: {
  id: string; // base para los ids del campo, la ayuda y el error
  defaultValue?: string;
  error?: string | null;
  onChange?: () => void;
  disabled?: boolean;
}) {
  return (
    // relative: la ayuda se abre bajo el campo, a todo su ancho.
    <div className="relative">
      <div className="flex items-center gap-1">
        <label htmlFor={`${id}-input`} className={labelClass}>
          Teléfono <span className={optionalClass}>(opcional)</span>
        </label>
        <InfoPopover id={`${id}-help`} label="Para qué se usa el teléfono">
          {PHONE_HELP}
        </InfoPopover>
      </div>
      <input
        id={`${id}-input`}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="9 1234 5678"
        defaultValue={defaultValue}
        onChange={onChange}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
        className={inputClass}
      />
      {error && (
        <ErrorMessage className="mt-1">
          <span id={`${id}-error`}>{error}</span>
        </ErrorMessage>
      )}
    </div>
  );
}
