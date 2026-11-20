"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Ellipsis, MessageCircle, UserCog, X } from "lucide-react";
import { WhatsAppButton } from "@/app/whatsapp-button";
import { whatsappUrl } from "@/lib/phone";
import { buttonSecondary } from "@/app/ui";

// Acciones de la ficha, fuera del cuerpo de la página. Escritorio: botones a la derecha del
// encabezado. Celular: botón "⋯" que abre una hoja con las mismas acciones. "Cambiar
// posición" (solo con el permiso, que decide la página) abre su formulario en un cuadro o
// en la hoja; el WhatsApp solo llega si el staff puede ver el teléfono.
type View = null | "menu" | "position";

export function PlayerActions({
  name,
  phone,
  positionForm,
}: {
  name: string;
  phone: string | null;
  positionForm: ReactNode | null;
}) {
  const [view, setView] = useState<View>(null);

  useEffect(() => {
    if (!view) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setView(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);

  if (!phone && !positionForm) return null;

  const rowClass =
    "flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left text-base font-medium text-ink transition hover:bg-mist";

  return (
    <>
      <div className="hidden items-center gap-2 lg:flex">
        {phone && <WhatsAppButton phone={phone} name={name} />}
        {positionForm && (
          <button type="button" onClick={() => setView("position")} className={`text-sm ${buttonSecondary}`}>
            <UserCog aria-hidden="true" className="size-4" />
            Cambiar posición
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => setView("menu")}
        aria-label="Más acciones"
        aria-haspopup="dialog"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-ink transition hover:bg-mist lg:hidden"
      >
        <Ellipsis aria-hidden="true" className="size-5" />
      </button>

      {view && (
        <div
          className="fixed inset-0 z-40 flex items-end bg-ink/30 lg:items-center lg:justify-center lg:p-6"
          onClick={(e) => e.target === e.currentTarget && setView(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="player-actions-title"
            className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-white p-5 shadow-lg lg:max-w-lg lg:rounded-2xl lg:p-6"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 id="player-actions-title" className="text-xl font-semibold text-ink">
                {view === "position" ? "Cambiar posición" : "Más acciones"}
              </h2>
              <button
                type="button"
                onClick={() => setView(null)}
                className="-mt-2 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-mist"
              >
                <X aria-hidden="true" className="size-5" />
                <span className="sr-only">Cerrar</span>
              </button>
            </div>
            {view === "position" ? (
              positionForm
            ) : (
              <ul className="space-y-1">
                {phone && (
                  <li>
                    <a
                      href={whatsappUrl(phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Contactar a ${name} por WhatsApp (se abre en otra pestaña)`}
                      onClick={() => setView(null)}
                      className={rowClass}
                    >
                      <MessageCircle aria-hidden="true" className="size-5 text-muted" />
                      Contactar por WhatsApp
                    </a>
                  </li>
                )}
                {positionForm && (
                  <li>
                    <button type="button" onClick={() => setView("position")} className={rowClass}>
                      <UserCog aria-hidden="true" className="size-5 text-muted" />
                      Cambiar posición
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
