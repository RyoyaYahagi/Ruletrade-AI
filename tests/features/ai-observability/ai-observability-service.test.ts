import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

describe("AI observability service", () => {
  const originalEnv = { ...process.env };
  const tempDirs: string[] = [];

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("returns only the requesting user's runs and experiment notes", async () => {
    const { service, db } = await loadService();

    await db.from("ai_run_logs").insert([
      {
        user_id: "user-a",
        task_type: "rule_review",
        provider: "mock",
        model: "mock-model",
        prompt_version: "rule-reviewer-v1",
        status: "succeeded",
        schema_valid: true,
        safety_passed: true,
        input_tokens: 10,
        output_tokens: 20,
        estimated_cost_usd: 0.01,
        latency_ms: 120,
        input_json: { answer: "private-a" },
        output_json: { result: "ok" },
        error_message: "provider details: sk-test-secret",
        started_at: "2026-07-18T01:00:00.000Z",
      },
      {
        user_id: "user-b",
        task_type: "holistic_review",
        provider: "mock",
        model: "mock-model",
        prompt_version: "holistic-review-v1",
        status: "failed",
        started_at: "2026-07-18T02:00:00.000Z",
      },
    ]);
    await db.from("ai_experiment_notes").insert([
      {
        user_id: "user-a",
        title: "Aの実験",
        hypothesis: "Aの仮説",
        change_summary: "Aの変更",
        tags_json: ["a"],
      },
      {
        user_id: "user-b",
        title: "Bの実験",
        hypothesis: "Bの仮説",
        change_summary: "Bの変更",
      },
    ]);

    const dashboard = await service.getAiDeveloperDashboard("user-a");

    expect(dashboard.runs).toHaveLength(1);
    expect(dashboard.runs[0]).toMatchObject({
      taskType: "rule_review",
      promptVersion: "rule-reviewer-v1",
      inputPreview: null,
      outputPreview: null,
      errorMessage: "provider details: [REDACTED]",
    });
    expect(dashboard.experiments).toHaveLength(1);
    expect(dashboard.experiments[0]).toMatchObject({
      title: "Aの実験",
      tags: ["a"],
    });
    expect(dashboard.summary).toMatchObject({
      runCount: 1,
      successRate: 100,
      totalCostUsd: 0.01,
      averageLatencyMs: 120,
      promptVersionCount: 1,
    });
  });

  it("redacts sensitive-looking experiment note values before saving", async () => {
    const { service, db } = await loadService();

    await service.createAiExperimentNote("user-a", {
      title: "API key handling",
      hypothesis: "Bearer secret-token should never persist",
      changeSummary: "Used sk-test-secret in a local experiment",
      result: "done",
      blockedOn: "",
      nextStep: "",
      status: "validated",
      promptVersion: "rule-reviewer-v1",
      provider: "mock",
      model: "mock-model",
      tags: ["security"],
    });

    const { data } = await db
      .from("ai_experiment_notes")
      .select("title, hypothesis, change_summary")
      .eq("user_id", "user-a");

    expect(data[0]).toEqual({
      title: "API key handling",
      hypothesis: "[REDACTED] should never persist",
      change_summary: "Used [REDACTED] in a local experiment",
    });
  });

  it("does not expose an AI output before the Safety Check passes", async () => {
    const { service, db } = await loadService();

    await db.from("privacy_settings").insert({
      user_id: "user-a",
      ai_memory_enabled: true,
      ai_logging_enabled: true,
      ai_payload_logging_enabled: true,
    });
    await db.from("ai_run_logs").insert({
      user_id: "user-a",
      task_type: "rule_review",
      status: "succeeded",
      safety_passed: false,
      input_json: { prompt: "visible for the opted-in developer" },
      output_json: { unsafe: "must stay hidden" },
      started_at: "2026-07-18T03:00:00.000Z",
    });

    const dashboard = await service.getAiDeveloperDashboard("user-a");

    expect(dashboard.runs[0]).toMatchObject({
      inputPreview: expect.stringContaining(
        "visible for the opted-in developer",
      ),
      outputPreview: null,
    });
  });

  async function loadService() {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "ruletrade-ai-observability-"),
    );
    tempDirs.push(tempDir);
    process.env.SQLITE_DATABASE_PATH = path.join(tempDir, "test.sqlite");
    process.env.NODE_ENV = "test";

    const service =
      await import("@/features/ai/services/ai-observability-service");
    const { createSqliteClient } = await import("@/lib/db/sqlite-client");
    return { service, db: createSqliteClient() };
  }
});
