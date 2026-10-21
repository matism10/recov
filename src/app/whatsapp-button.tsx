// "Contactar por WhatsApp": abre un chat con el jugador. Solo se muestra al
// staff cuando get_player_phone devuelve un número (0030). Verde de WhatsApp
// (#25D366) con texto Ink: blanco sobre ese verde no pasa contraste.
import { MessageCircle } from "lucide-react";
import { whatsappUrl } from "@/lib/phone";

export function WhatsAppButton({ phone, name }: { phone: string; name: string }) {
  return (
    <a
      href={whatsappUrl(phone)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Contactar a ${name} por WhatsApp (se abre en otra pestaña)`}
      className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-medium text-ink transition hover:bg-[#1FBA59] focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <MessageCircle aria-hidden="true" className="size-4" />
      Contactar por WhatsApp
    </a>
  );
}
