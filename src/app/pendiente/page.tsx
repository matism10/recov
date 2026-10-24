import { redirect } from "next/navigation";
import { getProfile, getSessionUser, getSupabase } from "@/lib/session";
import { signOut } from "@/app/login/actions";
import { buttonSecondary, textButton } from "@/app/ui";
import { InstallGuide } from "@/app/install-guide";
import { PendingWatcher } from "./pending-watcher";
import { resendVerification } from "./actions";

const VERIFICATION_MESSAGE: Record<string, string> = {
  enviado: "Te enviamos un correo nuevo.",
  espera: "Ya te enviamos uno hace poco. Espera un minuto y vuelve a intentarlo.",
  error: "No pudimos enviar el correo. Intenta de nuevo en unos minutos.",
};

export default async function PendingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { telefono, verificacion } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // RLS: cada usuario siempre puede leer su propio perfil, aunque esté pendiente.
  const supabase = await getSupabase();
  const [profile, { data: own }] = await Promise.all([
    getProfile(user.id),
    supabase.from("profiles").select("email_verified_at").eq("id", user.id).maybeSingle(),
  ]);

  // Confirmados, rechazados o sin perfil: el dashboard decide qué mostrar.
  if (profile?.status !== "pendiente") redirect("/dashboard");
  const verified = !!own?.email_verified_at;
  const message = typeof verificacion === "string" ? VERIFICATION_MESSAGE[verificacion] : undefined;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <h1 className="text-xl font-semibold text-ink">
        El staff está revisando tu perfil
      </h1>
      <p className="max-w-md text-muted">
        Te llegará un correo cuando estés listo para acceder a la plataforma.
      </p>

      {/* Sin correo verificado, la dirección no puede aprobar la cuenta. */}
      {!verified && (
        <section className="w-full max-w-md rounded-xl border border-line bg-mist p-5 text-left">
          <h2 className="font-semibold text-ink">Antes, verifica tu correo</h2>
          <p className="mt-1 text-sm text-muted">
            Te enviamos un link a <span className="font-medium text-ink">{user.email}</span>.
            Ábrelo para que tu club pueda aprobar tu cuenta. Si no lo ves, revisa spam.
          </p>
          {message && (
            <p role="status" className="mt-3 text-sm text-ink">
              {message}
            </p>
          )}
          <form action={resendVerification} className="mt-4">
            <button className={`w-full ${buttonSecondary}`}>Reenviar correo</button>
          </form>
        </section>
      )}

      {telefono === "no-guardado" && (
        <p role="status" className="max-w-md rounded-xl bg-mist px-4 py-3 text-sm text-ink">
          Tu cuenta quedó creada, pero no pudimos guardar tu teléfono. Podrás agregarlo desde
          tu perfil cuando el club confirme tu cuenta.
        </p>
      )}
      <form action={signOut}>
        <button className={textButton}>
          Cerrar sesión
        </button>
      </form>
      <PendingWatcher userId={user.id} verified={verified} />
      {/* En celular: cómo instalar Recov mientras espera (cuelga bajo lo anterior). */}
      <div className="w-full max-w-sm text-left">
        <InstallGuide />
      </div>
    </main>
  );
}
