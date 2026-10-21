import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { textButton } from "@/app/ui";

export default async function PendingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { telefono } = await searchParams;
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
      <h1 className="text-xl font-semibold text-ink">
        Tu perfil está en revisión
      </h1>
      <p className="max-w-md text-muted">
        La dirección del club te confirmará pronto.
      </p>
      {telefono === "no-guardado" && (
        <p role="status" className="max-w-md rounded-xl bg-mist px-4 py-3 text-sm text-ink">
          Tu cuenta quedó creada, pero no pudimos guardar tu teléfono. Podrás agregarlo más
          adelante.
        </p>
      )}
      <form action={signOut}>
        <button className={textButton}>
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
