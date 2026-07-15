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
    const mockData = getMockObject(
      params.taskType,
      params.schemaName,
      params.messages,
    );
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

function getMockObject(
  taskType: string,
  schemaName: string,
  messages: GenerateObjectParams<z.ZodType>['messages'],
): unknown {
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
    const prompt = messages.map((message) => message.content).join("\n");
    const turn = Number(prompt.match(/現在のターン:\s*(\d+)/)?.[1] ?? 0);
    const disclaimer =
      "これは投資助言ではなく、本人のルール作成を支援するための整理です。";

    if (turn === 0) {
      return {
        message: "まずは損失への向き合い方を整理します。",
        question: {
          key: "risk_tolerance",
          text: "資産全体が下がっても、どの程度なら慌てず持ち続けられそうですか？",
          explanation: "例えば100万円が90万円になっても続けられるか、のように考えます。",
        },
        suggestions: [],
        progress: 0,
        readyToReview: false,
        guidance: ["損失への許容度"],
        disclaimer,
      };
    }

    if (turn === 1) {
      return {
        message: "次に、使う予定の時期を確認します。",
        question: {
          key: "investment_horizon",
          text: "この資金を使う予定は、いつ頃ありますか？",
          explanation: "使う時期までに値下がりしても、待てる期間があるかを考えます。",
        },
        suggestions: [],
        progress: 35,
        readyToReview: false,
        guidance: ["投資期間", "資金を使う時期"],
        disclaimer,
      };
    }

    if (turn === 2) {
      return {
        message: "最後に、値動きへの向き合い方を確認します。",
        question: {
          key: "volatility_tolerance",
          text: "値下がりしても、前提が変わらなければ持ち続けられそうですか？",
          explanation: "例えば大きく下がった日に、慌ててルールを変えずにいられるかを考えます。",
        },
        suggestions: [],
        progress: 65,
        readyToReview: false,
        guidance: ["値動きの大きさ", "現金比率", "1回あたりの許容損失"],
        disclaimer,
      };
    }

    return {
      message: "回答した条件から、比較用の参考案を3つ作りました。",
      question: null,
      suggestions: [
        {
          key: "conservative",
          title: "慎重寄り",
          summary: "現金を厚めに残し、1回あたりの損失を小さくする案です。",
          tradeoff: "守りやすい一方、値上がり局面への参加は抑えめです。",
          draft: {
            maxPositionPercent: 8,
            maxSectorPercent: 25,
            minCashPercent: 20,
            maxSingleTradeLossPercent: 0.5,
          },
        },
        {
          key: "balanced",
          title: "中間の案",
          summary: "現金と投資のバランスを取り、管理しやすくする案です。",
          tradeoff: "極端な偏りは抑えますが、両方の妥協が必要です。",
          draft: {
            maxPositionPercent: 12,
            maxSectorPercent: 35,
            minCashPercent: 10,
            maxSingleTradeLossPercent: 1,
          },
        },
        {
          key: "flexible",
          title: "変動許容寄り",
          summary: "値動きと長い投資期間を前提に、投資比率を高めにする案です。",
          tradeoff: "待てる期間と大きな含み損への備えが必要です。",
          draft: {
            maxPositionPercent: 18,
            maxSectorPercent: 45,
            minCashPercent: 5,
            maxSingleTradeLossPercent: 2,
          },
        },
      ],
      progress: 100,
      readyToReview: true,
      guidance: [
        "3案から選ぶ",
        "フォームで数値を編集する",
        "未設定の項目は残してよい",
      ],
      disclaimer,
    };
  }

  return {};
}
