import Link from "next/link";
import { redirect } from "next/navigation";
import { canManageEvents } from "@/lib/roles";
import { parseIsoDate, todayInChile } from "@/lib/injuries";
import { textButton } from "@/app/ui";
import { EventForm } from "../event-form";
import { requireMember } from "../member";

// Nuevo evento: solo head coach, manager y entrenador (create_event lo verifica).
export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { fecha } = await searchParams;
  const { roles } = await requireMember();
  if (!canManageEvents(roles)) redirect("/calendario");

  // Parte en el día que se estaba mirando, salvo que ya haya pasado.
  const today = todayInChile();
  const date =
    typeof fecha === "string" && parseIsoDate(fecha) !== null && fecha >= today ? fecha : today;

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <header className="mb-6">
        <Link href={`/calendario?fecha=${date}`} className={textButton}>
          ← Volver al calendario
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Nuevo evento</h1>
      </header>
      <EventForm
        defaults={{
          type: "entrenamiento",
          date,
          start: "19:00",
          end: "20:30",
          location: "",
          opponent: "",
          notes: "",
        }}
      />
    </main>
  );
}
