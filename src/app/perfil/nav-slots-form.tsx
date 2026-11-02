"use client";

import { startTransition, useActionState, useId, useState, type FormEvent } from "react";
import { CirclePlus, Ellipsis } from "lucide-react";
import { NAV_SCREEN_ITEM } from "@/app/nav-items";
import { NAV_SCREEN_LABEL, type NavScreen } from "@/lib/nav-slots";
import { ErrorMessage, SuccessMessage, buttonPrimary, buttonSecondary, inputClass, labelClass } from "@/app/ui";
import { saveNavSlots, type NavSlotsState } from "./actions";

// "Barra principal" de Perfil: elige qué pantallas van en la barra inferior del
// celular. Solo se ofrecen las que el rol puede ver (la base lo vuelve a validar).
// "Restablecer" vuelve al valor por defecto del rol.
export function NavSlotsForm({
  current,
  defaults,
  allowed,
  player,
}: {
  current: NavScreen[];
  defaults: NavScreen[];
  allowed: NavScreen[];
  player: boolean;
}) {
  const [state, formAction, pending] = useActionState<NavSlotsState, FormData>(saveNavSlots, {});
  const [slots, setSlots] = useState<NavScreen[]>(current);
  const id = useId();

  const repeated = new Set(slots).size !== slots.length;
  const unchanged = slots.every((s, i) => s === current[i]);

  // La acción se envía a mano (sin action en el <form>): así React no reinicia los
  // selectores al terminar y muestran lo guardado o el valor por defecto.
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const reset = submitter?.value === "reset";
    const next = reset ? defaults : slots;
    if (reset) setSlots(defaults);
    const formData = new FormData();
    formData.set("intent", reset ? "reset" : "save");
    next.forEach((s) => formData.append("slot", s));
    startTransition(() => formAction(formData));
  }

  function change(index: number, value: NavScreen) {
    setSlots((prev) => prev.map((s, i) => (i === index ? value : s)));
  }

  // Vista previa: el orden real de la barra (con el botón del jugador al centro).
  const preview: (NavScreen | "registrar" | "mas")[] = player
    ? [slots[0], slots[1], "registrar", slots[2], "mas"]
    : [...slots, "mas"];

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted">
        Elige las pantallas de la barra inferior del celular.{" "}
        {player
          ? "El botón \u201cRegistrar lesión\u201d del centro y \u201cMás\u201d quedan fijos."
          : "\u201cMás\u201d queda fijo a la derecha."}{" "}
        Las demás pantallas están en &ldquo;Más&rdquo;.
      </p>

      <div
        aria-hidden="true"
        className="flex items-end gap-1 rounded-2xl border border-[#CDE8F8] bg-[#E3F1FB] p-1.5 text-[11px] leading-none text-[#0F1B33]"
      >
        {preview.map((s, i) => {
          if (s === "registrar")
            return (
              <span key="registrar" className="flex min-w-0 flex-1 flex-col items-center gap-1 py-1.5">
                <span className="flex size-8 items-center justify-center rounded-full bg-[#63BCF2]">
                  <CirclePlus className="size-5" />
                </span>
              </span>
            );
          const Icon = s === "mas" ? Ellipsis : NAV_SCREEN_ITEM[s].Icon;
          return (
            <span key={`${s}-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-1 py-1.5">
              <Icon className="size-5" strokeWidth={1.75} />
              <span className="max-w-full truncate">{s === "mas" ? "Más" : NAV_SCREEN_LABEL[s]}</span>
            </span>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {slots.map((value, index) => (
          <div key={index} className="min-w-0">
            <label htmlFor={`${id}-${index}`} className={labelClass}>
              Pestaña {index + 1}
            </label>
            <select
              id={`${id}-${index}`}
              name="slot"
              value={value}
              onChange={(e) => change(index, e.target.value as NavScreen)}
              className={inputClass}
            >
              {allowed.map((screen) => (
                <option key={screen} value={screen} disabled={screen !== value && slots.includes(screen)}>
                  {NAV_SCREEN_LABEL[screen]}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {repeated && <ErrorMessage>Elige pantallas distintas para cada pestaña.</ErrorMessage>}
      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      {state.ok === "saved" && unchanged && <SuccessMessage>Barra guardada.</SuccessMessage>}
      {state.ok === "reset" && <SuccessMessage>Barra restablecida a la de tu rol.</SuccessMessage>}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="intent"
          value="save"
          disabled={pending || repeated}
          className={buttonPrimary}
        >
          Guardar
        </button>
        <button
          type="submit"
          name="intent"
          value="reset"
          disabled={pending}
          className={buttonSecondary}
        >
          Restablecer
        </button>
      </div>
    </form>
  );
}
