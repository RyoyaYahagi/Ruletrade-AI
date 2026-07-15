import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { createDatabaseClient } from "@/lib/db/database-client";
import { getOrCreateUiPreferences } from "@/features/ux/services/ui-preferences-service";
import {
  getConfiguredAIProvider,
  getCodexAppServerModel,
  getGeminiModel,
  getOpenAIModel,
} from "@/lib/ai/model-config";
import type { AIProviderKey } from "@/lib/ai/provider";
import type { AiDeveloperSettingsInput } from "@/schemas/ai/ai-developer-settings-schema";

export type AiDeveloperSettings = AiDeveloperSettingsInput;

export type AiDeveloperProviderOption = {
  key: AIProviderKey;
  label: string;
  models: string[];
};

const PROVIDER_LABELS: Record<AIProviderKey, string> = {
  mock: "Mock",
  openai: "OpenAI API",
  gemini: "Gemini API",
  "codex-app-server": "Codex App Server (ChatGPT)",
};

export function isAiDeveloperSettingsEnabled() {
  return (
    process.env.NODE_ENV !== "production" ||
    (process.env.E2E_TEST_AUTH === "true" && process.env.CI === "true")
  );
}

export function assertAiDeveloperSettingsEnabled() {
  if (isAiDeveloperSettingsEnabled()) return;

  throw new AppError(
    "NOT_FOUND",
    "開発者向けAI設定は開発環境でのみ利用できます。",
    404,
  );
}

export function getDefaultAiModel(provider: AIProviderKey): string {
  switch (provider) {
    case "openai":
      return getOpenAIModel();
    case "gemini":
      return getGeminiModel();
    case "codex-app-server":
      return getCodexAppServerModel();
    case "mock":
    default:
      return "mock-model";
  }
}

export function getAiDeveloperProviderOptions(): AiDeveloperProviderOption[] {
  const options: Array<{ key: AIProviderKey; models: string[] }> = [
    { key: "mock", models: ["mock-model"] },
    {
      key: "openai",
      models: ["gpt-4.1-mini", "gpt-4.1", getOpenAIModel()],
    },
    {
      key: "gemini",
      models: ["gemini-2.5-flash", "gemini-2.5-pro", getGeminiModel()],
    },
    {
      key: "codex-app-server",
      models: ["gpt-5.4-mini", "gpt-5.4", getCodexAppServerModel()],
    },
  ];

  return options.map((option) => ({
    key: option.key,
    label: PROVIDER_LABELS[option.key],
    models: [...new Set(option.models)],
  }));
}

function isAiProvider(value: unknown): value is AIProviderKey {
  return (
    value === "mock" ||
    value === "openai" ||
    value === "gemini" ||
    value === "codex-app-server"
  );
}

export async function getAiDeveloperSettings(params: {
  userId: string;
}): Promise<AiDeveloperSettings> {
  if (!isAiDeveloperSettingsEnabled()) {
    const provider = getConfiguredAIProvider();
    return { provider, model: getDefaultAiModel(provider) };
  }

  const db = await createDatabaseClient();
  const { data: preferences, error } = await db
    .from("user_ui_preferences")
    .select("ai_provider, ai_model")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) throw error;

  const provider = isAiProvider(preferences?.ai_provider)
    ? preferences.ai_provider
    : getConfiguredAIProvider();
  const storedModel = preferences?.ai_model;

  return {
    provider,
    model:
      typeof storedModel === "string" && storedModel.trim().length > 0
        ? storedModel
        : getDefaultAiModel(provider),
  };
}

export async function updateAiDeveloperSettings(params: {
  userId: string;
  settings: AiDeveloperSettingsInput;
}): Promise<AiDeveloperSettings> {
  assertAiDeveloperSettingsEnabled();

  await getOrCreateUiPreferences({ userId: params.userId });
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("user_ui_preferences")
    .update({
      ai_provider: params.settings.provider,
      ai_model: params.settings.model,
    })
    .eq("user_id", params.userId)
    .select("ai_provider, ai_model")
    .single();

  if (error || !data) throw error;

  return {
    provider: params.settings.provider,
    model:
      typeof data.ai_model === "string" ? data.ai_model : params.settings.model,
  };
}
