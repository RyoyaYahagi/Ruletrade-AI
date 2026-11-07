import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import {
  AppSettingsInputSchema,
  AppSettingsSchema,
  type AppSettings,
} from "@/schemas/app-settings";

const DEFAULT_ID = "default";

export function getAppSettings(): AppSettings {
  const row = getDb()
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, DEFAULT_ID))
    .get();
  if (!row) {
    throw new Error("App settings row is missing");
  }
  return AppSettingsSchema.parse(row);
}

export function saveAppSettings(input: unknown): AppSettings {
  const parsed = AppSettingsInputSchema.parse(input);
  const updatedAt = new Date().toISOString();
  return getDb().transaction((tx) => {
    const updated = tx
      .update(appSettings)
      .set({
        satelliteCapPct: parsed.satelliteCapPct,
        satelliteWarnPct: parsed.satelliteWarnPct,
        updatedAt,
      })
      .where(eq(appSettings.id, DEFAULT_ID))
      .returning()
      .get();
    if (!updated) throw new Error("App settings row is missing");
    return AppSettingsSchema.parse(updated);
  });
}
