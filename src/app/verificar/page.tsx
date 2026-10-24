import Link from "next/link";
import { CircleCheck, CircleAlert } from "lucide-react";
import { getSupabase } from "@/lib/session";
import { buttonPrimary, cardClass } from "@/app/ui";

// Destino del link "Verificar mi correo". Funciona con o sin sesión (por ejemplo,
// si la persona abre el correo en otro dispositivo): verify_email solo necesita el token.
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const supabase = await getSupabase();
  const { data: ok } = token
    ? await supabase.rpc("verify_email", { p_token: token })
    : { data: false };

  return (
    <main className="flex flex-1 items-center justify-center bg-white px-4 py-10">
      <div className={`w-full max-w-sm space-y-4 p-8 text-center ${cardClass}`}>
        {ok ? (
          <>
            <CircleCheck aria-hidden="true" className="mx-auto size-10 text-brand-strong" />
            <h1 className="text-xl font-semibold text-ink">Tu correo quedó verificado</h1>
            <p className="text-sm text-muted">
              Ahora tu club puede aprobar tu cuenta. Te avisaremos por correo cuando estés listo.
            </p>
          </>
        ) : (
          <>
            <CircleAlert aria-hidden="true" className="mx-auto size-10 text-muted" />
            <h1 className="text-xl font-semibold text-ink">Este link ya no sirve</h1>
            <p className="text-sm text-muted">
              Puede que ya lo hayas usado o que haya vencido. Si ya verificaste tu correo, no
              tienes que hacer nada más. Si no, entra a Recov y pide un correo nuevo.
            </p>
          </>
        )}
        <Link href="/pendiente" className={`w-full ${buttonPrimary}`}>
          Ir a Recov
        </Link>
      </div>
    </main>
  );
}
