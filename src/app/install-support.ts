"use client";

// Lógica compartida para instalar Recov como app: qué dispositivo y navegador es,
// si ya está instalada y el aviso de instalación de Chrome (beforeinstallprompt).
// La usan el banner de la app (con sesión) y la guía de registro e inicio de sesión.
import { useEffect, useState, useSyncExternalStore } from "react";

// Evento de Chrome para ofrecer la instalación (no está en los tipos del DOM).
export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallEnv = {
  /** iPhone o iPad (cualquier navegador). */
  ios: boolean;
  /** Celular o tableta (iOS o Android). */
  mobile: boolean;
  /** Safari en iOS (no Chrome, Firefox ni Edge para iOS). */
  iosSafari: boolean;
  /** Navegador interno de otra app (WhatsApp, Instagram, Facebook…). */
  inApp: boolean;
  /** Ya abierta como app instalada. */
  standalone: boolean;
  /** El banner de la app se cerró antes en este navegador. */
  dismissed: boolean;
};

export const DISMISSED_KEY = "recov-install-dismissed";

// Navegadores internos que no dejan instalar. En Android, "; wv)" marca cualquier
// WebView embebido. WhatsApp en iPhone abre los links en una vista de Safari que
// no se distingue por user agent.
const IN_APP_UA =
  /WhatsApp|Instagram|FBAN|FBAV|FB_IAB|FBIOS|Messenger|musical_ly|TikTok|Bytedance|\bLine\/|Snapchat|Twitter|LinkedInApp|Pinterest|; wv\)/i;

function readEnv(): InstallEnv {
  const ua = navigator.userAgent;
  const ios =
    /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const inApp = IN_APP_UA.test(ua);
  let dismissed = false;
  try {
    dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    // Sin almacenamiento (navegación privada): se trata como no cerrado.
  }
  return {
    ios,
    mobile: ios || /Android/.test(ua),
    iosSafari: ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) && !inApp,
    inApp,
    standalone:
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    dismissed,
  };
}

// El entorno no cambia durante la visita: se lee una vez. En el servidor (y al
// hidratar) es null, así que estos componentes aparecen recién en el navegador.
let cachedEnv: InstallEnv | null = null;
const noSubscribe = () => () => {};

export function useInstallEnv(): InstallEnv | null {
  return useSyncExternalStore(
    noSubscribe,
    () => (cachedEnv ??= readEnv()),
    () => null,
  );
}

export function rememberDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Sin almacenamiento: se oculta solo por ahora.
  }
}

// Aviso de instalación de Chrome. `promptEvent` es null hasta que Chrome lo
// ofrece; sirve una sola vez, así que tras usarlo vuelve a null.
export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => setPromptEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) return null;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    setPromptEvent(null);
    return outcome;
  }

  return { promptEvent, install };
}
