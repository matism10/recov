import { redirect } from "next/navigation";
import { ResetForm } from "./reset-form";
import { cardClass } from "@/app/ui";

// Destino del link "Elegir contraseña nueva". La página no usa el link al abrirse:
// se usa al enviar el formulario (ver actions.ts).
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) redirect("/recuperar?error=link");

  return (
    <main className="flex flex-1 items-center justify-center bg-white px-4 py-10">
      <div className={`w-full max-w-sm space-y-5 p-8 ${cardClass}`}>
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Elige tu contraseña nueva</h1>
          <p className="mt-1 text-sm text-muted">Al guardarla, entras a Recov con tu cuenta.</p>
        </div>
        <ResetForm token={token} />
      </div>
    </main>
  );
}
