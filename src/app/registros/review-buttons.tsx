"use client";

import { useActionState, useState } from "react";
import { reviewMember, type ReviewState } from "./actions";

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
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">¿Rechazar este registro?</span>
          <button
            type="submit"
            name="decision"
            value="rechazar"
            disabled={pending}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Sí, rechazar"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingReject(false)}
            disabled={pending}
            className="text-sm text-slate-500 underline"
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
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Confirmar"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingReject(true)}
            disabled={pending}
            className="text-sm text-slate-500 underline"
          >
            Rechazar
          </button>
        </div>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
