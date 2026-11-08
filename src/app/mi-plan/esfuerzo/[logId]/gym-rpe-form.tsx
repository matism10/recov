"use client";

import { EffortScreen } from "@/app/effort-screen";
import { submitGymRpe } from "../../actions";

// Esfuerzo de la sesión de gimnasio con la pantalla de número grande. Al guardar
// vuelve a la pantalla de felicitaciones. Sin link de "No hice esta sesión": la
// sesión ya quedó marcada como hecha y no hay función para deshacerla.
export function GymRpeForm({
  logId,
  meta,
  minutes,
  initialRpe,
}: {
  logId: string;
  meta: string;
  minutes: number;
  initialRpe: number | null;
}) {
  return (
    <EffortScreen
      backHref="/dashboard"
      backLabel="Volver al Resumen"
      meta={meta}
      title="¿Qué tan dura fue la sesión?"
      note={initialRpe !== null ? "Ya respondiste: puedes corregirlo hasta 2 días después." : undefined}
      minutes={minutes}
      initialRpe={initialRpe}
      onSave={(rpe) => submitGymRpe(logId, rpe)}
      doneHref={`/mi-plan/listo/${logId}`}
    />
  );
}
