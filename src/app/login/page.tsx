import { signIn } from "./actions";
import { ErrorMessage, buttonPrimary, cardClass, inputClass, labelClass } from "@/app/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center bg-white px-4">
      <form action={signIn} className={`w-full max-w-sm space-y-5 p-8 ${cardClass}`}>
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Recov</h1>
          <p className="mt-1 text-sm text-muted">
            Ingresa con tu cuenta del club.
          </p>
        </div>

        <label className={labelClass}>
          Correo
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Contraseña
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={inputClass}
          />
        </label>

        {error && <ErrorMessage>Correo o contraseña incorrectos.</ErrorMessage>}

        <button type="submit" className={`w-full ${buttonPrimary}`}>
          Entra
        </button>
      </form>
    </main>
  );
}
