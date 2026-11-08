import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/app/calendario/member";
import { addDays, todayInChile } from "@/lib/injuries";
import { dayLabel } from "@/lib/srpe";
import { PageTitle, textButton } from "@/app/ui";
import { OwnSessionForm } from "./own-session-form";

// Sesión de gimnasio por su cuenta (fuera del plan): fecha (hoy o hasta 2 días atrás),
// duración, esfuerzo y nota. Suma a la carga como cualquier sesión con esfuerzo.
export default async function OwnGymSessionPage() {
  const { roles } = await requireMember();
  if (!roles.includes("jugador")) redirect("/dashboard");
  const today = todayInChile();
  const dates = [0, 1, 2].map((d) => {
    const date = addDays(today, -d);
    return { date, label: d === 0 ? "Hoy" : d === 1 ? `Ayer · ${dayLabel(date)}` : dayLabel(date) };
  });
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <header className="mb-6">
        <Link href="/mi-plan" className={textButton}>
          ← Volver a Mi plan
        </Link>
        <PageTitle className="mt-2">Gimnasio por tu cuenta</PageTitle>
        <p className="mt-1 text-sm text-muted">Registra una sesión que hiciste fuera del plan para que sume a tu carga.</p>
      </header>
      <OwnSessionForm dates={dates} />
    </main>
  );
}
