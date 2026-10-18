"use client";

import { useActionState } from "react";
import { ErrorMessage, SuccessMessage, buttonSecondary, inputClass, labelClass, optionalClass } from "@/app/ui";
import { setClubCategory, type CategoryState } from "./actions";

// Categoría del club (Adulta, Sub-18…): se muestra junto al deporte en el encabezado.
export function CategoryForm({ category }: { category: string | null }) {
  const [state, formAction, pending] = useActionState<CategoryState, FormData>(
    setClubCategory,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="category" className={labelClass}>
          Categoría <span className={optionalClass}>(opcional)</span>
        </label>
        <input
          id="category"
          name="category"
          defaultValue={category ?? ""}
          maxLength={40}
          placeholder="Ej.: Adulta, Sub-18"
          className={`${inputClass} sm:max-w-xs`}
        />
      </div>
      <button type="submit" disabled={pending} className={buttonSecondary}>
        {pending ? "Guardando…" : "Guarda la categoría"}
      </button>
      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      {state.ok && !pending && <SuccessMessage>Categoría guardada.</SuccessMessage>}
    </form>
  );
}
