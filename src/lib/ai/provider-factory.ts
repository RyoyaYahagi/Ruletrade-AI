import "server-only";

import type { AIProvider } from "@/lib/ai/provider";
import { getConfiguredAIProvider } from "@/lib/ai/model-config";
import { CodexProvider } from "@/lib/ai/providers/codex-provider";
import { CodexAppServerProvider } from "@/lib/ai/providers/codex-app-server-provider";
import { GeminiProvider } from "@/lib/ai/providers/gemini-provider";
import { MockProvider } from "@/lib/ai/providers/mock-provider";
import { OpenAIProvider } from "@/lib/ai/providers/openai-provider";

export function getAIProvider(): AIProvider {
  const provider = getConfiguredAIProvider();

  switch (provider) {
    case "openai":
      return new OpenAIProvider();
    case "gemini":
      return new GeminiProvider();
    case "codex":
      return new CodexProvider();
    case "codex-app-server":
      return new CodexAppServerProvider();
    case "mock":
    default:
      return new MockProvider();
  }
}
