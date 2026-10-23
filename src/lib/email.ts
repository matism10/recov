import "server-only";
import nodemailer from "nodemailer";

// Envío de correos de Recov. Único punto de contacto con el proveedor: hoy SMTP
// (Gmail) con nodemailer; para pasar a Resend con dominio propio se cambia solo
// este archivo y las variables de entorno.
// Configuración (solo servidor): EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS y
// EMAIL_FROM (ej. "Recov <recov.app@gmail.com>"). Si falta alguna, no se envía nada:
// se deja una advertencia en el log y quien llama decide qué mostrar.

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendResult = { ok: true } | { ok: false; reason: "not_configured" | "failed" };

function readConfig() {
  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT);
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const from = process.env.EMAIL_FROM;
  if (!host || !port || !user || !pass || !from) return null;
  return { host, port, user, pass, from };
}

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const config = readConfig();
  if (!config) {
    console.warn("[email] Falta configuración EMAIL_*: no se envió el correo.");
    return { ok: false, reason: "not_configured" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465, // 465: TLS directo; 587: STARTTLS
      auth: { user: config.user, pass: config.pass },
    });
    await transporter.sendMail({ from: config.from, ...message });
    return { ok: true };
  } catch (error) {
    // Sin datos del destinatario ni credenciales en el log.
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[email] No se pudo enviar el correo:", detail);
    return { ok: false, reason: "failed" };
  }
}
