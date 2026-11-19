"use client";

import { useEffect } from "react";
import { revealAnchor } from "./reveal-anchor";

// Carga directa de una página con #ancla (enlace o recarga): abre su <details>.
export function AnchorReveal() {
  useEffect(() => {
    if (window.location.hash) revealAnchor(window.location.hash);
    const onHash = () => revealAnchor(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return null;
}
