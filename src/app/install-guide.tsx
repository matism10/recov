"use client";

// "¿Cómo instalo Recov?": guía plegable bajo el formulario de registro e inicio de
// sesión (sin sesión). Solo en celular y solo si Recov no está ya instalada.
// - Tabs iPhone / Android, con la del dispositivo preseleccionada.
// - Android: si Chrome ofrece instalar, botón "Instalar"; si no, los pasos del menú.
// - En el navegador interno de otra app (WhatsApp, Instagram…) se abre sola con un
//   aviso: desde ahí no se puede instalar, hay que abrir el link en Safari o Chrome.
import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  Download,
  EllipsisVertical,
  Share,
  Smartphone,
  SquarePlus,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useInstallEnv, useInstallPrompt } from "@/app/install-support";
import { buttonPrimary } from "@/app/ui";

type Tab = "iphone" | "android";

const TABS: { id: Tab; label: string }[] = [
  { id: "iphone", label: "iPhone" },
  { id: "android", label: "Android" },
];

const IPHONE_STEPS: Step[] = [
  { Icon: Share, text: "Toca Compartir" },
  { Icon: SquarePlus, text: "Elige “Agregar a inicio”" },
  { Icon: Check, text: "Toca “Agregar”" },
];

const ANDROID_STEPS: Step[] = [
  { Icon: EllipsisVertical, text: "Toca el menú ⋮" },
  { Icon: Download, text: "Elige “Instalar app”" },
  { Icon: Check, text: "Confirma" },
];

type Step = { Icon: LucideIcon; text: ReactNode };

export function InstallGuide() {
  const env = useInstallEnv();
  const { promptEvent, install } = useInstallPrompt();
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const [userTab, setUserTab] = useState<Tab | null>(null);
  const id = useId();

  if (!env || !env.mobile || env.standalone) return null;

  // En un navegador interno parte abierta (para que se vea el aviso); si no, plegada.
  const open = userOpen ?? env.inApp;
  const tab = userTab ?? (env.ios ? "iphone" : "android");
  const panelId = `${id}-panel`;

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = tab === "iphone" ? "android" : "iphone";
    setUserTab(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  }

  return (
    // Ancla de alto 0: la guía cuelga bajo el formulario sin empujarlo ni moverlo
    // (ni al aparecer ni al abrirse), aunque la columna esté centrada en la pantalla.
    <div className="relative w-full">
      <div className="absolute inset-x-0 top-0 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <section className="rounded-xl border border-line bg-mist text-ink">
          <h2>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setUserOpen(!open)}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-medium"
            >
              <Smartphone
                aria-hidden="true"
                className="size-5 shrink-0 text-brand-strong"
              />
              <span className="flex-1">¿Cómo instalo Recov?</span>
              <ChevronDown
                aria-hidden="true"
                className={`size-5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>
          </h2>

          {open && (
            <div
              id={panelId}
              className="space-y-4 border-t border-line px-4 pt-3 pb-4 text-sm"
            >
              {env.inApp && (
                <p className="flex gap-2.5 rounded-lg bg-[#FEF3C7] p-3 text-[#92400E]">
                  <TriangleAlert
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0"
                  />
                  <span>
                    Estás en el navegador de otra app y desde aquí no se puede
                    instalar. Toca los tres puntos o el ícono de brújula y elige
                    “Abrir en Safari” (o “Abrir en Chrome” en Android).
                  </span>
                </p>
              )}

              <p className="text-muted">
                Recov es una web app: no necesitas tienda ni descargas, y no
                ocupa espacio. Instálala y luego inicia sesión desde el ícono.
              </p>

              <div
                role="tablist"
                aria-label="Tu celular"
                className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-white p-1"
              >
                {TABS.map((t) => {
                  const selected = t.id === tab;
                  return (
                    <button
                      key={t.id}
                      id={`${id}-tab-${t.id}`}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls={`${id}-tabpanel`}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => setUserTab(t.id)}
                      onKeyDown={onTabKey}
                      className={`min-h-11 rounded-lg font-medium transition ${
                        selected
                          ? "bg-brand-soft font-semibold"
                          : "text-muted hover:bg-mist"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <div
                id={`${id}-tabpanel`}
                role="tabpanel"
                aria-labelledby={`${id}-tab-${tab}`}
              >
                {tab === "android" && promptEvent && !env.inApp ? (
                  <button
                    type="button"
                    onClick={install}
                    className={`w-full ${buttonPrimary}`}
                  >
                    <Download aria-hidden="true" className="size-5" />
                    Instalar
                  </button>
                ) : (
                  <Steps
                    steps={tab === "iphone" ? IPHONE_STEPS : ANDROID_STEPS}
                  />
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-2">
      {steps.map(({ Icon, text }, i) => (
        <li
          key={i}
          className="flex min-h-11 items-center gap-3 rounded-lg bg-white px-3 py-2"
        >
          <span
            aria-hidden="true"
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-ink"
          >
            {i + 1}
          </span>
          <span className="flex-1">{text}</span>
          <Icon
            aria-hidden="true"
            className="size-5 shrink-0 text-brand-strong"
          />
        </li>
      ))}
    </ol>
  );
}
