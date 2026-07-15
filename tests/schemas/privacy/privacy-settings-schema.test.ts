import { describe, expect, it } from "vitest";
import { PrivacySettingsSchema } from "@/schemas/privacy/privacy-settings-schema";

describe("PrivacySettingsSchema", () => {
  it("parses valid settings", () => {
    const result = PrivacySettingsSchema.safeParse({
      aiMemoryEnabled: true,
      aiLoggingEnabled: true,
      aiPayloadLoggingEnabled: false,
      allowRagIndexing: true,
      allowDocumentIndexing: true,
    });
    expect(result.success).toBe(true);
  });

  it("applies defaults", () => {
    const result = PrivacySettingsSchema.parse({});
    expect(result.aiMemoryEnabled).toBe(true);
    expect(result.allowRagIndexing).toBe(true);
  });

  it("rejects negative dataRetentionDays", () => {
    const result = PrivacySettingsSchema.safeParse({
      dataRetentionDays: -1,
    });
    expect(result.success).toBe(false);
  });
});
