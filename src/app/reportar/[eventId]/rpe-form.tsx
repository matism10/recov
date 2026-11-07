"use client";

import { EffortScreen } from "@/app/effort-screen";
import { submitRpe } from "./actions";

// Esfuerzo de un entrenamiento o partido con la pantalla de número grande; "No fui a
// este entrenamiento" / "No jugué este partido" guarda la respuesta sin esfuerzo. Al
// guardar vuelve al Resumen.
export function RpeForm({
  eventId,
  match,
  meta,
  title,
  minutes,
  estimated,
  initialRpe,
  answeredAbsent,
}: {
  eventId: string;
  match: boolean;
  meta: string;
  title: string;
  minutes: number;
  estimated: boolean;
  initialRpe: number | null;
  answeredAbsent: boolean;
}) {
  const verb = match ? "jugaste" : "fuiste";
  const note = answeredAbsent
    ? `Avisaste que no ${verb}. Si sí ${verb}, elige un número y guarda.`
    : initialRpe !== null
      ? "Ya respondiste: puedes corregirlo hasta 48 horas después."
      : undefined;

  return (
    <EffortScreen
      backHref="/dashboard"
      backLabel="Volver al Resumen"
      meta={meta}
      title={title}
      note={note}
      minutes={minutes}
      estimated={estimated}
      initialRpe={initialRpe}
      onSave={(rpe) => submitRpe(eventId, rpe, false)}
      absentLabel={match ? "No jugué este partido" : "No fui a este entrenamiento"}
      onAbsent={() => submitRpe(eventId, null, true)}
      doneHref="/dashboard"
    />
  );
}
