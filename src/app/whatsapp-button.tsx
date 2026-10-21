// "Contactar por WhatsApp": abre un chat con el jugador. Solo se muestra al
// staff cuando get_player_phone devuelve un número (0030).
import { MessageCircle } from "lucide-react";
import { whatsappUrl } from "@/lib/phone";
import { buttonSecondary } from "@/app/ui";

export function WhatsAppButton({ phone, name }: { phone: string; name: string }) {
  return (
    <a
      href={whatsappUrl(phone)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Contactar a ${name} por WhatsApp (se abre en otra pestaña)`}
      className={`w-fit text-sm ${buttonSecondary}`}
    >
      <MessageCircle aria-hidden="true" className="size-4" />
      Contactar por WhatsApp
    </a>
  );
}
