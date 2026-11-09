import type { Metadata } from "next";
import { LegalPage } from "@/app/legal-doc";
import { TERMS } from "@/lib/legal/content";

export const metadata: Metadata = { title: "Términos de uso · Recov" };

export default function TermsPage() {
  return <LegalPage doc={TERMS} />;
}
