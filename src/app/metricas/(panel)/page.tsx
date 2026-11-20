import { redirect } from "next/navigation";
import { getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { isStaff, type UserRole } from "@/lib/roles";
import { can } from "@/lib/permissions";
import { getActiveFormat } from "@/lib/format";
import { cardClass } from "@/app/ui";
import { PageHeader } from "@/app/ui-blocks";
import { MetricsTabs, type MetricsTab } from "../tabs";
import { InjuriesTab } from "../injuries-tab";
import { LoadTab } from "../load-tab";

// Métricas del plantel para el staff, en pestañas Lesiones | Carga (?tab=). Solo se
// muestran las pestañas que permite cada permiso (lesiones_ver, carga_ver) y solo se
// consulta la activa. La base valida de nuevo en cada función.
// Formato activo: en Sevens, todas las métricas son del grupo Sevens (0046).
export default async function MetricsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const supabase = await getSupabase();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [me, format, params] = await Promise.all([getProfile(user.id), getActiveFormat(user.id), searchParams]);
  if (me?.status === "pendiente") redirect("/pendiente");
  const roles = (me?.roles ?? []) as UserRole[];
  if (me?.status !== "confirmado" || !isStaff(roles)) redirect("/dashboard");

  const tabs: MetricsTab[] = [
    ...(can(roles, "lesiones_ver") ? (["lesiones"] as const) : []),
    ...(can(roles, "carga_ver") ? (["carga"] as const) : []),
  ];
  const active = tabs.find((t) => t === params.tab) ?? tabs[0];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 lg:px-8">
      <PageHeader title="Métricas del plantel" description="Lesiones y carga del plantel." className="mb-4 lg:mb-6" />

      {!active ? (
        <p className={`p-5 text-sm text-muted ${cardClass}`}>
          No tienes permiso para ver lesiones ni carga. Pídeselo al head coach.
        </p>
      ) : (
        <>
          <MetricsTabs tabs={tabs} active={active} />
          {active === "lesiones" ? (
            <InjuriesTab supabase={supabase} format={format} />
          ) : (
            <LoadTab supabase={supabase} format={format} />
          )}
        </>
      )}
    </main>
  );
}
