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
        message:
          "最初に、数値を決める前にポートフォリオの目的を整理します。目的が明確になると、許容する偏りや現金の置き方を考えやすくなります。",
        question: {
          key: "purpose",
          text: "このポートフォリオは、主にどのような目的で使いますか？",
          explanation:
            "生活費に近い資金か、長期的に使う予定のない資金かで、考えるべきルールが変わります。",
        },
        suggestion: {},
        progress: 10,
        readyToReview: false,
        guidance: ["目的", "使う予定のある時期", "現金が必要になる可能性"],
        disclaimer,
      };
    }

    if (turn === 1) {
      return {
        message:
          "次は、1つの銘柄に偏ることをどの程度まで許容するかを考えます。上限を設けると、1銘柄の影響が大きくなりすぎたときに見直すきっかけになります。",
        question: {
          key: "concentration",
          text: "1銘柄への偏りについて、どの考え方が近いですか？",
          explanation:
            "上限を低くすると偏りは抑えやすくなりますが、管理対象は増えます。",
        },
        suggestion: { maxPositionPercent: 10 },
        progress: 35,
        readyToReview: false,
        guidance: ["1銘柄の最大比率を決める", "セクターの偏りは後で考える"],
        disclaimer,
      };
    }

    if (turn === 2) {
      return {
        message:
          "次に、資産全体に対して1回の取引で許容できる影響と、手元に残したい現金を整理します。どちらも未設定のままでも構いません。",
        question: {
          key: "cash_and_loss",
          text: "急な支出や追加投資に備えて、現金と1回の損失上限をどう考えますか？",
          explanation:
            "必要な現金を先に確保し、1回の判断が資産全体に与える影響を小さくする考え方です。",
        },
        suggestion: {
          maxPositionPercent: 10,
          minCashPercent: 10,
          maxSingleTradeLossPercent: 1,
        },
        progress: 65,
        readyToReview: false,
        guidance: ["現金比率の下限", "1取引あたりの許容損失", "未設定でもよい項目"],
        disclaimer,
      };
    }

    return {
      message:
        "ここまでの回答から、フォームに反映して確認できる参考候補をまとめました。数値は固定の正解ではないため、必ず自分の考えに合わせて編集してください。",
      question: null,
      suggestion: {
        maxPositionPercent: 10,
        maxSectorPercent: 30,
        minCashPercent: 10,
        maxSingleTradeLossPercent: 1,
        targetAllocations: [
          { key: "stock", targetPercent: 80, tolerancePercent: 5 },
          { key: "cash", targetPercent: 20, tolerancePercent: 5 },
        ],
      },
      progress: 100,
      readyToReview: true,
      guidance: [
        "候補をフォームへ反映する",
        "不要な項目は未設定に戻す",
        "最後に本人の言葉でメモを残す",
      ],
      disclaimer,
    };
  }

  return {};
}
