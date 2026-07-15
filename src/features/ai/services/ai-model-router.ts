import "server-only";

import type { AIAgentName, AITaskType } from "@/features/ai/config/ai-task-types";
import type { AIModelConfig } from "@/features/ai/config/ai-model-config";
import { DEFAULT_AI_MODEL_CONFIGS } from "@/features/ai/config/ai-model-config";

/**
 * Resolve an AI model configuration for a given task type and optional agent name.
 * 
 * 1. Looks for an exact match on (taskType + agentName).
 * 2. Falls back to any config matching taskType alone.
 * 3. Throws if no config is found or the config is disabled.
 * 4. Applies AI_PROVIDER environment variable override if set.
 */
export function resolveAIModelConfig(
  taskType: AITaskType,
  agentName?: AIAgentName,
): AIModelConfig {
  // 1. agentName + taskType で完全一致 (iterate to find agentName match)
  let config: AIModelConfig | undefined;

  if (agentName) {
    config = Object.values(DEFAULT_AI_MODEL_CONFIGS).find(
      (c) => c.taskType === taskType && c.agentName === agentName,
    );
  }

  // 2. agentName 無しの taskType 一致
  if (!config) {
    config = DEFAULT_AI_MODEL_CONFIGS[taskType];
  }

  if (!config) {
    throw new Error(`No AIModelConfig found for taskType: ${taskType}`);
  }

  if (!config.enabled) {
    throw new Error(`AIModelConfig is disabled for taskType: ${taskType}`);
  }

  // 3. 環境変数による provider override
  const providerOverride = process.env.AI_PROVIDER as
    | "openai"
    | "gemini"
    | "mock"
    | "codex-app-server"
    | undefined;

  if (
    providerOverride &&
    (providerOverride === "openai" ||
      providerOverride === "gemini" ||
      providerOverride === "mock" ||
      providerOverride === "codex-app-server")
  ) {
    return {
      ...config,
      provider: providerOverride,
      fallbackProvider:
        config.fallbackProvider === providerOverride
          ? undefined
          : config.fallbackProvider,
    };
  }

  return config;
}

/**
 * Get the model configuration for a specific task type.
 * This is a direct lookup from the default configs.
 */
export function getModelConfigForTask(taskType: AITaskType): AIModelConfig {
  const config = DEFAULT_AI_MODEL_CONFIGS[taskType];

  if (!config) {
    throw new Error(`No AIModelConfig found for taskType: ${taskType}`);
  }

  if (!config.enabled) {
    throw new Error(`AIModelConfig is disabled for taskType: ${taskType}`);
  }

  return config;
}

/**
 * Get a fallback configuration for the given config.
 * Returns null if no fallback is available.
 */
export function getFallbackConfig(
  config: AIModelConfig,
): AIModelConfig | null {
  // No fallback if the config itself is already a fallback or no fallback provider defined
  if (!config.fallbackProvider && !config.fallbackModel) {
    return null;
  }

  return {
    ...config,
    provider: config.fallbackProvider ?? config.provider,
    model: config.fallbackModel ?? config.model,
    fallbackProvider: undefined,
    fallbackModel: undefined,
    timeoutMs: Math.min(config.timeoutMs * 1.5, 120_000), // Allow extra time for fallback
  };
}
