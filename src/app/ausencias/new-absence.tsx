"use client";

import { useRouter } from "next/navigation";
import { AbsenceForm, type EventOption } from "./absence-form";

// Pantalla "Avisar una ausencia" del jugador: al guardar vuelve a "Mis ausencias".
export function NewAbsence({ events, today }: { events: EventOption[]; today: string }) {
  const router = useRouter();
  return <AbsenceForm events={events} today={today} onDone={() => router.push("/ausencias")} />;
}
