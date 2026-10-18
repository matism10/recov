import type { Metadata } from "next";
import { Inter, Nunito } from "next/font/google";
import "./globals.css";
import { MobileHeader, MobileNav, Sidebar } from "./sidebar";

// Nunito: títulos, subtítulos y wordmark. Inter: cuerpo, tablas y datos.
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
  variable: "--font-nunito",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Recov",
  description: "Seguimiento de lesiones para clubes deportivos amateur",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${nunito.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Sidebar solo en escritorio (lg+). */}
        <div className="flex flex-1">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Encabezado solo en celular y tablet (hasta lg). */}
            <MobileHeader />
            {children}
          </div>
        </div>
        {/* Barra inferior solo en celular y tablet (hasta lg). */}
        <MobileNav />
      </body>
    </html>
  );
}
