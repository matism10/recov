// Manifest de la Web App: permite instalar Recov en la pantalla de inicio del celular.
// Íconos en public/icons/ (generados desde docs/brand/recov-logo.png). Next lo sirve
// en /manifest.webmanifest, accesible sin sesión (ver el matcher de src/proxy.ts).
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Recov",
    short_name: "Recov",
    description: "Seguimiento de lesiones para clubes deportivos amateur",
    lang: "es-CL",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#38BDF8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
