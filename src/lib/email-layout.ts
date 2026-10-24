import "server-only";
import { headers } from "next/headers";
import type { EmailMessage } from "@/lib/email";

// Diseño común de los correos de Recov: tarjeta blanca, un saludo, párrafos cortos,
// un botón (tinta sobre celeste, nunca texto blanco) y una nota al pie opcional.

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function firstName(fullName: string | null | undefined) {
  return (fullName ?? "").trim().split(/\s+/)[0] ?? "";
}

export function buildEmail({
  to,
  subject,
  name,
  paragraphs,
  button,
  footnote,
}: {
  to: string;
  subject: string;
  name?: string | null;
  paragraphs: string[];
  button: { label: string; url: string };
  footnote?: string;
}): EmailMessage {
  const first = firstName(name);
  const greeting = first ? `Hola, ${first}.` : "Hola.";

  const text = [
    greeting,
    "",
    ...paragraphs.flatMap((p) => [p, ""]),
    `${button.label}: ${button.url}`,
    ...(footnote ? ["", footnote] : []),
    "",
    "Recov",
  ].join("\n");

  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;padding:24px;background:#F7F8FA;font-family:Arial,Helvetica,sans-serif;color:#0E1B2C">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #E3E7EE;border-radius:12px">
    <tr><td style="padding:28px">
      <p style="margin:0 0 20px;font-size:20px;font-weight:800">Recov</p>
      <p style="margin:0 0 12px;font-size:16px;line-height:1.5">${escapeHtml(greeting)}</p>
      ${paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5">${escapeHtml(p)}</p>`).join("\n      ")}
      <a href="${escapeHtml(button.url)}" style="display:inline-block;margin-top:8px;padding:12px 20px;background:#38BDF8;color:#0E1B2C;font-size:16px;font-weight:700;text-decoration:none;border-radius:12px">${escapeHtml(button.label)}</a>
      ${footnote ? `<p style="margin:24px 0 0;font-size:14px;line-height:1.5;color:#5B6676">${escapeHtml(footnote)}</p>` : ""}
    </td></tr>
  </table>
</body>
</html>`;

  return { to, subject, html, text };
}

// Dirección de la app según el request actual (producción, preview o local), para
// armar los links de los correos.
export async function appOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
