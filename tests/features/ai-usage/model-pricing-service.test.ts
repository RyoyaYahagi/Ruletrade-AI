import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

describe("model pricing service", () => {
  const originalEnv = { ...process.env };
  const tempDirs: string[] = [];

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("deactivates the previous price and uses the new price for estimates", async () => {
    const { pricingService, estimateAiCostUsd, db } = await loadServices();

    await pricingService.addModelPricing({
      provider: "openai",
      model: "gpt-test",
      inputCostPer1mTokensUsd: 1,
      outputCostPer1mTokensUsd: 2,
      effectiveFrom: "2026-07-01T00:00:00.000Z",
    });
    await pricingService.addModelPricing({
      provider: "openai",
      model: "gpt-test",
      inputCostPer1mTokensUsd: 3,
      outputCostPer1mTokensUsd: 4,
      effectiveFrom: "2026-07-16T00:00:00.000Z",
    });

    const rows = await db
      .from("model_pricing_configs")
      .select(
        "is_active, input_cost_per_1m_tokens_usd, output_cost_per_1m_tokens_usd",
      )
      .eq("provider", "openai")
      .eq("model", "gpt-test");
    const estimate = await estimateAiCostUsd({
      provider: "openai",
      model: "gpt-test",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });

    expect(rows.data).toHaveLength(2);
    expect(rows.data.filter((row) => row.is_active)).toHaveLength(1);
    expect(estimate).toBe(7);
  });

  async function loadServices() {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "ruletrade-model-pricing-"),
    );
    tempDirs.push(tempDir);
    process.env.SQLITE_DATABASE_PATH = path.join(tempDir, "test.sqlite");

    const pricingService =
      await import("@/features/ai/services/model-pricing-service");
    const { estimateAiCostUsd } = await import("@/lib/ai/usage/estimate-cost");
    const { createSqliteClient } = await import("@/lib/db/sqlite-client");
    return { pricingService, estimateAiCostUsd, db: createSqliteClient() };
  }
});
