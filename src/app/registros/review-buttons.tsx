"use client";

import { useActionState, useState } from "react";
import { reviewMember, type ReviewState } from "./actions";
import { ErrorMessage, buttonDanger, buttonPrimary, textButton } from "@/app/ui";

export function ReviewButtons({ profileId }: { profileId: string }) {
  const [confirmingReject, setConfirmingReject] = useState(false);
  const [state, formAction, pending] = useActionState<ReviewState, FormData>(
    reviewMember,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      <input type="hidden" name="profile_id" value={profileId} />

      {confirmingReject ? (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="text-sm text-muted">¿Rechazar este registro?</span>
          <button
            type="submit"
            name="decision"
            value="rechazar"
            disabled={pending}
            className={`text-sm ${buttonDanger}`}
          >
            {pending ? "Guardando…" : "Sí, rechaza"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingReject(false)}
            disabled={pending}
            className={textButton}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="submit"
            name="decision"
            value="confirmar"
            disabled={pending}
            className={`text-sm ${buttonPrimary}`}
          >
            {pending ? "Guardando…" : "Confirma"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingReject(true)}
            disabled={pending}
            className={textButton}
          >
            Rechaza
          </button>
        </div>
      )}

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
    </form>
  );
}
