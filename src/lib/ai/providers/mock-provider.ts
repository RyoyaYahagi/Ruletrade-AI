import "server-only";

import type { z } from "zod";
import { AIProviderError } from "@/lib/ai/ai-provider-error";
import type {
  AIProvider,
  GenerateObjectParams,
  GenerateObjectResult,
  GenerateTextParams,
  GenerateTextResult,
} from "@/lib/ai/provider";
import { zeroAIUsage } from "@/lib/ai/usage/token-usage";

const mockModel = "mock-model";

export class MockProvider implements AIProvider {
  async generateObject<TSchema extends z.ZodType>(
    params: GenerateObjectParams<TSchema>,
  ): Promise<GenerateObjectResult<z.infer<TSchema>>> {
    const startedAt = Date.now();
    const mockData = getMockObject(params.taskType, params.schemaName);
    const parsed = params.schema.safeParse(mockData);

    if (!parsed.success) {
      throw new AIProviderError(
        "AI_OUTPUT_SCHEMA_INVALID",
        "Mock output does not match schema.",
        parsed.error.flatten(),
        false,
      );
    }

    return {
      data: parsed.data,
      rawText: JSON.stringify(mockData),
      usage: zeroAIUsage,
      meta: {
        provider: "mock",
        model: mockModel,
        taskType: params.taskType,
        agentName: params.agentName,
        promptVersion: params.promptVersion,
        fallbackUsed: false,
        latencyMs: Date.now() - startedAt,
      },
    };
  }

  async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
    const startedAt = Date.now();

    return {
      text: "これはMock Providerによる応答です。",
      usage: zeroAIUsage,
      meta: {
        provider: "mock",
        model: mockModel,
        taskType: params.taskType,
        agentName: params.agentName,
        promptVersion: params.promptVersion,
        fallbackUsed: false,
        latencyMs: Date.now() - startedAt,
      },
    };
  }
}

function getMockObject(taskType: string, schemaName: string): unknown {
  if (schemaName === "NewsClassification") {
    return {
      relevance: "affects_thesis",
      thesisRelation: "unclear",
      matchedBreakerIndex: null,
      reason: "記事の内容が仮説に関係する可能性があります。",
    };
  }

  if (schemaName === "NewsSummary") {
    return {
      summary: "記事の要旨と仮説への関係を確認してください。\n追加の事実は記事本文に基づきません。",
    };
  }

  if (schemaName === "RuleReview" || taskType === "rule_review") {
    return {
      summary:
        "損切り条件と最大投資比率がまだ曖昧です。買う前にリスク管理の条件を具体化しましょう。",
      completionScore: 72,
      needsMoreInfo: true,
      canFinalize: false,
      qualityChecks: [
        {
          checkKey: "stop_loss_defined",
          label: "損切り条件",
          status: "fail",
          severity: "high",
          reason: "損切り条件がまだ明確ではありません。",
          suggestedQuestion: "投資仮説が崩れたと判断する条件は何ですか？",
        },
        {
          checkKey: "max_position_defined",
          label: "最大投資比率",
          status: "warning",
          severity: "medium",
          reason: "最大投資比率が未設定です。",
          suggestedQuestion:
            "この銘柄はポートフォリオ全体の何％までにしますか？",
        },
      ],
      nextQuestions: [
        {
          questionKey: "stop_loss_rule",
          questionText: "想定と違った場合、どの条件で撤退または見直しますか？",
          questionType: "free_text",
          priority: 5,
          isRequired: true,
          mapsToRuleField: "riskManagement.stopLossRule",
          source: "ai",
          status: "pending",
          displayOrder: 1,
        },
      ],
      suggestedRuleUpdates: [],
      safety: {
        passed: true,
        riskLevel: "low",
        violations: [],
        prohibitedPhrasesDetected: [],
        suggestedRewrite: undefined,
      },
    };
  }

  if (taskType === "safety_check") {
    return {
      passed: true,
      riskLevel: "low",
      violations: [],
      prohibitedPhrasesDetected: [],
    };
  }

  if (schemaName === "PortfolioRuleGuidance" || taskType === "portfolio_rule_guidance") {
    return {
      message: "回答を確認し、未定の項目について目安をまとめました。",
      question: null,
      suggestions: [
        {
          key: "conservative",
          title: "慎重寄り",
          summary: "現金をやや厚めに残す案です。",
          tradeoff: "守りやすい一方、値上がり局面への参加は抑えめです。",
          draft: {
            minCashPercent: 20,
          },
        },
        {
          key: "balanced",
          title: "中間の案",
          summary: "現金と投資のバランスを取る案です。",
          tradeoff: "極端な偏りは抑えますが、両方の妥協が必要です。",
          draft: {
            minCashPercent: 10,
          },
        },
      ],
      consistencyNotes: [
        "資産全体が下がると不安になると回答した一方、1回あたりの許容損失はやや大きめです。バランスを見直してもよいかもしれません。",
      ],
      progress: 100,
      readyToReview: true,
      guidance: [
        "確定した項目はそのまま活かす",
        "未定の項目だけ目安を参考にする",
        "違和感があれば数値を編集する",
      ],
      disclaimer:
        "これは投資助言ではなく、本人のルール作成を支援するための整理です。",
    };
  }

  return {};
}
