import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import "./landing.css";

// Archivo variable con eje de ancho (wdth) para los titulares condensados; Inter para el texto.
const title = Archivo({ subsets: ["latin"], axes: ["wdth"], display: "swap", variable: "--lp-title" });
const body = Inter({ subsets: ["latin"], display: "swap", variable: "--lp-body" });

export const metadata: Metadata = {
  title: "Recov: tu plantel al día, sin un solo WhatsApp",
  description: "Lesiones, fecha de vuelta, cargas y disponibilidad de tu club amateur, en una sola pantalla.",
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <div className={`lp ${title.variable} ${body.variable}`}>{children}</div>;
}
