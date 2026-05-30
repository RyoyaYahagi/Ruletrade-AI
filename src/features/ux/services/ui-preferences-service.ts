import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";

export async function getOrCreateUiPreferences(params: { userId: string }) {
  const supabase = await createServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("user_ui_preferences")
    .select("*")
    .eq("user_id", params.userId)
    .single();

  if (existingError && !["PGRST116", "SQLITE_NO_ROWS"].includes(existingError.code)) {
    throw existingError;
  }

  if (existing) {
    return { preferences: existing };
  }

  const { data, error } = await supabase
    .from("user_ui_preferences")
    .insert({
      user_id: params.userId,
      locale: "ja",
      timezone: "Asia/Tokyo",
      color_scheme: "system",
      reduced_motion: false,
      high_contrast: false,
      larger_text: false,
      compact_mode: false,
      show_advanced_fields: false,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw error;
  }

  return { preferences: data };
}

export async function updateUiPreferences(params: {
  userId: string;
  locale?: "ja" | "en";
  timezone?: string;
  colorScheme?: "system" | "light" | "dark";
  reducedMotion?: boolean;
  highContrast?: boolean;
  largerText?: boolean;
  compactMode?: boolean;
  showAdvancedFields?: boolean;
}) {
  const supabase = await createServerClient();

  const payload: Record<string, unknown> = {};
  if (params.locale !== undefined) payload.locale = params.locale;
  if (params.timezone !== undefined) payload.timezone = params.timezone;
  if (params.colorScheme !== undefined)
    payload.color_scheme = params.colorScheme;
  if (params.reducedMotion !== undefined)
    payload.reduced_motion = params.reducedMotion;
  if (params.highContrast !== undefined)
    payload.high_contrast = params.highContrast;
  if (params.largerText !== undefined) payload.larger_text = params.largerText;
  if (params.compactMode !== undefined)
    payload.compact_mode = params.compactMode;
  if (params.showAdvancedFields !== undefined)
    payload.show_advanced_fields = params.showAdvancedFields;

  const { data, error } = await supabase
    .from("user_ui_preferences")
    .upsert({ user_id: params.userId, ...payload }, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error || !data) {
    throw error;
  }

  return { preferences: data };
}
