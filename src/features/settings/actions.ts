"use server";

import type { AppSettings } from "@/schemas/app-settings";

import { getAppSettings, saveAppSettings } from "./settings";

export async function getAppSettingsAction(): Promise<AppSettings> {
  return getAppSettings();
}

export async function saveAppSettingsAction(
  input: unknown,
): Promise<AppSettings> {
  return saveAppSettings(input);
}
