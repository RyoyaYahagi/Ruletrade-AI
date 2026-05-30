import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import { AppError } from "@/lib/errors/app-error";

export async function getOrCreatePrivacySettings(params: { userId: string }) {
  const supabase = await createServerClient();

  const { data: existing } = await supabase
    .from("privacy_settings")
    .select("*")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (existing) {
    return { settings: existing };
  }

  const { data, error } = await supabase
    .from("privacy_settings")
    .insert({
      user_id: params.userId,
      ai_memory_enabled: true,
      ai_logging_enabled: true,
      ai_payload_logging_enabled: false,
      allow_rag_indexing: true,
      allow_document_indexing: true,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Failed to create privacy settings.",
      500,
      error,
    );
  }

  return { settings: data };
}

export async function updatePrivacySettings(params: {
  userId: string;
  aiMemoryEnabled?: boolean;
  aiLoggingEnabled?: boolean;
  aiPayloadLoggingEnabled?: boolean;
  allowRagIndexing?: boolean;
  allowDocumentIndexing?: boolean;
  dataRetentionDays?: number | null;
}) {
  const supabase = await createServerClient();

  const payload: Record<string, unknown> = { user_id: params.userId };

  if (params.aiMemoryEnabled !== undefined)
    payload.ai_memory_enabled = params.aiMemoryEnabled;
  if (params.aiLoggingEnabled !== undefined)
    payload.ai_logging_enabled = params.aiLoggingEnabled;
  if (params.aiPayloadLoggingEnabled !== undefined)
    payload.ai_payload_logging_enabled = params.aiPayloadLoggingEnabled;
  if (params.allowRagIndexing !== undefined)
    payload.allow_rag_indexing = params.allowRagIndexing;
  if (params.allowDocumentIndexing !== undefined)
    payload.allow_document_indexing = params.allowDocumentIndexing;
  if (params.dataRetentionDays !== undefined)
    payload.data_retention_days = params.dataRetentionDays;

  const { data, error } = await supabase
    .from("privacy_settings")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Failed to update privacy settings.",
      500,
      error,
    );
  }

  return { settings: data };
}
