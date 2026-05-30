import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import { AppError } from "@/lib/errors/app-error";

export async function getOrCreateLegalAcceptance(params: { userId: string }) {
  const supabase = await createServerClient();

  const { data: existing } = await supabase
    .from("legal_acceptances")
    .select("*")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (existing) return { acceptance: existing };

  const { data, error } = await supabase
    .from("legal_acceptances")
    .insert({ user_id: params.userId })
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Failed to create legal acceptance.",
      500,
      error,
    );
  }

  return { acceptance: data };
}

export async function acceptLegalTerms(params: {
  userId: string;
  termsVersion?: string;
  privacyVersion?: string;
  disclaimerVersion?: string;
}) {
  const supabase = await createServerClient();

  const payload: Record<string, unknown> = { user_id: params.userId };
  if (params.termsVersion) {
    payload.accepted_terms_at = new Date().toISOString();
    payload.terms_version = params.termsVersion;
  }
  if (params.privacyVersion) {
    payload.accepted_privacy_at = new Date().toISOString();
    payload.privacy_version = params.privacyVersion;
  }
  if (params.disclaimerVersion) {
    payload.accepted_disclaimer_at = new Date().toISOString();
    payload.disclaimer_version = params.disclaimerVersion;
  }

  const { data, error } = await supabase
    .from("legal_acceptances")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Failed to update legal acceptance.",
      500,
      error,
    );
  }

  return { acceptance: data };
}
