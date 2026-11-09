import { redirect } from "next/navigation";
import { getProfile, getSessionUser } from "@/lib/session";
import { pendingLegal } from "@/lib/legal/gate";
import { LegalScreen } from "@/app/legal-consent";

export default async function AcceptTermsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const profile = await getProfile(user.id);
  if (!profile || pendingLegal(profile) !== "terms") redirect("/dashboard");
  return <LegalScreen kind="terms" next="/dashboard" />;
}
