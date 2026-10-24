"use server";

import { redirect } from "next/navigation";
import { sendEmail } from "@/lib/email";
import { appOrigin, buildEmail } from "@/lib/email-layout";
import { allowAuthEmail, createRecoveryTokenHash } from "@/lib/supabase/admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Pide el link para elegir una contraseña nueva. La respuesta es siempre la misma,
// exista o no la cuenta, para no revelar qué correos están registrados.
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) redirect("/recuperar?error=correo");

  if (await allowAuthEmail(email, "recuperacion")) {
    const tokenHash = await createRecoveryTokenHash(email);
    if (tokenHash) {
      const origin = await appOrigin();
      await sendEmail(
        buildEmail({
          to: email,
          subject: "Recupera tu contraseña de Recov",
          paragraphs: [
            "Recibimos una solicitud para cambiar la contraseña de tu cuenta.",
            "El link sirve una sola vez y vence en 1 hora.",
          ],
          button: {
            label: "Elegir contraseña nueva",
            url: `${origin}/restablecer?token=${encodeURIComponent(tokenHash)}`,
          },
          footnote: "Si no lo pediste tú, ignora este correo: tu contraseña no cambia.",
        }),
      );
    }
  }

  redirect("/recuperar?enviado=1");
}
