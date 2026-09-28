import "server-only";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { DecisionExtractionSchema } from "@/schemas/decision";
import { DecisionComparisonSchema } from "@/schemas/review";
import { buildComparisonContext } from "@/features/reviews/review-context";

import type { Decision, DecisionExtraction } from "@/schemas/decision";
import type { DecisionComparison } from "@/schemas/review";

function getApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required");
  return apiKey;
}

function getGemini() {
  return new GoogleGenAI({ apiKey: getApiKey() });
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
  stock?: DecisionExtraction["stock"];
  context?: unknown;
}): Promise<DecisionExtraction> {
  const answer = input.followUpAnswer?.trim();
  const output = await generateJson(
    `
    あなたはユーザー本人の投資判断記録を整理するAIです。判断を代行せず、発言を意味を変えず整理してください。
summaryとpointsはユーザー本人の発言にある内容だけから作り、DB Contextだけにある内容を本人の考えとして追加してはいけません。空欄を推測で埋めないでください。DB上の売買事実は改変せず、外部価格を売買価格として扱わず、発言との矛盾を勝手に解決しないでください。
transactionは本人の発言から新しい売買を記録する場合だけ提案してください。linkedTransactionは既存のDB記録なので、そこから新しいtransactionを作らないでください。
各pointのsourceには、その内容を本人が述べた入力を指定してください。該当する発言がなければpointを作らず、pointsを空配列にできます。
followUpQuestionは理解を大きく助ける場合のみ1問出してください。追加回答後は必ずnullにしてください。
${answer ? "ユーザーは追加質問に回答済みです。followUpQuestionは必ずnullにしてください。" : ""}
${input.stock ? `対象銘柄は確定しています: ${JSON.stringify(input.stock)}。stockはこの銘柄を使用し、銘柄名を再質問しないでください。` : ""}
User Source（summary/pointsの根拠にできる本人の発言）:
rawInput: ${input.rawInput}
followUpAnswer: ${answer ?? "なし"}
Persisted Facts（銘柄・売買・保有・過去判断。発言の理解、過去との比較、矛盾検知、確認質問に利用できます。summary/pointsへ本人の考えとして混ぜてはいけません）:
${JSON.stringify(input.context ?? null)}
External Reference Context: なし。外部価格は取得していません。
出力形: {"type":"buy|add|sell_consideration|sell|thesis_update|note","stock":{"ticker":string|null,"name":string,"market":string|null},"summary":string|null,"points":[{"kind":"reason|expectation|assumption|observation|risk|uncertainty|condition|other","text":string,"source":"raw_input|follow_up_answer"}],"transaction":{"side":"buy|sell","quantity":number|null,"price":number|null,"fee":number|null,"executedAt":ISO日時|null}|null,"followUpQuestion":string|null}
元のユーザー発言（改変せず記録すること）:
${input.rawInput}
${
  answer
    ? `追加質問へのユーザー回答:
${answer}`
    : ""
}
`.trim(),
  );
  const parsed = DecisionExtractionSchema.parse(
    input.stock && output && typeof output === "object"
      ? { ...output, stock: input.stock }
      : output,
  );
  return answer ? { ...parsed, followUpQuestion: null } : parsed;
}

export async function transcribeAudio(input: {
  bytes: Uint8Array;
  mimeType: string;
}): Promise<string> {
  if (input.bytes.byteLength === 0) throw new Error("Audio file is empty");
  const base64Audio = Buffer.from(input.bytes).toString("base64");
  // The installed SDK uses the retired Interactions schema; call the current API directly.
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": getApiKey(),
        "Api-Revision": "2026-05-20",
      },
      body: JSON.stringify({
        model: "gemini-3.5-transcribe",
        input: [
          {
            type: "audio",
            data: base64Audio,
            mime_type:
              input.mimeType === "audio/mp4" ? "audio/m4a" : input.mimeType,
          },
        ],
        generation_config: {
          transcription_config: { language_codes: ["ja-JP"], mode: "smart" },
        },
        store: false,
      }),
      signal: AbortSignal.timeout(60_000),
    },
  );
  if (!response.ok)
    throw new Error(`Gemini transcription failed (${response.status})`);
  const output = z
    .object({
      status: z.literal("completed"),
      steps: z.array(
        z.object({
          type: z.string(),
          content: z
            .array(z.object({ type: z.string(), text: z.string().optional() }))
            .optional(),
        }),
      ),
    })
    .parse(await response.json());
  const transcript = output.steps
    .filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .filter((content) => content.type === "text")
    .map((content) => content.text ?? "")
    .join("\n")
    .trim();
  if (!transcript) throw new Error("Gemini returned an empty transcript");
  return transcript;
}

export async function compareDecision(input: {
  currentInput: string;
  decisions: Decision[];
}): Promise<DecisionComparison> {
  const history = buildComparisonContext(input.decisions);
  const output = await generateJson(
    `
現在のユーザーの考えを、過去に本人が記録した判断と比較してください。
売買を勧めたり、判断を代行したり、正誤判定したりしてはいけません。何が維持され、何が変わり、何が新しく加わったかを、本人の発言と過去の記録に基づいて簡潔に示してください。売買事実だけを理由として解釈しないでください。
過去の判断:
${JSON.stringify(history)}
現在の考え:
${input.currentInput}
JSON形式: {"summary":string,"differences":string[]}
`.trim(),
  );
  return DecisionComparisonSchema.parse(output);
}
