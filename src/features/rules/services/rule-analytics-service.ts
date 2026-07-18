import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { createDatabaseClient } from "@/lib/db/database-client";
import { getRuleAiTraceForUser, hashValue } from "@/features/rules/services/rule-ai-trace-service";
import {
  RuleFunnelEventNameSchema,
  type RuleFunnelEventMetadata,
  type RuleFunnelEventName,
} from "@/schemas/rules/rule-analytics-schema";

const EVENT_RETENTION_DAYS = 30;
const ABANDONMENT_MINUTES = 30;

export async function trackRuleFunnelEvent(params: {
  userId: string;
  sessionId: string;
  eventId?: string;
  eventName: RuleFunnelEventName;
  questionId?: string | null;
  questionKey?: string | null;
  requestId?: string | null;
  metadata?: RuleFunnelEventMetadata;
  occurredAt?: string;
}) {
  const eventName = RuleFunnelEventNameSchema.parse(params.eventName);
  const db = await createDatabaseClient();
  const occurredAt = params.occurredAt ?? new Date().toISOString();
  const expiresAt = new Date(
    Date.parse(occurredAt) + EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const eventId = params.eventId ?? crypto.randomUUID();
  const { data, error } = await db
    .from("rule_funnel_events")
    .insert({
      user_id: params.userId,
      session_id: params.sessionId,
      question_id: params.questionId ?? null,
      question_key: params.questionKey ?? null,
      event_id: eventId,
      event_name: eventName,
      request_id: params.requestId ?? null,
      metadata_json: sanitizeMetadata(params.metadata ?? {}),
      occurred_at: occurredAt,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error) {
    if (error.message.toLowerCase().includes("unique")) {
      return { eventId, duplicate: true };
    }
    throw new AppError(
      "DATABASE_ERROR",
      "ルール作成イベントを保存できませんでした。",
      500,
      error,
    );
  }

  return { eventId: String(data?.id ?? eventId), duplicate: false };
}

export async function trackRuleEngagement(params: {
  userId: string;
  sessionId: string;
  eventId: string;
  eventName: "session_resumed" | "question_viewed" | "question_started";
  questionId?: string;
  questionKey?: string;
  metadata?: RuleFunnelEventMetadata;
}) {
  if (params.eventName === "session_resumed") {
    return trackRuleFunnelEvent(params);
  }
  if (!params.questionId || !params.questionKey) {
    throw new AppError("VALIDATION_ERROR", "質問情報が必要です。", 400);
  }
  const db = await createDatabaseClient();
  const { data: question, error } = await db
    .from("rule_questions")
    .select("id, question_key")
    .eq("id", params.questionId)
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (error) throw error;
  if (!question || String(question.question_key) !== params.questionKey) {
    throw new AppError("NOT_FOUND", "計測対象の質問が見つかりません。", 404);
  }

  return trackRuleFunnelEvent(params);
}

export async function recordRuleAnswerEvent(params: {
  userId: string;
  sessionId: string;
  questionId?: string;
  questionKey: string;
  answerId: string;
  answerText?: string;
  answerJson: unknown;
  draftTraceId?: string;
  requestId?: string;
}) {
  const draftUsage = params.draftTraceId
    ? await classifyDraftUsage({
        userId: params.userId,
        traceId: params.draftTraceId,
        answerText: params.answerText,
        answerJson: params.answerJson,
      })
    : "not_used";

  await trackRuleFunnelEvent({
    userId: params.userId,
    sessionId: params.sessionId,
    eventName: "answer_saved",
    questionId: params.questionId,
    questionKey: params.questionKey,
    requestId: params.requestId,
    metadata: {
      answerId: params.answerId,
      draftUsage,
      answerOrigin: getAnswerOrigin(params.answerJson),
    },
  });
  return { draftUsage };
}

export async function recordQuestionSkippedEvent(params: {
  userId: string;
  sessionId: string;
  questionId: string;
  questionKey?: string;
  requestId?: string;
}) {
  await trackRuleFunnelEvent({
    userId: params.userId,
    sessionId: params.sessionId,
    eventName: "question_skipped",
    questionId: params.questionId,
    questionKey: params.questionKey,
    requestId: params.requestId,
  });
}

export async function getAdminRuleAnalytics(params: {
  from: string;
  to: string;
}) {
  const fromTime = Date.parse(params.from);
  const toTime = Date.parse(params.to);
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime) || fromTime >= toTime) {
    throw new AppError("VALIDATION_ERROR", "分析期間が不正です。", 400);
  }
  if (toTime - fromTime > 90 * 24 * 60 * 60 * 1000) {
    throw new AppError("VALIDATION_ERROR", "分析期間は90日以内で指定してください。", 400);
  }

  const db = await createDatabaseClient();
  const [eventsResult, tracesResult] = await Promise.all([
    db
      .from("rule_funnel_events")
      .select("*")
      .gte("occurred_at", params.from)
      .lt("occurred_at", params.to)
      .order("occurred_at", { ascending: true }),
    db
      .from("rule_ai_trace_records")
      .select("id, question_key, trace_type, status, model, created_at")
      .gte("created_at", params.from)
      .lt("created_at", params.to)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (eventsResult.error || tracesResult.error) {
    throw new AppError(
      "DATABASE_ERROR",
      "ルール分析を取得できませんでした。",
      500,
      eventsResult.error ?? tracesResult.error,
    );
  }

  // Daily metrics are derived from already-retained events; a failed aggregate
  // write must not hide the read-only dashboard result.
  try {
    await persistDailyMetrics(
      (eventsResult.data ?? []) as Array<Record<string, unknown>>,
    );
  } catch (dailyError) {
    console.error("Failed to persist rule analytics daily metrics:", dailyError);
  }

  return {
    ...aggregateRuleAnalytics(
      (eventsResult.data ?? []) as Array<Record<string, unknown>>,
      params.to,
    ),
    recentTraces: tracesResult.data ?? [],
  };
}

async function persistDailyMetrics(rows: Array<Record<string, unknown>>) {
  const grouped = new Map<
    string,
    { userId: string; metricDate: string; questionKey: string; eventCounts: Record<string, number>; sessions: Set<string> }
  >();
  for (const row of rows) {
    const userId = String(row.user_id ?? "");
    const metricDate = String(row.occurred_at ?? "").slice(0, 10);
    if (!userId || !metricDate) continue;
    const questionKey = String(row.question_key ?? "__session__");
    const key = `${userId}:${metricDate}:${questionKey}`;
    const current = grouped.get(key) ?? {
      userId,
      metricDate,
      questionKey,
      eventCounts: {},
      sessions: new Set<string>(),
    };
    const eventName = String(row.event_name ?? "unknown");
    current.eventCounts[eventName] = (current.eventCounts[eventName] ?? 0) + 1;
    current.sessions.add(String(row.session_id ?? ""));
    grouped.set(key, current);
  }

  const db = await createDatabaseClient();
  for (const item of grouped.values()) {
    await db.from("rule_analytics_daily").upsert(
      {
        user_id: item.userId,
        metric_date: item.metricDate,
        question_key: item.questionKey,
        metrics_json: {
          eventCounts: item.eventCounts,
          uniqueSessions: item.sessions.size,
        },
      },
      { onConflict: "user_id, metric_date, question_key" },
    );
  }
}

export async function getAdminRuleTrace(params: { traceId: string }) {
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("rule_ai_trace_records")
    .select("*")
    .eq("id", params.traceId)
    .gte("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) {
    throw new AppError("DATABASE_ERROR", "AIトレースを取得できませんでした。", 500, error);
  }
  if (!data) throw new AppError("NOT_FOUND", "AIトレースが見つかりません。", 404);
  return data;
}

export async function purgeExpiredRuleAnalyticsData(now = new Date()) {
  const db = await createDatabaseClient();
  const nowIso = now.toISOString();
  const oldDailyDate = new Date(
    now.getTime() - 365 * 24 * 60 * 60 * 1000,
  ).toISOString().slice(0, 10);
  const [events, traces, daily] = await Promise.all([
    db.from("rule_funnel_events").delete().lt("expires_at", nowIso),
    db.from("rule_ai_trace_records").delete().lt("expires_at", nowIso),
    db.from("rule_analytics_daily").delete().lt("metric_date", oldDailyDate),
  ]);
  const error = events.error ?? traces.error ?? daily.error;
  if (error) throw error;
  return { purged: true };
}

export function aggregateRuleAnalytics(
  rows: Array<Record<string, unknown>>,
  endIso: string,
) {
  const sessionMap = new Map<string, SessionAccumulator>();
  const questionMap = new Map<string, QuestionAccumulator>();
  const ai = {
    requested: 0,
    succeeded: 0,
    failed: 0,
    cacheHit: 0,
    accepted: 0,
    edited: 0,
    manual: 0,
  };

  for (const row of rows) {
    const sessionId = String(row.session_id ?? "");
    if (!sessionId) continue;
    const session = sessionMap.get(sessionId) ?? createSessionAccumulator();
    const eventName = String(row.event_name);
    const occurredAt = String(row.occurred_at);
    const questionKey = row.question_key ? String(row.question_key) : null;
    const metadata = parseMetadata(row.metadata_json);
    session.lastActivity = maxIso(session.lastActivity, occurredAt);
    if (eventName === "session_created") session.started = true;
    if (eventName === "session_resumed") session.resumed = true;
    if (eventName === "session_completed") session.completed = true;
    if (questionKey) {
      const question = questionMap.get(questionKey) ?? createQuestionAccumulator();
      const questionId = String(row.question_id ?? "");
      const questionInstance = `${sessionId}:${questionId || questionKey}`;
      if (eventName === "question_viewed") {
        question.viewed.add(questionInstance);
        session.viewed.set(questionInstance, { questionKey, occurredAt });
      }
      if (eventName === "question_started") {
        question.started.add(questionInstance);
        session.startedQuestions.add(questionInstance);
      }
      if (eventName === "answer_saved") {
        question.answered.add(questionInstance);
        session.resolved.add(questionInstance);
        const start = session.viewed.get(questionInstance)?.occurredAt;
        if (start) question.answerDurations.push(Math.max(0, Date.parse(occurredAt) - Date.parse(start)));
        const draftUsage = String(metadata.draftUsage ?? "");
        if (draftUsage === "accepted") ai.accepted += 1;
        if (draftUsage === "edited") ai.edited += 1;
        if (draftUsage === "not_used") ai.manual += 1;
      }
      if (eventName === "question_skipped") {
        question.skipped.add(questionInstance);
        session.resolved.add(questionInstance);
      }
      questionMap.set(questionKey, question);
      session.lastQuestionKey = questionKey;
    }
    if (eventName === "thesis_draft_requested") ai.requested += 1;
    if (eventName === "thesis_draft_succeeded") ai.succeeded += 1;
    if (eventName === "thesis_draft_failed") ai.failed += 1;
    if (eventName === "thesis_draft_cache_hit") ai.cacheHit += 1;
    sessionMap.set(sessionId, session);
  }

  const cutoff = Date.parse(endIso) - ABANDONMENT_MINUTES * 60 * 1000;
  let abandonedSessions = 0;
  const abandonedByQuestion = new Map<string, number>();
  for (const session of sessionMap.values()) {
    if (!session.started || session.completed) continue;
    if (Date.parse(session.lastActivity) > cutoff) continue;
    const unresolved = Array.from(session.viewed.entries())
      .filter(([instance]) => !session.resolved.has(instance))
      .sort(([, a], [, b]) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
    const lastQuestion = unresolved[0]?.[1].questionKey;
    if (lastQuestion) {
      abandonedSessions += 1;
      abandonedByQuestion.set(lastQuestion, (abandonedByQuestion.get(lastQuestion) ?? 0) + 1);
    }
  }

  const questions = Array.from(questionMap.entries()).map(([questionKey, question]) => ({
    questionKey,
    viewed: question.viewed.size,
    started: question.started.size,
    answered: question.answered.size,
    skipped: question.skipped.size,
    answerRate: ratio(question.answered.size, question.viewed.size),
    skipRate: ratio(question.skipped.size, question.viewed.size),
    abandoned: abandonedByQuestion.get(questionKey) ?? 0,
    abandonmentRate: ratio(abandonedByQuestion.get(questionKey) ?? 0, question.viewed.size),
    medianAnswerTimeMs: median(question.answerDurations),
  }));

  const startedSessions = Array.from(sessionMap.values()).filter((session) => session.started).length;
  const completedSessions = Array.from(sessionMap.values()).filter((session) => session.completed).length;
  return {
    period: { from: rows[0]?.occurred_at ?? endIso, to: endIso },
    sessions: {
      started: startedSessions,
      resumed: Array.from(sessionMap.values()).filter((session) => session.resumed).length,
      completed: completedSessions,
      completionRate: ratio(completedSessions, startedSessions),
      abandoned: abandonedSessions,
      abandonmentRate: ratio(abandonedSessions, startedSessions),
    },
    questions: questions.sort((a, b) => b.abandonmentRate - a.abandonmentRate),
    aiDrafts: {
      ...ai,
      successRate: ratio(ai.succeeded, ai.requested),
      acceptanceRate: ratio(ai.accepted, ai.accepted + ai.edited),
      editedRate: ratio(ai.edited, ai.accepted + ai.edited),
    },
  };
}

type SessionAccumulator = {
  started: boolean;
  resumed: boolean;
  completed: boolean;
  lastActivity: string;
  lastQuestionKey: string | null;
  viewed: Map<string, { questionKey: string; occurredAt: string }>;
  resolved: Set<string>;
  startedQuestions: Set<string>;
};

type QuestionAccumulator = {
  viewed: Set<string>;
  started: Set<string>;
  answered: Set<string>;
  skipped: Set<string>;
  answerDurations: number[];
};

function createSessionAccumulator(): SessionAccumulator {
  return {
    started: false,
    resumed: false,
    completed: false,
    lastActivity: "1970-01-01T00:00:00.000Z",
    lastQuestionKey: null,
    viewed: new Map(),
    resolved: new Set(),
    startedQuestions: new Set(),
  };
}

function createQuestionAccumulator(): QuestionAccumulator {
  return {
    viewed: new Set(),
    started: new Set(),
    answered: new Set(),
    skipped: new Set(),
    answerDurations: [],
  };
}

function sanitizeMetadata(value: RuleFunnelEventMetadata) {
  const result: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    const lowerKey = key.toLowerCase();
    if (["text", "content", "prompt", "output", "memo", "note", "ticker", "symbol", "name"].some((term) => lowerKey.includes(term))) continue;
    if (typeof rawValue === "string") result[key] = rawValue.slice(0, 200);
    else if (typeof rawValue === "number" || typeof rawValue === "boolean" || rawValue === null) result[key] = rawValue;
  }
  return result;
}

function parseMetadata(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function getAnswerOrigin(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "user";
  return (value as { enteredBy?: unknown }).enteredBy === "api_agent" ? "api_agent" : "user";
}

async function classifyDraftUsage(params: {
  userId: string;
  traceId: string;
  answerText?: string;
  answerJson: unknown;
}) {
  const trace = await getRuleAiTraceForUser({ userId: params.userId, traceId: params.traceId });
  if (!trace) return "not_used";
  const answerHash = hashValue({ thesis: params.answerText ?? "", answerJson: params.answerJson });
  if (answerHash === String(trace.output_hash)) return "accepted";
  return "edited";
}

function maxIso(left: string, right: string) {
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(4));
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}
