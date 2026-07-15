import "server-only";

import { getAiDeveloperSettings } from "@/features/ai/services/ai-developer-settings-service";
import {
  buildPortfolioRuleGuidancePrompt,
  PORTFOLIO_RULE_GUIDANCE_PROMPT_VERSION,
} from "@/features/portfolio/prompts/portfolio-rule-guidance-prompt";
import { runComplianceGate } from "@/features/legal/services/compliance-gate-service";
import { AppError } from "@/lib/errors/app-error";
import { callAi } from "@/lib/ai/provider-gateway";
import {
  PortfolioRuleGuidanceResponseSchema,
  type PortfolioRuleGuidanceRequest,
} from "@/schemas/portfolio/portfolio-rule-guidance-schema";

export async function guidePortfolioCommonRule(params: {
  userId: string;
  requestId?: string;
  input: PortfolioRuleGuidanceRequest;
}) {
  const aiSettings = await getAiDeveloperSettings({ userId: params.userId });
  const prompt = buildPortfolioRuleGuidancePrompt({
    history: params.input.history,
    draft: params.input.draft,
  });

  const aiResult = await callAi({
    provider: aiSettings.provider,
    model: aiSettings.model,
    weight: "standard",
    system: prompt.system,
    prompt: prompt.user,
    outputSchema: PortfolioRuleGuidanceResponseSchema,
    taskType: "portfolio_rule_guidance",
    agentName: "portfolio_rule_guidance_agent",
    promptVersion: PORTFOLIO_RULE_GUIDANCE_PROMPT_VERSION,
    schemaName: "PortfolioRuleGuidance",
    userId: params.userId,
    requestId: params.requestId,
    sourceType: "portfolio",
    sourceId: "portfolio-rule-guidance",
    inputJson: params.input,
  });

  if (!aiResult.ok) {
    throw new AppError(
      "AI_PROVIDER_ERROR",
      "AIガイドを取得できませんでした。しばらくしてからもう一度お試しください。",
      502,
      { providerError: aiResult.error },
      true,
    );
  }

  const guidance = aiResult.data;
  const compliance = await runComplianceGate({
    userId: params.userId,
    reviewType: "portfolio_rule_guidance",
    text: [
      guidance.message,
      guidance.question?.text,
      guidance.question?.explanation,
      ...guidance.guidance,
      guidance.disclaimer,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  if (!compliance.passed) {
    throw new AppError(
      "SAFETY_FAILED",
      "AIガイドの内容を安全性・コンプライアンス上の理由で表示できません。",
      422,
      { compliance },
      false,
    );
  }

  return guidance;
}
