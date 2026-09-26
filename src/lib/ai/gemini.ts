import "server-only";

import { GoogleGenAI } from "@google/genai";

import { DecisionExtractionSchema } from "@/schemas/decision";
import { DecisionComparisonSchema } from "@/schemas/review";
import { buildComparisonContext } from "@/features/reviews/review-context";

import type { Decision, DecisionExtraction } from "@/schemas/decision";
import type { DecisionComparison } from "@/schemas/review";

function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required");
  return new GoogleGenAI({ apiKey });
}

function getModel() {
  const model = process.env.GEMINI_MODEL;
  if (!model) throw new Error("GEMINI_MODEL is required");
  return model;
}

async function generateJson(prompt: string): Promise<unknown> {
  const response = await getGemini().models.generateContent({
    model: getModel(),
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });
  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response");
  return JSON.parse(text) as unknown;
}

export async function extractDecision(input: {
  rawInput: string;
  followUpAnswer?: string;
}): Promise<DecisionExtraction> {
  const answer = input.followUpAnswer?.trim();
  const output = await generateJson(`
整理対象のユーザー発言をDecisionExtraction JSONとして出力してください。
株式の売買を勧めたり、判断を代行したりしてはいけません。銘柄の推測ができない項目は空欄相当のnullにしてください。
followUpQuestionは、見直し条件など判断に不可欠な情報が欠けていて、まだ質問をしていない場合に限り、重要な質問を1つだけ出してください。
${answer ? "ユーザーは追加質問に回答済みです。followUpQuestionは必ずnullにしてください。" : ""}
出力形: {"type":"buy|add|sell_consideration|sell|thesis_update|note","stock":{"ticker":string|null,"name":string,"market":string|null},"thesis":string|null,"assumptions":string[],"reviewConditions":string[],"addConditions":string[],"transaction":{"side":"buy|sell","quantity":number|null,"price":number|null,"fee":number|null,"executedAt":ISO日時|null}|null,"followUpQuestion":string|null}
元のユーザー発言（改変せず記録すること）:
${input.rawInput}
${answer ? `追加質問へのユーザー回答:
${answer}` : ""}
`.trim());
  const parsed = DecisionExtractionSchema.parse(output);
  return answer ? { ...parsed, followUpQuestion: null } : parsed;
}

export async function transcribeAudio(input: {
  bytes: Uint8Array;
  mimeType: string;
}): Promise<string> {
  if (input.bytes.byteLength === 0) throw new Error("Audio file is empty");
  const base64Audio = Buffer.from(input.bytes).toString("base64");
  const response = await getGemini().models.generateContent({
    model: getModel(),
    contents: [
      { text: "音声を日本語で正確に文字起こししてください。内容を要約・修正しないでください。文字起こし本文だけを返してください。" },
      { inlineData: { mimeType: input.mimeType, data: base64Audio } },
    ],
  });
  const transcript = response.text?.trim();
  if (!transcript) throw new Error("Gemini returned an empty transcript");
  return transcript;
}

export async function compareDecision(input: {
  currentInput: string;
  decisions: Decision[];
}): Promise<DecisionComparison> {
  const history = buildComparisonContext(input.decisions);
  const output = await generateJson(`
現在のユーザーの考えを、過去に本人が記録した判断と比較してください。
売買を勧めたり、判断を代行したりしてはいけません。過去の見直し条件と現在の理由の一致・違いだけを簡潔に示してください。
過去の判断:
${JSON.stringify(history)}
現在の考え:
${input.currentInput}
JSON形式: {"summary":string,"differences":string[]}
`.trim());
  return DecisionComparisonSchema.parse(output);
}
