import "server-only";
import type { EmailMessage } from "@/lib/email";

// Correo "ya puedes entrar" para quien la dirección acaba de confirmar.
// Botón en tinta sobre celeste (nunca texto blanco sobre celeste).

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

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
  const firstName = (fullName ?? "").trim().split(/\s+/)[0] ?? "";
  const greeting = firstName ? `Hola, ${firstName}.` : "Hola.";
  const body = `${clubName} confirmó tu cuenta. Ya puedes entrar a Recov con tu correo y contraseña.`;
  const appHint = "Si instalaste Recov en tu celular, ábrela desde el ícono.";

  const text = [greeting, "", body, "", `Entra aquí: ${loginUrl}`, "", appHint, "", "Recov"].join("\n");

  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;padding:24px;background:#F7F8FA;font-family:Arial,Helvetica,sans-serif;color:#0E1B2C">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #E3E7EE;border-radius:12px">
    <tr><td style="padding:28px">
      <p style="margin:0 0 20px;font-size:20px;font-weight:800">Recov</p>
      <p style="margin:0 0 12px;font-size:16px;line-height:1.5">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.5">${escapeHtml(body)}</p>
      <a href="${escapeHtml(loginUrl)}" style="display:inline-block;padding:12px 20px;background:#38BDF8;color:#0E1B2C;font-size:16px;font-weight:700;text-decoration:none;border-radius:12px">Entrar a Recov</a>
      <p style="margin:24px 0 0;font-size:14px;line-height:1.5;color:#5B6676">${escapeHtml(appHint)}</p>
    </td></tr>
  </table>
</body>
</html>`;

  return { to, subject: "Ya puedes entrar a Recov", html, text };
}
