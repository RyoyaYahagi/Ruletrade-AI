import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { detectProhibitedPhrases } from "@/lib/safety/detect-prohibited-phrases";

const FINANCIAL_ADVICE_PATTERNS = [
  /買うべきです/,
  /売るべきです/,
  /買いです/,
  /売りです/,
  /上がります/,
  /下がります/,
  /利益が出ます/,
  /損失を避けられます/,
  /安全です/,
  /危険です/,
  /おすすめです/,
  /推奨します/,
  /判断します/,
  /代わりに/,
];

export async function runComplianceGate(params: {
  userId: string;
  reviewType: string;
  text: string;
}) {
  const db = await createDatabaseClient();

  const detected = detectProhibitedPhrases(params.text);
  const adviceDetected = FINANCIAL_ADVICE_PATTERNS.some((pattern) =>
    pattern.test(params.text),
  );

  const violations = detected.map((item) => ({
    type: item.type,
    phrase: item.phrase,
    reason: item.reason,
  }));

  if (adviceDetected) {
    violations.push({
      type: "other",
      phrase: "投資助言表現の検出",
      reason: "Ruletrade-AIは投資助言を提供しません。",
    });
  }

  const passed = violations.length === 0;
  const riskLevel = passed
    ? "low"
    : violations.some(
          (v) => v.type === "other" && v.phrase === "投資助言表現の検出",
        )
      ? "high"
      : "medium";

  const { data, error } = await db
    .from("compliance_review_logs")
    .insert({
      user_id: params.userId,
      review_type: params.reviewType,
      content_hash: await hashText(params.text),
      original_text: params.text,
      reviewed_text: passed ? params.text : sanitizeOutput(params.text),
      passed,
      risk_level: riskLevel,
      violations: JSON.stringify(violations),
    })
    .select("*")
    .single();

  if (error) throw error;

  return {
    passed,
    riskLevel,
    violations,
    logId: data?.id,
  };
}

async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sanitizeOutput(text: string): string {
  return "[この内容はコンプライアンス上の理由で表示できません。]";
}
