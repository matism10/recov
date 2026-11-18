"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { AbsenceForm, type EventOption, type PlayerOption } from "@/app/ausencias/absence-form";
import { buttonPrimary } from "@/app/ui";

// Modal "Declarar ausencia" del staff: un jugador o, con paron_declarar, todo el plantel.
export function DeclareAbsenceDialog({
  players,
  events,
  today,
  canSquad,
}: {
  players: PlayerOption[];
  events: EventOption[];
  today: string;
  canSquad: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`shrink-0 text-sm ${buttonPrimary}`}>
        <Plus aria-hidden="true" className="size-4" />
        Declarar ausencia
      </button>
      {open && (
        <div
          className="fixed inset-0 z-40 flex items-end bg-ink/30 lg:items-center lg:justify-center lg:p-6"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="declare-absence-title"
            className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-white p-5 shadow-lg lg:max-w-lg lg:rounded-2xl lg:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 id="declare-absence-title" className="text-xl font-semibold text-ink">
                Declarar ausencia
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="-mt-2 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-mist"
              >
                <X aria-hidden="true" className="size-5" />
                <span className="sr-only">Cerrar</span>
              </button>
            </div>
            <AbsenceForm
              players={players}
              events={events}
              today={today}
              canSquad={canSquad}
              submitLabel="Registrar ausencia"
              onDone={() => {
                setOpen(false);
                router.refresh();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
