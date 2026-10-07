import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export default async function PendingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS: cada usuario siempre puede leer su propio perfil, aunque esté pendiente.
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  // Confirmados, rechazados o sin perfil: el dashboard decide qué mostrar.
  if (profile?.status !== "pendiente") redirect("/dashboard");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold text-slate-900">
        Tu perfil está en revisión
      </h1>
      <p className="max-w-md text-slate-500">
        La dirección del club te confirmará pronto.
      </p>
      <form action={signOut}>
        <button className="text-sm text-slate-500 underline">
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
