import "server-only";

import type { AIProvider, AIProviderKey } from "@/lib/ai/provider";
import { getConfiguredAIProvider } from "@/lib/ai/model-config";
import { GeminiProvider } from "@/lib/ai/providers/gemini-provider";
import { MockProvider } from "@/lib/ai/providers/mock-provider";
import { OpenAIProvider } from "@/lib/ai/providers/openai-provider";
import { CodexAppServerProvider } from "@/lib/ai/providers/codex-app-server-provider";

export type AIProviderSelection = {
  provider?: AIProviderKey;
  model?: string;
};

export function getAIProvider(selection: AIProviderSelection = {}): AIProvider {
  const provider = selection.provider ?? getConfiguredAIProvider();

  switch (provider) {
    case "openai":
      return new OpenAIProvider(selection.model);
    case "gemini":
      return new GeminiProvider(selection.model);
    case "codex-app-server":
      return new CodexAppServerProvider(selection.model);
    case "mock":
    default:
      return new MockProvider();
  }
}
