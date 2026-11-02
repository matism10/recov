"use client";

import { createContext, useContext, useState } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { linkClass } from "@/app/ui";

type Tab = "registro" | "login";

// Pestañas Registro | Iniciar sesión del link del plantel. Las dos llegan ya
// renderizadas desde el servidor y se cambian en el cliente, sin otro viaje; la URL
// (?tab=) se actualiza con replaceState para que recargar muestre la misma. La
// pestaña oculta sigue montada: lo escrito en el registro no se pierde.
const TabContext = createContext<(tab: Tab) => void>(() => {});

export function AuthTabs({
  initial,
  base,
  registro,
  login,
}: {
  initial: Tab;
  base: string;
  registro: React.ReactNode;
  login: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>(initial);
  const show = (next: Tab) => {
    setTab(next);
    // Se quitan los avisos de un intento anterior (error de login, cuenta nueva).
    window.history.replaceState(null, "", `${base}?tab=${next}`);
  };
  return (
    <TabContext.Provider value={show}>
      <div role="group" aria-label="Elige una opción" className="grid grid-cols-2 gap-1 rounded-xl bg-white p-1 ring-1 ring-line">
        <TabButton active={tab === "registro"} onClick={() => show("registro")} Icon={UserPlus}>
          Registro
        </TabButton>
        <TabButton active={tab === "login"} onClick={() => show("login")} Icon={LogIn}>
          Iniciar sesión
        </TabButton>
      </div>
      <div hidden={tab !== "registro"}>{registro}</div>
      <div hidden={tab !== "login"}>{login}</div>
    </TabContext.Provider>
  );
}

function TabButton({
  active,
  onClick,
  Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof LogIn;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-ink transition ${
        active ? "bg-brand-soft font-semibold ring-1 ring-brand" : "hover:bg-mist"
      }`}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {children}
    </button>
  );
}

// "Inicia sesión" / "Regístrate" dentro de cada pestaña: cambian a la otra.
export function SwitchTab({ to, children }: { to: Tab; children: React.ReactNode }) {
  const show = useContext(TabContext);
  return (
    <button type="button" onClick={() => show(to)} className={`inline-flex min-h-11 items-center ${linkClass}`}>
      {children}
    </button>
  );
}
