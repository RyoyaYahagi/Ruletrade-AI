import "server-only";

import { getOrCreatePrivacySettings } from "@/features/privacy/services/privacy-settings-service";

export async function isAiPayloadLoggingEnabled(userId: string) {
  const { settings } = await getOrCreatePrivacySettings({ userId });
  const value = settings.ai_payload_logging_enabled;
  return value === true || value === 1 || value === "1" || value === "true";
}
