import type { SupabaseClient } from "@supabase/supabase-js";
import { SectionTitle, cardClass } from "@/app/ui";
import { PositionForm } from "./position-form";

// "Cambiar posición" en la ficha: catálogo del deporte (formato 15) y, en rugby con
// Sevens, la posición de Sevens si el jugador está en el grupo. La página solo la
// muestra con el permiso posicion_cambiar; la base lo vuelve a verificar al guardar.
export async function PositionSection({
  supabase,
  playerId,
  clubId,
  userId,
  sport,
  hasSevens,
}: {
  supabase: SupabaseClient;
  playerId: string;
  clubId: string;
  userId: string | null;
  sport: string;
  hasSevens: boolean;
}) {
  const [{ data: player }, { data: positions }, { data: group }] = await Promise.all([
    supabase.from("players").select("position, secondary_position").eq("id", playerId).maybeSingle(),
    supabase.from("positions").select("name, format").eq("sport", sport).order("sort"),
    hasSevens && userId
      ? supabase
          .from("sevens_group")
          .select("position, secondary_position")
          .eq("club_id", clubId)
          .eq("member_id", userId)
          .is("archived_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const names = (format: string) =>
    (positions ?? []).filter((p) => p.format === format).map((p) => p.name as string);

  return (
    <section className={`mb-6 p-5 ${cardClass}`}>
      <SectionTitle className="mb-3">Cambiar posición</SectionTitle>
      <PositionForm
        playerId={playerId}
        position={player?.position ?? null}
        secondary={player?.secondary_position ?? null}
        options={names("15")}
        sevens={
          group
            ? { position: group.position ?? null, secondary: group.secondary_position ?? null, options: names("7") }
            : null
        }
      />
    </section>
  );
}
