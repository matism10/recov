import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-4">
      <form
        action={signIn}
        className="w-full max-w-sm space-y-5 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200"
      >
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Recov</h1>
          <p className="mt-1 text-sm text-slate-500">
            Ingresa con tu cuenta del club.
          </p>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          Correo
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Contraseña
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            Correo o contraseña incorrectos.
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-700"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
