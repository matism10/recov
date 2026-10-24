"use client";

// Mientras la cuenta espera confirmación, revisa su propio perfil cada 10 s (RLS:
// cada usuario lee su perfil) y, apenas la dirección la confirma, lleva al Resumen.
// Si el correo se verifica (por ejemplo, desde el celular), refresca la pantalla.
// Si la pestaña no está visible, no consulta; al volver, revisa de inmediato.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const INTERVAL_MS = 10_000;

export function PendingWatcher({ userId, verified }: { userId: string; verified: boolean }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    async function check() {
      const { data } = await supabase
        .from("profiles")
        .select("status, email_verified_at")
        .eq("id", userId)
        .maybeSingle();
      if (stopped) return;
      if (data?.status === "confirmado") {
        stopped = true;
        // Navegación completa: el menú y la barra dependen del estado del perfil.
        window.location.replace("/dashboard");
        return;
      }
      if (!verified && data?.email_verified_at) router.refresh();
      schedule();
    }

    function schedule() {
      clearTimeout(timer);
      if (stopped || document.visibilityState !== "visible") return;
      timer = setTimeout(check, INTERVAL_MS);
    }

    function onVisibility() {
      clearTimeout(timer);
      if (document.visibilityState === "visible") void check();
    }

    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [userId, verified, router]);

  return null;
}
