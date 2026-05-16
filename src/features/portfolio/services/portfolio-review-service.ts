import "server-only";

import { createClient } from "@/lib/db/supabase-server";
import { getAIProvider } from "@/lib/ai/provider-factory";
import { PortfolioReviewSchema } from "@/schemas/portfolio/portfolio-review-schema";
import { buildPortfolioReviewPrompt } from "@/features/portfolio/prompts/portfolio-review-prompt";
import { calculatePortfolioSummary } from "@/features/portfolio/services/portfolio-aggregation-service";
import { withAiRunLogging } from "@/lib/ai/logs/with-ai-run-logging";
import { runSafetyCheck } from "@/lib/safety/safety-check-service";
import { AppError } from "@/lib/errors/app-error";
import { checkRateLimit } from "@/lib/rate-limit/check-rate-limit";
import { incrementRateLimit } from "@/lib/rate-limit/increment-rate-limit";
import { checkAiCostLimit } from "@/lib/cost-limit/check-ai-cost-limit";
import { incrementAiCostUsage } from "@/lib/cost-limit/increment-ai-cost-usage";
import type { AIMessage } from "@/lib/ai/provider";

export async function runPortfolioReview(params: {
  userId: string;
  requestId: string;
}) {
  const providerName = process.env.AI_PROVIDER ?? "mock";
  const model = process.env.AI_MODEL ?? "gpt-4o-mini";
  const promptVersion = "portfolio-reviewer-v1";

  // --- レート制限チェック ---
  await checkRateLimit({
    userId: params.userId,
    key: "portfolio_review_hourly",
  });
  await checkRateLimit({
    userId: params.userId,
    key: "portfolio_review_daily",
  });

  // --- コスト制限チェック ---
  await checkAiCostLimit({ userId: params.userId });

  const supabase = await createClient();

  // 1. メインポートフォリオを取得
  const { data: portfolio, error: portfolioError } = await supabase
    .from("portfolios")
    .select("id, name, base_currency, cash_amount, notes")
    .eq("user_id", params.userId)
    .order("created_at", { ascending: true })
    .maybeSingle();

  if (portfolioError) {
    throw new AppError(
      "INTERNAL_ERROR",
      "ポートフォリオの取得に失敗しました",
      500,
      portfolioError,
    );
  }

  if (!portfolio) {
    throw new AppError("NOT_FOUND", "ポートフォリオが見つかりません", 404);
  }

  // 2. 保有銘柄を取得
  const { data: positions, error: positionsError } = await supabase
    .from("portfolio_positions")
    .select(
      "id, ticker, company_name, market, sector, asset_type, market_value, target_weight_percent, rule_session_id, position_status",
    )
    .eq("user_id", params.userId)
    .eq("portfolio_id", portfolio.id)
    .eq("position_status", "active")
    .order("market_value", { ascending: false });

  if (positionsError) {
    throw new AppError(
      "INTERNAL_ERROR",
      "保有銘柄の取得に失敗しました",
      500,
      positionsError,
    );
  }

  // 3. サマリーを計算
  const summary = calculatePortfolioSummary({
    cashAmount: Number(portfolio.cash_amount),
    positions:
      positions?.map((p) => ({
        ticker: p.ticker,
        company_name: p.company_name ?? null,
        market_value: Number(p.market_value),
        sector: p.sector ?? null,
        theme: null,
        currency: null,
        rule_session_id: p.rule_session_id ?? null,
      })) ?? [],
  });

  const provider = getAIProvider();

  // 4. AIレビュー実行（withAiRunLoggingでラップ）
  const aiResult = await withAiRunLogging({
    userId: params.userId,
    requestId: params.requestId,
    taskType: "portfolio_review",
    sourceType: "portfolio",
    sourceId: portfolio.id,
    provider: providerName,
    model,
    promptVersion,
    inputJson: {
      portfolio: {
        name: portfolio.name,
        baseCurrency: portfolio.base_currency,
        cashAmount: Number(portfolio.cash_amount),
        notes: portfolio.notes,
      },
      positions,
      summary,
    },
    run: async () => {
      const startTime = Date.now();
      const prompt = buildPortfolioReviewPrompt({
        portfolio: {
          name: portfolio.name,
          baseCurrency: portfolio.base_currency,
          cashAmount: Number(portfolio.cash_amount),
          notes: portfolio.notes,
        },
        positions:
          positions?.map((p) => ({
            ticker: p.ticker,
            companyName: p.company_name ?? undefined,
            market: p.market ?? undefined,
            sector: p.sector ?? undefined,
            assetType: p.asset_type,
            marketValue: Number(p.market_value),
            targetWeightPercent: p.target_weight_percent
              ? Number(p.target_weight_percent)
              : undefined,
            ruleSessionId: p.rule_session_id ?? undefined,
          })) ?? [],
        summary,
      });

      const messages: AIMessage[] = [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ];

      const rawResult = await provider.generateObject({
        taskType: "portfolio_review",
        schema: PortfolioReviewSchema,
        schemaName: "PortfolioReview",
        messages,
        promptVersion,
      });

      const latencyMs = Date.now() - startTime;

      return {
        data: rawResult.data,
        meta: {
          provider: providerName,
          model,
          latencyMs,
          promptVersion,
        },
        usage: {
          inputTokens: rawResult.usage?.inputTokens,
          outputTokens: rawResult.usage?.outputTokens,
          estimatedCostUsd: rawResult.usage?.estimatedCostUsd,
        },
      };
    },
  });

  // 5. Safety Check
  const safetyText = [
    aiResult.data.summary,
    ...(aiResult.data.qualityChecks?.map((c) => c.reason) ?? []),
  ].join("\n");

  const safety = runSafetyCheck({ text: safetyText });

  const reviewWithSafety = {
    ...aiResult.data,
    safetyPassed: safety.passed,
    safetyViolations: safety.violations,
    safetyRiskLevel: safety.riskLevel,
    safetySuggestedRewrite: safety.suggestedRewrite,
  };

  // 6. レート制限カウンタをインクリメント
  await incrementRateLimit({
    userId: params.userId,
    key: "portfolio_review_hourly",
  });
  await incrementRateLimit({
    userId: params.userId,
    key: "portfolio_review_daily",
  });

  // 7. コストカウンタをインクリメント
  if (aiResult.estimatedCostUsd) {
    await incrementAiCostUsage({
      userId: params.userId,
      costUsd: aiResult.estimatedCostUsd,
    });
  }

  // 8. レビュー結果をDBに保存
  const { data: savedReview, error: saveError } = await supabase
    .from("portfolio_reviews")
    .insert({
      user_id: params.userId,
      portfolio_id: portfolio.id,
      provider: providerName,
      model,
      prompt_version: promptVersion,
      review_json: aiResult.data,
      summary: aiResult.data.summary,
      risk_score: aiResult.data.riskScore,
      diversification_score: aiResult.data.diversificationScore,
      rule_coverage_score: aiResult.data.ruleCoverageScore,
      needs_more_info: aiResult.data.needsMoreInfo ?? true,
      safety_passed: safety.passed,
      schema_valid: true,
      input_tokens: aiResult.usage?.inputTokens ?? null,
      output_tokens: aiResult.usage?.outputTokens ?? null,
      estimated_cost_usd: aiResult.estimatedCostUsd ?? null,
      latency_ms: aiResult.meta?.latencyMs ?? null,
    })
    .select("id")
    .single();

  if (saveError) {
    throw new AppError(
      "INTERNAL_ERROR",
      "レビュー結果の保存に失敗しました",
      500,
      saveError,
    );
  }

  // 9. クオリティチェック結果を保存
  if (aiResult.data.qualityChecks && aiResult.data.qualityChecks.length > 0) {
    const checks = aiResult.data.qualityChecks.map((check) => ({
      user_id: params.userId,
      portfolio_id: portfolio.id,
      review_id: savedReview.id,
      check_key: check.checkKey,
      label: check.label,
      status: check.status,
      severity: check.severity,
      reason: check.reason,
      related_tickers: check.relatedTickers ?? [],
      suggested_question: check.suggestedQuestion ?? null,
    }));

    const { error: checksError } = await supabase
      .from("portfolio_quality_checks")
      .insert(checks);

    if (checksError) {
      throw new AppError(
        "INTERNAL_ERROR",
        "クオリティチェック結果の保存に失敗しました",
        500,
        checksError,
      );
    }
  }

  return reviewWithSafety;
}
