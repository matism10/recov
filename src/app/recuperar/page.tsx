import Link from "next/link";
import { requestPasswordReset } from "./actions";
import { ErrorMessage, buttonPrimary, cardClass, inputClass, labelClass, textButton } from "@/app/ui";

const ERRORS: Record<string, string> = {
  correo: "Ingresa un correo válido.",
  link: "El link venció o ya se usó. Pide uno nuevo.",
};

export default async function RecoverPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string; error?: string }>;
}) {
  const { enviado, error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center bg-white px-4 py-10">
      <div className={`w-full max-w-sm space-y-5 p-8 ${cardClass}`}>
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Recupera tu contraseña</h1>
          <p className="mt-1 text-sm text-muted">
            Te enviaremos un link para elegir una contraseña nueva.
          </p>
        </div>

        {enviado ? (
          <p role="status" className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink">
            Si hay una cuenta con ese correo, te enviamos el link. Revisa también spam. Si no
            llega en unos minutos, vuelve a intentarlo.
          </p>
        ) : (
          <form action={requestPasswordReset} className="space-y-5">
            <label className={labelClass}>
              Correo
              <input name="email" type="email" required autoComplete="email" className={inputClass} />
            </label>
            {error && ERRORS[error] && <ErrorMessage>{ERRORS[error]}</ErrorMessage>}
            <button type="submit" className={`w-full ${buttonPrimary}`}>
              Envía el link
            </button>
          </form>
        )}

        <Link href="/login" className={`block text-center ${textButton}`}>
          Volver a ingresar
        </Link>
      </div>
    </main>
  );
}
