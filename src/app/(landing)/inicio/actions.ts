"use server";

import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { validateRequest, type Field } from "@/lib/landing/config";

export type RequestState = { status: "idle" | "ok" | "error"; errors?: Partial<Record<Field, string>>; message?: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function requestAccess(_prev: RequestState, formData: FormData): Promise<RequestState> {
  // Honeypot: un bot rellena el campo oculto; se responde ok sin guardar nada.
  if (String(formData.get("website") ?? "") !== "") return { status: "ok" };

  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const v = { club: get("club"), sport: get("sport"), role: get("role"), name: get("name"), email: get("email") };
  const errors = validateRequest(v);
  if (Object.keys(errors).length) return { status: "error", errors };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_access_request", {
    p_club_name: v.club,
    p_sport: v.sport,
    p_role: v.role,
    p_full_name: v.name,
    p_email: v.email,
  });
  if (error) return { status: "error", message: "No pudimos enviar tu solicitud. Inténtalo de nuevo en un momento." };

  // Solo se avisa por correo si es una solicitud nueva. Si el correo falla, la solicitud ya quedó guardada.
  if (!(data as { duplicate?: boolean } | null)?.duplicate) {
    const rows: [string, string][] = [
      ["Club", v.club],
      ["Deporte", v.sport],
      ["Cargo", v.role],
      ["Nombre", v.name],
      ["Correo", v.email],
    ];
    await sendEmail({
      to: "contacto@recov.cl",
      subject: `Solicitud de acceso anticipado: ${v.club}`,
      text: `Nueva solicitud de acceso anticipado a Recov.\n\n${rows.map(([k, x]) => `${k}: ${x}`).join("\n")}\n`,
      html: `<p>Nueva solicitud de acceso anticipado a Recov.</p><ul>${rows
        .map(([k, x]) => `<li><strong>${k}:</strong> ${esc(x)}</li>`)
        .join("")}</ul>`,
    });
  }
  return { status: "ok" };
}
