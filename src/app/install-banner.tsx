"use client";

// Guía para instalar Recov como app (Web App). Solo en celular (va dentro de la barra
// inferior, oculta desde lg), solo si la app NO está instalada (no en modo
// standalone) y solo para usuarios con sesión (la barra solo existe para ellos).
// - iPhone en Safari: indica cómo hacerlo (Compartir → "Agregar a inicio").
// - Android/Chrome: si el navegador ofrece instalar (beforeinstallprompt), botón
//   "Instalar"; si no lo ofrece, no se muestra.
// Al cerrarlo se recuerda en este navegador y no vuelve a aparecer.
import { useState } from "react";
import { X } from "lucide-react";
import { rememberDismissed, useInstallEnv, useInstallPrompt } from "@/app/install-support";

export function InstallBanner({ bottomClass }: { bottomClass: string }) {
  const env = useInstallEnv();
  const { promptEvent, install: prompt } = useInstallPrompt();
  const [hidden, setHidden] = useState(false);

  if (!env || env.standalone || env.dismissed || hidden) return null;
  const mode = env.iosSafari ? "ios" : !env.ios && promptEvent ? "android" : null;
  if (!mode) return null;

  function dismiss() {
    rememberDismissed();
    setHidden(true);
  }

  async function install() {
    // El aviso de Chrome sirve una vez: tras usarlo el banner se oculta solo;
    // si aceptó, además se recuerda.
    if ((await prompt()) === "accepted") dismiss();
  }

  return (
    <div
      role="region"
      aria-label="Instalar Recov"
      className={`fixed inset-x-2 z-30 flex items-center gap-2 rounded-xl bg-brand py-1 pr-1 pl-4 text-sm text-ink shadow-lg lg:hidden ${bottomClass}`}
    >
      <p className="min-w-0 flex-1 py-2 font-medium">
        {mode === "ios"
          ? "Instala Recov en tu celular: toca Compartir y luego 'Agregar a inicio'"
          : "Instala Recov en tu celular"}
      </p>
      {mode === "android" && (
        <button
          type="button"
          onClick={install}
          className="min-h-11 shrink-0 rounded-lg bg-ink px-4 font-semibold text-white"
        >
          Instalar
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar y no volver a mostrar"
        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-ink hover:bg-white/30"
      >
        <X aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}
