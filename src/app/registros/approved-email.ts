import "server-only";
import type { EmailMessage } from "@/lib/email";
import { buildEmail } from "@/lib/email-layout";

// Correo "ya puedes entrar" para quien la dirección acaba de confirmar.
export function approvedEmail({
  to,
  fullName,
  clubName,
  loginUrl,
}: {
  to: string;
  fullName: string | null;
  clubName: string;
  loginUrl: string;
}): EmailMessage {
  return buildEmail({
    to,
    subject: "Ya puedes entrar a Recov",
    name: fullName,
    paragraphs: [`${clubName} confirmó tu cuenta. Ya puedes entrar a Recov con tu correo y contraseña.`],
    button: { label: "Entrar a Recov", url: loginUrl },
    footnote: "Si instalaste Recov en tu celular, ábrela desde el ícono.",
  });
}
