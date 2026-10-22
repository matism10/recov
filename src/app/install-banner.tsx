"use client";

// Guía para instalar Recov como app (Web App). Solo en celular (va dentro de la barra
// inferior, oculta desde lg), solo si la app NO está instalada (no en modo
// standalone) y solo para usuarios con sesión (la barra solo existe para ellos).
// - iPhone en Safari: indica cómo hacerlo (Compartir → "Agregar a inicio").
// - Android/Chrome: si el navegador ofrece instalar (beforeinstallprompt), botón
//   "Instalar"; si no lo ofrece, no se muestra.
// Al cerrarlo se recuerda en este navegador y no vuelve a aparecer.
import { useEffect, useState } from "react";
import { X } from "lucide-react";

const DISMISSED_KEY = "recov-install-dismissed";

// Evento de Chrome para ofrecer la instalación (no está en los tipos del DOM).
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Mode = { kind: "ios" } | { kind: "android"; event: InstallPromptEvent } | null;

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

// Safari en iPhone o iPad (no Chrome, Firefox ni Edge para iOS).
function isIosSafari() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

export function InstallBanner({ bottomClass }: { bottomClass: string }) {
  const [mode, setMode] = useState<Mode>(null);

  useEffect(() => {
    if (isStandalone() || wasDismissed()) return;
    // Se decide después de montar (no hay window en el servidor).
    const ios = isIosSafari();
    if (ios) queueMicrotask(() => setMode({ kind: "ios" }));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      if (!ios) setMode({ kind: "android", event: e as InstallPromptEvent });
    };
    const onInstalled = () => setMode(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!mode) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Sin almacenamiento (navegación privada): se oculta solo por ahora.
    }
    setMode(null);
  }

  async function install() {
    if (mode?.kind !== "android") return;
    await mode.event.prompt();
    const { outcome } = await mode.event.userChoice;
    // El evento sirve una sola vez: se oculta; si aceptó, ya quedó instalada.
    if (outcome === "accepted") dismiss();
    else setMode(null);
  }

  return (
    <div
      role="region"
      aria-label="Instalar Recov"
      className={`fixed inset-x-2 z-30 flex items-center gap-2 rounded-xl bg-brand py-1 pr-1 pl-4 text-sm text-ink shadow-lg lg:hidden ${bottomClass}`}
    >
      <p className="min-w-0 flex-1 py-2 font-medium">
        {mode.kind === "ios"
          ? "Instala Recov en tu celular: toca Compartir y luego 'Agregar a inicio'"
          : "Instala Recov en tu celular"}
      </p>
      {mode.kind === "android" && (
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
