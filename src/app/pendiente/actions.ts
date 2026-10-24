"use server";

import { redirect } from "next/navigation";
import { getSessionUser, getSupabase } from "@/lib/session";
import { sendVerificationEmail } from "@/lib/verification";

// Reenvía "Verifica tu correo" a la cuenta de la sesión actual (y solo a ella).
export async function resendVerification() {
  const user = await getSessionUser();
  if (!user?.email) redirect("/login");

  const supabase = await getSupabase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, status, email_verified_at")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.status !== "pendiente" || profile.email_verified_at) redirect("/pendiente");

  const result = await sendVerificationEmail({
    profileId: user.id,
    email: user.email,
    fullName: (profile.full_name as string | null) ?? null,
  });
  redirect(`/pendiente?verificacion=${result}`);
}
