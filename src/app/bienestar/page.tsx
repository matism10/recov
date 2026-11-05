import Link from "next/link";
import { redirect } from "next/navigation";
import { PageTitle, cardClass, textButton } from "@/app/ui";
import { addDays, todayInChile } from "@/lib/injuries";
import { WELLNESS_COLUMNS, dayLabel, wellnessDaysText, wellnessTargetDate, type WellnessReport } from "@/lib/srpe";
import { requireMember } from "@/app/calendario/member";
import { WellnessForm } from "./wellness-form";

// Check de bienestar del jugador: 5 preguntas de 1 a 5, los días que eligió el plantel
// (o al día siguiente). submit_wellness valida el día; aquí solo se decide qué mostrar.
export default async function WellnessPage() {
  const { supabase, roles, clubId, userId } = await requireMember();
  if (!roles.includes("jugador")) redirect("/dashboard");

  const today = todayInChile();
  const { data: club } = await supabase.from("clubs").select("wellness_days").eq("id", clubId).maybeSingle();
  const days = ((club?.wellness_days as number[] | null) ?? [1]).map(Number);
  const target = wellnessTargetDate(days, today, addDays(today, -1));

  // Respuesta ya guardada para esa fecha (RLS: solo las propias).
  const { data: saved } = target
    ? await supabase
        .from("wellness_reports")
        .select(`${WELLNESS_COLUMNS}, players!inner(user_id)`)
        .eq("club_id", clubId)
        .eq("players.user_id", userId)
        .eq("report_date", target)
        .maybeSingle()
    : { data: null };

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <header className="mb-6">
        <Link href="/dashboard" className={textButton}>
          ← Volver al Resumen
        </Link>
        <PageTitle className="mt-2">¿Cómo estás {target && target !== today ? "desde ayer" : "hoy"}?</PageTitle>
        <p className="mt-1 text-sm text-muted">
          {target && target !== today ? `Check del ${dayLabel(target)} · ` : ""}1 = muy mal · 5 = muy bien
        </p>
      </header>

      {target ? (
        <WellnessForm initial={(saved as WellnessReport | null) ?? null} />
      ) : (
        <p className={`p-5 text-sm text-muted ${cardClass}`}>
          Hoy no toca el check de bienestar. Tu plantel lo pide {wellnessDaysText(days)}.
        </p>
      )}
    </main>
  );
}
