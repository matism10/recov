// Pestaña Carga de /metricas: minutos jugados, carga sRPE, bienestar y gimnasio. Las
// funciones validan en la base el permiso (carga_ver o staff, según la función).
import type { getSupabase } from "@/lib/session";
import type { Format } from "@/lib/sevens";
import { getTeamLoad } from "@/lib/match-load";
import { getTeamReturnSummary } from "@/lib/return-break";
import { currentWeek, getGymAdherence, type LoadBreakdownRow } from "@/lib/gym";
import type { TeamSrpeRow, WellnessFlag } from "@/lib/srpe";
import { LoadSection } from "./load-section";
import { SrpeCard } from "./srpe-card";
import { TeamLoadTable } from "./team-load-table";

type Client = Awaited<ReturnType<typeof getSupabase>>;

export async function LoadTab({ supabase, format }: { supabase: Client; format: Format }) {
  const week = currentWeek();
  const [load, srpeTeam, srpeFlags, breakdown, adherence, returns] = await Promise.all([
    getTeamLoad(supabase, 4, format),
    // Carga sRPE de la semana y bienestar bajo lo habitual.
    supabase
      .rpc("team_srpe_load", { p_format: format })
      .then(({ data, error }) => (error ? null : ((data ?? []) as TeamSrpeRow[]))),
    supabase
      .rpc("wellness_flags", { p_format: format })
      .then(({ data, error }) => (error ? null : ((data ?? []) as WellnessFlag[]))),
    // Desglose de la carga por tipo y cumplimiento del plan de gimnasio de la semana.
    supabase
      .rpc("team_load_breakdown", { p_format: format })
      .then(({ data, error }) => (error ? null : ((data ?? []) as LoadBreakdownRow[]))),
    getGymAdherence(supabase, week.monday, week.sunday),
    // Vuelta tras parón (solo informativa).
    getTeamReturnSummary(supabase, format),
  ]);

  return (
    <LoadSection
      result={load}
      srpe={
        <div className="space-y-3">
          <SrpeCard team={srpeTeam} flags={srpeFlags} returns={returns} />
          {srpeTeam && <TeamLoadTable team={srpeTeam} breakdown={breakdown} adherence={adherence} />}
        </div>
      }
    />
  );
}
