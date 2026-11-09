import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";

const title = Archivo({ subsets: ["latin"], weight: ["700", "800"], display: "swap", variable: "--l-title" });
const body = Inter({ subsets: ["latin"], display: "swap", variable: "--l-body" });

export const metadata: Metadata = {
  title: "Recov: lesiones y disponibilidad de tu club amateur",
  description: "Recov controla lesiones, fecha de vuelta y disponibilidad de tu club amateur en una sola pantalla.",
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${title.variable} ${body.variable} flex-1 bg-white font-[family-name:var(--l-body)] text-[#0B1B2B]`}
      style={{ fontStretch: "100%" }}
    >
      <style>{"html{scroll-behavior:smooth}"}</style>
      {children}
    </div>
  );
}
