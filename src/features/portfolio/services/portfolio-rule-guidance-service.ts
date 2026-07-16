import "server-only";

import { getAiDeveloperSettings } from "@/features/ai/services/ai-developer-settings-service";
import {
  buildPortfolioRuleGuidancePrompt,
  PORTFOLIO_RULE_GUIDANCE_PROMPT_VERSION,
} from "@/features/portfolio/prompts/portfolio-rule-guidance-prompt";
import { runComplianceGate } from "@/features/legal/services/compliance-gate-service";
import { loadPortfolioState } from "@/features/portfolio/services/portfolio-compliance-service";
import { calculatePortfolioAllocationSummary } from "@/features/portfolio/services/portfolio-aggregation-service";
import { buildDraftFromAnswers } from "@/features/portfolio/services/portfolio-rule-answer-mapping";
import { AppError } from "@/lib/errors/app-error";
import { callAi } from "@/lib/ai/provider-gateway";
import {
  PortfolioRuleGuidanceResponseSchema,
  type PortfolioRuleGuidanceRequest,
} from "@/schemas/portfolio/portfolio-rule-guidance-schema";

async function buildHoldingsSummaryText(userId: string): Promise<string> {
  const { cashAmount, positions } = await loadPortfolioState(userId);

  if (positions.length === 0 && cashAmount === 0) {
    return "保有資産はまだ登録されていません。";
  }

  const summary = calculatePortfolioAllocationSummary({
    cashAmount,
    positions,
  });

  if (summary.totalValue === 0) {
    return "保有資産はまだ登録されていません。";
  }

  const tickerCount = new Set(positions.map((position) => position.ticker))
    .size;
  const cashPercent =
    summary.totalValue === 0
      ? 0
      : Number(((cashAmount / summary.totalValue) * 100).toFixed(1));

  const lines: string[] = [
    `保有銘柄数: ${tickerCount}銘柄`,
    `現金比率: ${cashPercent}%`,
  ];

  if (summary.assetTypeAllocation.length > 0) {
    const assetTypeText = summary.assetTypeAllocation
      .map((slice) => `${slice.label} ${slice.percent}%`)
      .join("、");
    lines.push(`資産種類の内訳: ${assetTypeText}`);
  }

  if (summary.marketAllocation.length > 0) {
    const marketText = summary.marketAllocation
      .map((slice) => `${slice.label} ${slice.percent}%`)
      .join("、");
    lines.push(`市場の内訳: ${marketText}`);
  }

  return lines.join("\n");
}

export async function guidePortfolioCommonRule(params: {
  userId: string;
  requestId?: string;
  input: PortfolioRuleGuidanceRequest;
}) {
  const aiSettings = await getAiDeveloperSettings({ userId: params.userId });
  const { draft: decidedDraft, undecidedKeys } = buildDraftFromAnswers(
    params.input.answers,
  );
  const holdingsSummaryText = await buildHoldingsSummaryText(params.userId);

  const prompt = buildPortfolioRuleGuidancePrompt({
    answers: params.input.answers,
    decidedDraft,
    undecidedKeys,
    holdingsSummaryText,
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
      ...guidance.consistencyNotes,
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
