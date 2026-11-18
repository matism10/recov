import { redirect } from "next/navigation";
import { PageTitle } from "@/app/ui";
import { BackLink } from "@/app/back-link";
import { requireMember } from "@/app/calendario/member";
import { getActiveFormat } from "@/lib/format";
import { getUpcomingEventOptions } from "@/lib/absences";
import { todayInChile } from "@/lib/injuries";
import { NewAbsence } from "../new-absence";

// El jugador avisa que no va a un evento o que estará ausente varios días.
// declare_absence valida todo en la base; aquí solo se arma la lista de eventos.
export default async function NewAbsencePage() {
  const { supabase, roles, clubId, userId } = await requireMember();
  if (!roles.includes("jugador")) redirect("/dashboard");
  const format = await getActiveFormat(userId);
  const events = await getUpcomingEventOptions(supabase, clubId, format);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <header className="mb-6">
        <BackLink fallback="/ausencias">← Volver a Mis ausencias</BackLink>
        <PageTitle className="mt-2">Avisar una ausencia</PageTitle>
        <p className="mt-1 text-sm text-muted">
          Tu staff verá el aviso. La lista de asistencia la sigue pasando el staff.
        </p>
      </header>
      <NewAbsence events={events} today={todayInChile()} />
    </main>
  );
}
