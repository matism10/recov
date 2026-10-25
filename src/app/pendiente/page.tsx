import { redirect } from "next/navigation";
import { getProfile, getSessionUser } from "@/lib/session";
import { signOut } from "@/app/login/actions";
import { textButton } from "@/app/ui";
import { InstallGuide } from "@/app/install-guide";
import { PendingWatcher } from "./pending-watcher";

export default async function PendingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { telefono } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // RLS: cada usuario siempre puede leer su propio perfil, aunque esté pendiente.
  const profile = await getProfile(user.id);

  // Confirmados, rechazados o sin perfil: el dashboard decide qué mostrar.
  if (profile?.status !== "pendiente") redirect("/dashboard");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold text-ink">
        El staff está revisando tu perfil
      </h1>
      <p className="max-w-md text-muted">
        Te llegará un correo cuando estés listo para acceder a la plataforma.
      </p>
      {telefono === "no-guardado" && (
        <p role="status" className="max-w-md rounded-xl bg-mist px-4 py-3 text-sm text-ink">
          Tu cuenta quedó creada, pero no pudimos guardar tu teléfono. Podrás agregarlo desde
          tu perfil cuando la dirección del plantel confirme tu cuenta.
        </p>
      )}
      <form action={signOut}>
        <button className={textButton}>
          Cerrar sesión
        </button>
      </form>
      <PendingWatcher userId={user.id} />
      {/* En celular: cómo instalar Recov mientras espera (cuelga bajo lo anterior). */}
      <div className="w-full max-w-sm text-left">
        <InstallGuide />
      </div>
    </main>
  );
}
