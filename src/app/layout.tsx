import type { Metadata } from "next";
import { Inter, Nunito } from "next/font/google";
import "./globals.css";

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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
