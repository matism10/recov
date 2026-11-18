"use client";

import { useState, useTransition } from "react";
import { ErrorMessage, buttonSecondary } from "@/app/ui";
import { endAbsence } from "./actions";

// "Quitar aviso" o, en un período en curso, "Ya volví" (el aviso queda hasta hoy).
export function EndAbsenceButton({
  id,
  returned = false,
  label,
  className = "",
}: {
  id: string;
  returned?: boolean;
  label?: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className={className}>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await endAbsence(id, returned);
            if (res.error) setError(res.error);
          })
        }
        className={`text-sm ${buttonSecondary}`}
      >
        {pending ? "Guardando…" : (label ?? (returned ? "Ya volví" : "Quitar aviso"))}
      </button>
      {error && <ErrorMessage className="mt-2">{error}</ErrorMessage>}
    </div>
  );
}
