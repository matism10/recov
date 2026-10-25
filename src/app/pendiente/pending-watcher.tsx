"use client";

// Mientras la cuenta espera confirmación, revisa sus membresías cada 10 s (RLS:
// cada usuario lee las suyas) y, apenas la dirección de algún plantel la confirma,
// lleva al Resumen (el proxy activa ese plantel).
// Si la pestaña no está visible, no consulta; al volver, revisa de inmediato.
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const INTERVAL_MS = 10_000;

export function PendingWatcher({ userId }: { userId: string }) {
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    async function check() {
      const { data } = await supabase
        .from("club_members")
        .select("club_id")
        .eq("user_id", userId)
        .eq("status", "confirmado")
        .limit(1);
      if (stopped) return;
      if (data && data.length > 0) {
        stopped = true;
        // Navegación completa: el menú y la barra dependen del estado del perfil.
        window.location.replace("/dashboard");
        return;
      }
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
  }, [userId]);

  return null;
}
