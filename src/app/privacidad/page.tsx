import type { Metadata } from "next";
import { LegalPage } from "@/app/legal-doc";
import { PRIVACY } from "@/lib/legal/content";

export const metadata: Metadata = { title: "Política de privacidad · Recov" };

export default function PrivacyPage() {
  return <LegalPage doc={PRIVACY} />;
}
