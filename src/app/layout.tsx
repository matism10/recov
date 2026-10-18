import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { ClubHeaderNav, MobileNav, Sidebar } from "./sidebar";

// Archivo: una sola familia para títulos, cuerpo y wordmark. Fuente variable con
// eje de ancho: se usa semicondensada (font-stretch 87.5% en globals.css).
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-archivo",
});

export const metadata: Metadata = {
  title: "Recov",
  description: "Seguimiento de lesiones para clubes deportivos amateur",
};

// viewport-fit=cover: el contenido llega hasta los bordes del celular y la barra
// inferior usa env(safe-area-inset-bottom) para no quedar bajo la barra de gestos.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${archivo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Sidebar solo en escritorio (lg+). */}
        <div className="flex flex-1">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Encabezado con la identidad del club, en celular y escritorio. */}
            <ClubHeaderNav />
            {children}
          </div>
        </div>
        {/* Barra inferior solo en celular y tablet (hasta lg). */}
        <MobileNav />
      </body>
    </html>
  );
}
