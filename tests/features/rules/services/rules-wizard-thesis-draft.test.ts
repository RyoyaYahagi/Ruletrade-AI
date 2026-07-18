import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type DatabaseClient = import("@/lib/db/database-client").DatabaseClient;

describe("generateThesisDraft", () => {
  const originalDatabasePath = process.env.SQLITE_DATABASE_PATH;
  let tempDir: string;
  let db: DatabaseClient;
  let generateThesisDraft: typeof import("@/features/rules/services/thesis-draft-service").generateThesisDraft;
  let callAi: typeof import("@/lib/ai/provider-gateway").callAi;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ruletrade-thesis-"));
    process.env.SQLITE_DATABASE_PATH = path.join(tempDir, "test.sqlite");
    vi.resetModules();
    vi.doMock("@/lib/ai/provider-gateway", () => ({ callAi: vi.fn() }));
    const databaseModule = await import("@/lib/db/database-client");
    const serviceModule = await import("@/features/rules/services/thesis-draft-service");
    const aiModule = await import("@/lib/ai/provider-gateway");
    db = await databaseModule.createDatabaseClient();
    generateThesisDraft = serviceModule.generateThesisDraft;
    callAi = aiModule.callAi;
    await db.from("rule_design_sessions").insert({
      id: "session-a",
      user_id: "user-a",
      ticker: "7203",
      company_name: "A社",
      status: "in_progress",
      rule_json: {},
    });
    await db.from("rule_questions").insert({
      user_id: "user-a",
      session_id: "session-a",
      question_key: "thesis_breakers_pick",
      question_text: "見立てが外れた条件は？",
      question_type: "multiple_choice",
      status: "pending",
      display_order: 5,
    });
    await db.from("news_items").insert({
      id: "news-1",
      source: "test",
      external_id: "news-1",
      title: "A社の事業成長に関する発表資料",
      summary: "事業の成長と受注の拡大を確認する。",
      url: "https://example.com/news-1",
      published_at: "2026-07-18T00:00:00.000Z",
      content_hash: "hash-news-1",
    });
    await db.from("news_ticker_matches").insert({
      id: "match-1",
      news_item_id: "news-1",
      symbol: "7203",
      market: "JP",
      match_method: "ticker_code",
    });
  });

  afterEach(() => {
    process.env.SQLITE_DATABASE_PATH = originalDatabasePath;
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.doUnmock("@/lib/ai/provider-gateway");
    vi.resetModules();
  });

  it("returns an error when the AI output cannot be parsed", async () => {
    vi.mocked(callAi).mockResolvedValue({
      ok: false,
      error: "invalid structured output",
      code: "AI_OUTPUT_SCHEMA_INVALID",
    });

    await expect(
      generateThesisDraft({ userId: "user-a", sessionId: "session-a" }),
    ).rejects.toMatchObject({ code: "AI_OUTPUT_INVALID", status: 422 });
  });

  it("returns a timeout error separately from invalid structured output", async () => {
    vi.mocked(callAi).mockResolvedValue({
      ok: false,
      error: "AI provider call failed: AI_PROVIDER_TIMEOUT: timed out",
      code: "AI_PROVIDER_TIMEOUT",
      retryable: true,
    });

    await expect(
      generateThesisDraft({ userId: "user-a", sessionId: "session-a" }),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_TIMEOUT", status: 504 });
  });

  it("stores AI breaker candidates on the next question", async () => {
    vi.mocked(callAi).mockResolvedValue({
      ok: true,
      data: {
        thesis: "私は事業の成長を観測する。",
        thesisSegments: [{ text: "私は事業の成長を観測する。", sourceRefs: ["S1"] }],
        evidence: [
          {
            sourceRef: "S1",
            quote: "事業の成長と受注の拡大を確認する。",
            reason: "事業の確認",
          },
        ],
        growthDefinition: "事業の売上と受注が拡大すること。",
        growthIndicators: ["受注の拡大"],
        nearTermFactors: ["決算発表"],
        invalidationConditions: ["受注が減少する"],
        breakers: [
          { description: "業績が悪化する", newsKeywords: ["減収"], sourceRefs: ["S1"] },
          { description: "競争力が低下する", newsKeywords: ["競争"], sourceRefs: ["S1"] },
          { description: "統治上の問題が確認される", newsKeywords: ["不祥事"], sourceRefs: ["S1"] },
          { description: "保有理由を説明できなくなる", newsKeywords: ["仮説"], sourceRefs: ["S1"] },
        ],
      },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: "mock",
      estimatedCostUsd: 0,
    });

    const result = await generateThesisDraft({
      userId: "user-a",
      sessionId: "session-a",
    });

    expect(result.thesisDraft).toBe("私は事業の成長を観測する。");
    expect(result.research.sources[0].ref).toBe("S1");
    expect(vi.mocked(callAi).mock.calls[0]?.[0].promptVersion).toBe(
      "thesis-draft-v2",
    );
    const question = await db
      .from("rule_questions")
      .select("options, breaker_source")
      .eq("session_id", "session-a")
      .eq("question_key", "thesis_breakers_pick")
      .single();
    expect(question.data?.breaker_source).toBe("ai");
    expect(question.data?.options).toEqual([
      { label: "業績が悪化する", value: "業績が悪化する" },
      { label: "競争力が低下する", value: "競争力が低下する" },
      { label: "統治上の問題が確認される", value: "統治上の問題が確認される" },
      { label: "保有理由を説明できなくなる", value: "保有理由を説明できなくなる" },
    ]);
  });

  it("rejects a session owned by another user before calling the AI", async () => {
    await expect(
      generateThesisDraft({ userId: "user-b", sessionId: "session-a" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    expect(callAi).not.toHaveBeenCalled();
  });

  it("uses a valid 24-hour cache without calling RAG or the AI again", async () => {
    const runService = await import(
      "@/features/rules/services/thesis-research-run-service"
    );
    const sourceService = await import(
      "@/features/rules/services/thesis-research-source-service"
    );
    const sourceVersion = await sourceService.getThesisResearchSourceVersion({
      userId: "user-a",
      ticker: "7203",
      market: "JP",
    });
    const inputHash = runService.createThesisResearchInputHash({
      ticker: "7203",
      companyName: "A社",
      sourceVersion,
      promptVersion: "thesis-draft-v2",
      answers: [],
    });
    await runService.saveThesisResearchRun({
      userId: "user-a",
      sessionId: "session-a",
      inputHash,
      status: "completed",
      sources: [
        {
          ref: "S1",
          sourceType: "news",
          url: "https://example.com/news-1",
          title: "A社の事業成長に関する発表",
          publisher: "test",
          publishedAt: "2026-07-18T00:00:00.000Z",
          retrievedAt: "2026-07-18T00:00:00.000Z",
          excerpt: "事業の成長",
          highlightText: "事業の成長",
          verified: true,
        },
      ],
      research: {
        errors: [],
        growthDefinition: "受注の拡大",
        growthIndicators: ["受注"],
        nearTermFactors: ["決算"],
        invalidationConditions: ["受注減少"],
      },
      draft: {
        thesis: "キャッシュ済みの仮説",
        thesisSegments: [{ text: "キャッシュ済みの仮説", sourceRefs: ["S1"] }],
        evidence: [
          {
            sourceRef: "S1",
            quote: "事業の成長と受注の拡大を確認する。",
            reason: "確認",
          },
        ],
        growthDefinition: "受注の拡大",
        growthIndicators: ["受注"],
        nearTermFactors: ["決算"],
        invalidationConditions: ["受注減少"],
        breakers: [
          { description: "1", newsKeywords: [], sourceRefs: ["S1"] },
          { description: "2", newsKeywords: [], sourceRefs: ["S1"] },
          { description: "3", newsKeywords: [], sourceRefs: ["S1"] },
          { description: "4", newsKeywords: [], sourceRefs: ["S1"] },
        ],
      },
    });

    const phases: string[] = [];
    const result = await generateThesisDraft({
      userId: "user-a",
      sessionId: "session-a",
      onPhase: (phase) => phases.push(phase),
    });

    expect(result.thesisDraft).toBe("キャッシュ済みの仮説");
    expect(phases).toEqual(["completed"]);
    expect(callAi).not.toHaveBeenCalled();
  });

  it("uses cached research text when the previous AI attempt has no draft", async () => {
    const runService = await import(
      "@/features/rules/services/thesis-research-run-service"
    );
    const sourceService = await import(
      "@/features/rules/services/thesis-research-source-service"
    );
    const sourceVersion = await sourceService.getThesisResearchSourceVersion({
      userId: "user-a",
      ticker: "7203",
      market: "JP",
    });
    const inputHash = runService.createThesisResearchInputHash({
      ticker: "7203",
      companyName: "A社",
      sourceVersion,
      promptVersion: "thesis-draft-v2",
      answers: [],
    });
    const source = {
      ref: "S1",
      sourceType: "ir" as const,
      url: "https://example.com/cached-ir",
      title: "A社 IR",
      publisher: "A社",
      publishedAt: "2026-07-18T00:00:00.000Z",
      retrievedAt: "2026-07-18T00:00:00.000Z",
      excerpt: "キャッシュ済み本文から受注の変化を確認する。",
      highlightText: "キャッシュ済み本文から受注の変化を確認する。",
      verified: true,
    };
    await runService.saveThesisResearchRun({
      userId: "user-a",
      sessionId: "session-a",
      inputHash,
      status: "running",
      sources: [source],
      research: {
        errors: [],
        sourceContents: [
          {
            source,
            content: "キャッシュ済み本文から受注の変化を確認する。",
          },
        ],
      },
    });
    vi.mocked(callAi).mockResolvedValue({
      ok: true,
      data: {
        thesis: "キャッシュ本文から作成した仮説",
        thesisSegments: [
          { text: "キャッシュ本文から作成した仮説", sourceRefs: ["S1"] },
        ],
        evidence: [
          {
            sourceRef: "S1",
            quote: "キャッシュ済み本文から受注の変化を確認する。",
            reason: "確認",
          },
        ],
        growthDefinition: "事業が成長すること。",
        growthIndicators: ["受注"],
        nearTermFactors: ["決算"],
        invalidationConditions: ["受注減少"],
        breakers: [
          { description: "1", newsKeywords: [], sourceRefs: ["S1"] },
          { description: "2", newsKeywords: [], sourceRefs: ["S1"] },
          { description: "3", newsKeywords: [], sourceRefs: ["S1"] },
          { description: "4", newsKeywords: [], sourceRefs: ["S1"] },
        ],
      },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: "mock",
      estimatedCostUsd: 0,
    });

    const result = await generateThesisDraft({
      userId: "user-a",
      sessionId: "session-a",
    });

    expect(result.thesisDraft).toBe("キャッシュ本文から作成した仮説");
    expect(callAi).toHaveBeenCalledTimes(1);
    expect(vi.mocked(callAi).mock.calls[0]?.[0].prompt).toContain(
      "キャッシュ済み本文から受注の変化を確認する。",
    );
  });

  it("does not accept evidence that does not match a collected source", async () => {
    vi.mocked(callAi).mockResolvedValue({
      ok: true,
      data: {
        thesis: "根拠のない仮説",
        thesisSegments: [{ text: "根拠のない仮説", sourceRefs: ["S99"] }],
        evidence: [{ sourceRef: "S99", quote: "存在しない引用", reason: "確認" }],
        growthDefinition: "事業の成長",
        growthIndicators: ["受注"],
        nearTermFactors: ["決算"],
        invalidationConditions: ["受注減少"],
        breakers: [
          { description: "1", newsKeywords: [], sourceRefs: ["S99"] },
          { description: "2", newsKeywords: [], sourceRefs: ["S99"] },
          { description: "3", newsKeywords: [], sourceRefs: ["S99"] },
          { description: "4", newsKeywords: [], sourceRefs: ["S99"] },
        ],
      },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: "mock",
      estimatedCostUsd: 0,
    });

    await expect(
      generateThesisDraft({ userId: "user-a", sessionId: "session-a" }),
    ).rejects.toMatchObject({ code: "AI_OUTPUT_INVALID", status: 422 });
  });

  it("rejects evidence shorter than the minimum quote length", async () => {
    vi.mocked(callAi).mockResolvedValue({
      ok: true,
      data: {
        thesis: "短い引用を使った仮説",
        thesisSegments: [{ text: "短い引用を使った仮説", sourceRefs: ["S1"] }],
        evidence: [{ sourceRef: "S1", quote: "受注の拡大", reason: "確認" }],
        growthDefinition: "受注が拡大すること。",
        growthIndicators: ["受注"],
        nearTermFactors: ["決算"],
        invalidationConditions: ["受注が減少する"],
        breakers: [
          { description: "1", newsKeywords: [], sourceRefs: ["S1"] },
          { description: "2", newsKeywords: [], sourceRefs: ["S1"] },
          { description: "3", newsKeywords: [], sourceRefs: ["S1"] },
          { description: "4", newsKeywords: [], sourceRefs: ["S1"] },
        ],
      },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: "mock",
      estimatedCostUsd: 0,
    });

    await expect(
      generateThesisDraft({ userId: "user-a", sessionId: "session-a" }),
    ).rejects.toMatchObject({ code: "AI_OUTPUT_INVALID", status: 422 });
  });

  it("rejects evidence that only repeats the source title", async () => {
    vi.mocked(callAi).mockResolvedValue({
      ok: true,
      data: {
        thesis: "タイトルを使った仮説",
        thesisSegments: [{ text: "タイトルを使った仮説", sourceRefs: ["S1"] }],
        evidence: [
          {
            sourceRef: "S1",
            quote: "A社の事業成長に関する発表資料",
            reason: "タイトル確認",
          },
        ],
        growthDefinition: "受注が拡大すること。",
        growthIndicators: ["受注"],
        nearTermFactors: ["決算"],
        invalidationConditions: ["受注が減少する"],
        breakers: [
          { description: "1", newsKeywords: [], sourceRefs: ["S1"] },
          { description: "2", newsKeywords: [], sourceRefs: ["S1"] },
          { description: "3", newsKeywords: [], sourceRefs: ["S1"] },
          { description: "4", newsKeywords: [], sourceRefs: ["S1"] },
        ],
      },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: "mock",
      estimatedCostUsd: 0,
    });

    await expect(
      generateThesisDraft({ userId: "user-a", sessionId: "session-a" }),
    ).rejects.toMatchObject({ code: "AI_OUTPUT_INVALID", status: 422 });
  });

  it("does not verify a heading-only quote but accepts the same source body", async () => {
    await db.from("user_documents").insert({
      id: "document-heading-1",
      user_id: "user-a",
      title: "見出し付き資料",
      document_type: "note",
      document_kind: "note",
      ticker: "7203",
      extracted_text: "# 成長方針\n本文の説明として受注残が増加しています。",
      source_url: "https://example.com/heading-note",
    });

    const baseDraft = {
      thesis: "資料から作成した仮説",
      thesisSegments: [{ text: "資料から作成した仮説", sourceRefs: ["S2"] }],
      growthDefinition: "受注残が増加すること。",
      growthIndicators: ["受注残"],
      nearTermFactors: ["決算"],
      invalidationConditions: ["受注残が減少する"],
      breakers: [
        { description: "1", newsKeywords: [], sourceRefs: ["S2"] },
        { description: "2", newsKeywords: [], sourceRefs: ["S2"] },
        { description: "3", newsKeywords: [], sourceRefs: ["S2"] },
        { description: "4", newsKeywords: [], sourceRefs: ["S2"] },
      ],
    };

    vi.mocked(callAi).mockResolvedValue({
      ok: true,
      data: {
        ...baseDraft,
        evidence: [{ sourceRef: "S2", quote: "成長方針", reason: "見出し" }],
      },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: "mock",
      estimatedCostUsd: 0,
    });
    await expect(
      generateThesisDraft({ userId: "user-a", sessionId: "session-a" }),
    ).rejects.toMatchObject({ code: "AI_OUTPUT_INVALID", status: 422 });

    vi.mocked(callAi).mockResolvedValue({
      ok: true,
      data: {
        ...baseDraft,
        evidence: [
          {
            sourceRef: "S2",
            quote: "本文の説明として受注残が増加しています。",
            reason: "本文",
          },
        ],
      },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: "mock",
      estimatedCostUsd: 0,
    });

    const result = await generateThesisDraft({
      userId: "user-a",
      sessionId: "session-a",
    });
    expect(result.evidence).toEqual([
      {
        sourceRef: "S2",
        quote: "本文の説明として受注残が増加しています。",
        reason: "本文",
      },
    ]);
  });

  it("stops before the AI call when the monthly cost limit is exceeded", async () => {
    const { getMonthlyCostPeriod } = await import(
      "@/lib/cost-limit/cost-limit-period"
    );
    const { periodStart, periodEnd } = getMonthlyCostPeriod();
    await db.from("cost_limit_counters").insert({
      user_id: "user-a",
      period_start: periodStart,
      period_end: periodEnd,
      used_cost_usd: 100,
      limit_cost_usd: 100,
    });

    await expect(
      generateThesisDraft({ userId: "user-a", sessionId: "session-a" }),
    ).rejects.toMatchObject({ code: "COST_LIMIT_EXCEEDED", status: 402 });
    expect(callAi).not.toHaveBeenCalled();
  });
});
