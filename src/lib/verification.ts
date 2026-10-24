import "server-only";
import { sendEmail } from "@/lib/email";
import { appOrigin, buildEmail } from "@/lib/email-layout";
import { allowAuthEmail, createEmailVerificationToken } from "@/lib/supabase/admin";

export type VerificationResult = "enviado" | "espera" | "error";

// Envía el correo "Verifica tu correo" a una cuenta recién registrada (o que pide
// reenviarlo). Quien llama ya sabe que el perfil y el correo son de la sesión actual.
export async function sendVerificationEmail({
  profileId,
  email,
  fullName,
}: {
  profileId: string;
  email: string;
  fullName: string | null;
}): Promise<VerificationResult> {
  if (!(await allowAuthEmail(email, "verificacion"))) return "espera";

  const token = await createEmailVerificationToken(profileId);
  if (!token) return "error";

  const origin = await appOrigin();
  const result = await sendEmail(
    buildEmail({
      to: email,
      subject: "Verifica tu correo en Recov",
      name: fullName,
      paragraphs: [
        "Confirma que este correo es tuyo para que tu club pueda aprobar tu cuenta.",
        "El link vence en 7 días.",
      ],
      button: { label: "Verificar mi correo", url: `${origin}/verificar?token=${token}` },
      footnote: "Si no te registraste en Recov, ignora este correo.",
    }),
  );
  return result.ok ? "enviado" : "error";
}
